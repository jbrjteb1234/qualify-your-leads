import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "@kit/logger";
import { getSupabase, SupabaseNotConfiguredError } from "@/lib/supabase";
import { extractLead, type Submission } from "@/lib/extract";
import { loadScoringConfig, scoreLead } from "@/lib/scoring";

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
  if (!email) errors.email = "Email is required";
  else if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = "Email doesn't look valid";
  if (!message) errors.message = "Message is required";

  if (Object.keys(errors).length > 0) return { errors };

  const submission: Submission = { name, email, message };
  const phone = str(b.phone);
  const company = str(b.company);
  if (phone) submission.phone = phone;
  if (company) submission.company = company;
  return { submission };
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
    return NextResponse.json({ id: lead.id, status: "received_unparsed" }, { status: 201 });
  }

  const { error: extractUpdateError } = await supabase
    .from("leads")
    .update({ extracted, parsed: true })
    .eq("id", lead.id);
  if (extractUpdateError) {
    log.error("lead_update_failed", { lead_id: lead.id, error: extractUpdateError.message });
    return NextResponse.json({ id: lead.id, status: "received_unparsed" }, { status: 201 });
  }
  await recordEvent(supabase, lead.id, "extracted", { extracted });

  // 3. Scoring — rules come from scoring.config.yaml, never from code.
  let config;
  try {
    config = loadScoringConfig();
  } catch (err) {
    log.error("scoring_config_invalid", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ id: lead.id, status: "extracted_unscored" }, { status: 201 });
  }
  const { score, band, matched } = scoreLead(extracted, { message: submission.message }, config);
  const { error: scoreUpdateError } = await supabase
    .from("leads")
    .update({ score, band, scoring_config: config.name })
    .eq("id", lead.id);
  if (scoreUpdateError) {
    log.error("score_update_failed", { lead_id: lead.id, error: scoreUpdateError.message });
    return NextResponse.json({ id: lead.id, status: "extracted_unscored" }, { status: 201 });
  }
  await recordEvent(supabase, lead.id, "scored", { score, band, config: config.name, matched });
  log.info("scored", { lead_id: lead.id, score, band, config: config.name });

  return NextResponse.json({ id: lead.id, status: "scored", score, band }, { status: 201 });
}
