import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "@kit/logger";
import { getSupabase, SupabaseNotConfiguredError } from "@/lib/supabase";
import { buildExtractionRequest, extractLead, type Submission } from "@/lib/extract";
import { loadScoringConfig, scoreLead } from "@/lib/scoring";
import { draftReply } from "@/lib/draft";
import { pushLeadToHubspot } from "@/lib/hubspot";
import { notifyHotLead } from "@/lib/slack";

export const runtime = "nodejs";

const log = createLogger("api.leads");

interface ValidationErrors {
  [field: string]: string;
}

function validate(body: unknown): { submission?: Submission; errors?: ValidationErrors } {
  const errors: ValidationErrors = {};
  const b = (body ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const name = str(b.name);
  const email = str(b.email);
  const message = str(b.message);

  if (!name) errors.name = "Name is required";
  else if (name.length > 200) errors.name = "Name is too long (200 character limit)";
  if (!email) errors.email = "Email is required";
  else if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = "Email doesn't look valid";
  else if (email.length > 320) errors.email = "Email is too long";
  if (!message) errors.message = "Message is required";
  else if (message.length > 5000) errors.message = "Message is too long (5,000 character limit)";

  const phone = str(b.phone);
  const company = str(b.company);
  if (phone.length > 50) errors.phone = "Phone number is too long";
  if (company.length > 200) errors.company = "Company name is too long (200 character limit)";

  if (Object.keys(errors).length > 0) return { errors };

  const submission: Submission = { name, email, message };
  if (phone) submission.phone = phone;
  if (company) submission.company = company;
  return { submission };
}

// Per-IP fixed-window rate limit — bounds AI spend and third-party writes from
// a public endpoint. In-memory is fine for a single-instance demo deployment.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 5;
const rateBuckets = new Map<string, { windowStart: number; count: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  if (rateBuckets.size > 1000) {
    for (const [k, v] of rateBuckets) {
      if (now - v.windowStart >= RATE_WINDOW_MS) rateBuckets.delete(k);
    }
  }
  const bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.windowStart >= RATE_WINDOW_MS) {
    rateBuckets.set(ip, { windowStart: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_MAX_PER_WINDOW;
}

async function recordEvent(
  supabase: SupabaseClient,
  leadId: string,
  action: string,
  payload: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from("events").insert({ lead_id: leadId, action, payload });
  if (error) {
    log.error("event_write_failed", { lead_id: leadId, action, error: error.message });
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const { submission, errors } = validate(body);
  if (!submission) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  // Rate-limit real submissions (DRY_RUN is a local dev tool — exempt).
  if (process.env.DRY_RUN !== "true") {
    const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
    if (rateLimited(ip)) {
      log.warn("rate_limited", { ip });
      return NextResponse.json(
        { error: "Too many submissions — please try again in a minute" },
        { status: 429 }
      );
    }
  }

  // DRY_RUN=true: skip Supabase and Anthropic entirely; return the exact
  // request that would be sent to Claude so the prompt can be evaluated
  // without spending tokens. Needs no keys at all.
  if (process.env.DRY_RUN === "true") {
    const wouldSend = buildExtractionRequest(submission);
    log.info("dry_run", { model: wouldSend.model });
    return NextResponse.json({ dry_run: true, would_send: wouldSend }, { status: 200 });
  }

  let supabase: SupabaseClient;
  try {
    supabase = getSupabase();
  } catch (err) {
    if (err instanceof SupabaseNotConfiguredError) {
      log.error("supabase_not_configured", {});
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    throw err;
  }

  // 1. Store the raw submission first — nothing downstream can lose it.
  const { data: lead, error: insertError } = await supabase
    .from("leads")
    .insert({ raw: submission })
    .select("id")
    .single();
  if (insertError || !lead) {
    log.error("lead_insert_failed", { error: insertError?.message });
    return NextResponse.json(
      { error: "Could not store the enquiry — please try again" },
      { status: 502 }
    );
  }
  log.info("received", { lead_id: lead.id });
  await recordEvent(supabase, lead.id, "received", { source: "web_form", raw: submission });

  // 2. Extraction — fail-safe: null means store raw + mark unparsed, never crash.
  const extracted = await extractLead(submission);
  if (!extracted || extracted.parseable === false) {
    const reason = !extracted ? "extraction_error" : "not_parseable";
    log.warn("unparsed", { lead_id: lead.id, reason });
    await recordEvent(supabase, lead.id, "extraction_failed", { reason });
    // Public status is always just "received" — parse state is internal.
    return NextResponse.json({ id: lead.id, status: "received" }, { status: 201 });
  }

  const { error: extractUpdateError } = await supabase
    .from("leads")
    .update({ extracted, parsed: true })
    .eq("id", lead.id);
  if (extractUpdateError) {
    log.error("lead_update_failed", { lead_id: lead.id, error: extractUpdateError.message });
    await recordEvent(supabase, lead.id, "extraction_update_failed", {
      error: extractUpdateError.message,
      extracted,
    });
    return NextResponse.json({ id: lead.id, status: "received" }, { status: 201 });
  }
  await recordEvent(supabase, lead.id, "extracted", { extracted });

  // 3. Scoring — rules come from scoring.config.yaml, never from code.
  let config;
  try {
    config = loadScoringConfig();
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log.error("scoring_config_invalid", { error });
    await recordEvent(supabase, lead.id, "scoring_failed", { reason: "config_invalid", error });
    return NextResponse.json({ id: lead.id, status: "received" }, { status: 201 });
  }
  const { score, band, matched } = scoreLead(extracted, { message: submission.message }, config);
  const { error: scoreUpdateError } = await supabase
    .from("leads")
    .update({ score, band, scoring_config: config.name })
    .eq("id", lead.id);
  if (scoreUpdateError) {
    log.error("score_update_failed", { lead_id: lead.id, error: scoreUpdateError.message });
    await recordEvent(supabase, lead.id, "score_update_failed", {
      score,
      band,
      config: config.name,
      error: scoreUpdateError.message,
    });
    return NextResponse.json({ id: lead.id, status: "received" }, { status: 201 });
  }
  await recordEvent(supabase, lead.id, "scored", { score, band, config: config.name, matched });
  log.info("scored", { lead_id: lead.id, score, band, config: config.name });

  // 4. HubSpot push — fail-safe; skipped (with an audit event) when no token.
  const hubspot = await pushLeadToHubspot(submission, extracted, score, band);
  if (hubspot.status === "pushed") {
    const { error: hsWriteError } = await supabase
      .from("leads")
      .update({ hubspot_contact_id: hubspot.contactId })
      .eq("id", lead.id);
    if (hsWriteError) {
      log.error("hubspot_id_write_failed", { lead_id: lead.id, error: hsWriteError.message });
    }
    await recordEvent(supabase, lead.id, "hubspot_pushed", { contact_id: hubspot.contactId });
  } else {
    await recordEvent(supabase, lead.id, `hubspot_${hubspot.status}`, {
      detail: hubspot.status === "skipped" ? hubspot.reason : hubspot.error,
    });
  }

  // 5. Draft the first reply — held in the approval queue; NOTHING sends
  // without a human decision, and even "approved" only releases the text.
  const draft = await draftReply(submission, extracted, band);
  if (draft) {
    const { error: draftError } = await supabase
      .from("reply_drafts")
      .insert({ lead_id: lead.id, subject: draft.subject, body: draft.body });
    if (draftError) {
      log.error("draft_insert_failed", { lead_id: lead.id, error: draftError.message });
      await recordEvent(supabase, lead.id, "reply_draft_failed", { reason: "db_insert_failed" });
    } else {
      // Body included so the audit trail always holds the AI's original text.
      await recordEvent(supabase, lead.id, "reply_drafted", {
        subject: draft.subject,
        body: draft.body,
      });
    }
  } else {
    await recordEvent(supabase, lead.id, "reply_draft_failed", { reason: "draft_generation_failed" });
  }

  // 6. Slack ping on hot leads — fail-safe; skipped (with an event) when no webhook.
  if (band === "hot") {
    const slack = await notifyHotLead(lead.id, extracted, score);
    await recordEvent(
      supabase,
      lead.id,
      slack.status === "notified" ? "slack_notified" : `slack_${slack.status}`,
      slack.status === "notified" ? {} : { detail: slack.status === "skipped" ? slack.reason : slack.error }
    );
  }

  // Public response stays minimal: the enquirer is the client's customer, not
  // the operator — score/band/pipeline state live in /leads and the audit
  // trail, never on the public surface.
  return NextResponse.json({ id: lead.id, status: "received" }, { status: 201 });
}
