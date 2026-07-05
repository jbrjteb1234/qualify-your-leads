import { NextResponse } from "next/server";
import { createLogger } from "@kit/logger";
import { getSupabase, SupabaseNotConfiguredError } from "@/lib/supabase";

export const runtime = "nodejs";

const log = createLogger("api.drafts");

/**
 * Records a human decision on a drafted reply: approve (optionally with an
 * edited body) or reject. Approval only releases the text for the human to
 * send themselves — this endpoint sends nothing anywhere.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let body: { action?: string; subject?: string; body?: string } | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }
  const action = body?.action;
  body = body ?? {};
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getSupabase();
  } catch (err) {
    if (err instanceof SupabaseNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    throw err;
  }

  const { data: draft, error: fetchError } = await supabase
    .from("reply_drafts")
    .select("id, lead_id, status, subject, body")
    .eq("id", id)
    .single();
  if (fetchError || !draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }
  if (draft.status !== "pending") {
    return NextResponse.json(
      { error: `Draft already ${draft.status} — decisions are final` },
      { status: 409 }
    );
  }

  const update: Record<string, unknown> = {
    status: action === "approve" ? "approved" : "rejected",
    decided_at: new Date().toISOString(),
  };
  let edited = false;
  if (action === "approve") {
    const newSubject = typeof body.subject === "string" ? body.subject.trim() : "";
    const newBody = typeof body.body === "string" ? body.body.trim() : "";
    if (!newBody) {
      return NextResponse.json({ error: "Approved reply body cannot be empty" }, { status: 400 });
    }
    edited = newBody !== draft.body || (newSubject !== "" && newSubject !== draft.subject);
    update.body = newBody;
    if (newSubject) update.subject = newSubject;
  }

  const { data: updated, error: updateError } = await supabase
    .from("reply_drafts")
    .update(update)
    .eq("id", id)
    .eq("status", "pending") // guard against a concurrent decision
    .select("id");
  if (updateError) {
    log.error("draft_decision_failed", { draft_id: id, error: updateError.message });
    return NextResponse.json({ error: "Could not record the decision" }, { status: 502 });
  }
  if (!updated || updated.length === 0) {
    // Lost a race: someone else decided between our fetch and our update.
    return NextResponse.json(
      { error: "Draft already decided — decisions are final" },
      { status: 409 }
    );
  }

  const eventAction = action === "approve" ? "reply_approved" : "reply_rejected";
  const { error: eventError } = await supabase.from("events").insert({
    lead_id: draft.lead_id,
    action: eventAction,
    payload: {
      draft_id: id,
      edited,
      // Preserve the AI's original text when the human changed it, so the
      // audit trail can always show what was reviewed vs what was sent.
      ...(edited
        ? {
            original_subject: draft.subject,
            original_body: draft.body,
            approved_subject: (update.subject as string | undefined) ?? draft.subject,
            approved_body: update.body,
          }
        : {}),
    },
  });
  if (eventError) {
    log.error("event_write_failed", { draft_id: id, error: eventError.message });
  }
  log.info(eventAction, { draft_id: id, lead_id: draft.lead_id, edited });

  return NextResponse.json({ id, status: update.status, edited });
}
