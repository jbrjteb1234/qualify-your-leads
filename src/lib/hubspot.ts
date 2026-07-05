import { createLogger } from "@kit/logger";
import type { ExtractedLead, Submission } from "@/lib/extract";
import type { Band } from "@/lib/scoring";

const log = createLogger("lib.hubspot");

const BASE = "https://api.hubapi.com";
const TIMEOUT_MS = 15_000;

export type HubspotResult =
  | { status: "pushed"; contactId: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function hs(
  token: string,
  method: string,
  path: string,
  body: unknown
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(token),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

function splitName(fullName: string | null): { first: string; last: string } {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

/**
 * Upserts a HubSpot contact for the lead and attaches a note with the
 * qualification summary. Fail-safe: returns a status object, never throws.
 * Skipped entirely when HUBSPOT_ACCESS_TOKEN is not set.
 */
export async function pushLeadToHubspot(
  submission: Submission,
  extracted: ExtractedLead,
  score: number,
  band: Band
): Promise<HubspotResult> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return { status: "skipped", reason: "HUBSPOT_ACCESS_TOKEN not set" };

  const email = extracted.email ?? submission.email;
  const { first, last } = splitName(extracted.name ?? submission.name);
  const properties: Record<string, string> = { email };
  if (first) properties.firstname = first;
  if (last) properties.lastname = last;
  const phone = extracted.phone ?? submission.phone;
  if (phone) properties.phone = phone;
  const company = extracted.company ?? submission.company;
  if (company) properties.company = company;

  try {
    // 1. Find an existing contact by email.
    const search = await hs(token, "POST", "/crm/v3/objects/contacts/search", {
      filterGroups: [
        { filters: [{ propertyName: "email", operator: "EQ", value: email }] },
      ],
      limit: 1,
    });
    if (!search.ok) {
      log.error("hubspot_search_failed", { http: search.status });
      return { status: "failed", error: `contact search returned ${search.status}` };
    }
    const results = (search.json.results ?? []) as Array<{ id: string }>;

    // 2. Create if absent. Deliberately NO update of existing contacts:
    // submissions are unverified, so overwriting identity fields would let
    // anyone who knows a client's email rewrite that client's CRM record.
    // Existing contacts just get the note attached below.
    let contactId: string;
    if (results.length > 0) {
      contactId = results[0].id;
      log.info("hubspot_matched_existing", { contact_id: contactId });
    } else {
      const create = await hs(token, "POST", "/crm/v3/objects/contacts", { properties });
      if (!create.ok) {
        log.error("hubspot_create_failed", { http: create.status });
        return { status: "failed", error: `contact create returned ${create.status}` };
      }
      contactId = String(create.json.id);
    }

    // 3. Attach a note with the qualification summary (association 202 = note→contact).
    // hs_note_body renders as rich text in the HubSpot UI, so escape the
    // user-influenced strings to stop submitted markup/links rendering live.
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const noteBody = [
      "Unverified web-form submission — details below are as submitted, not confirmed.",
      `Lead qualified by intake pipeline — score ${score}, band ${band.toUpperCase()}.`,
      extracted.request_summary ? `Request: ${esc(String(extracted.request_summary))}` : null,
      extracted.budget_signals ? `Budget signals: ${esc(String(extracted.budget_signals))}` : null,
      extracted.urgency_signals ? `Urgency signals: ${esc(String(extracted.urgency_signals))}` : null,
      `Original message: ${esc(submission.message)}`,
    ]
      .filter(Boolean)
      .join("\n");
    const note = await hs(token, "POST", "/crm/v3/objects/notes", {
      properties: { hs_timestamp: Date.now().toString(), hs_note_body: noteBody },
      associations: [
        {
          to: { id: contactId },
          types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }],
        },
      ],
    });
    if (!note.ok) {
      // Contact exists — report pushed but log the note failure honestly.
      log.warn("hubspot_note_failed", { http: note.status, contact_id: contactId });
    }

    log.info("hubspot_pushed", { contact_id: contactId, note_ok: note.ok });
    return { status: "pushed", contactId };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log.error("hubspot_failed", { error });
    return { status: "failed", error };
  }
}
