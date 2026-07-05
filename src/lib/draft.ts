import { callClaude } from "@kit/claude";
import { createLogger } from "@kit/logger";
import type { ExtractedLead, Submission } from "@/lib/extract";
import type { Band } from "@/lib/scoring";

const log = createLogger("lib.draft");

export interface ReplyDraft {
  subject: string;
  body: string;
}

const DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "body"],
  properties: {
    subject: { type: "string", description: "Short email subject line" },
    body: {
      type: "string",
      description: "The full reply body, ready to send after human review",
    },
  },
};

const SYSTEM_PROMPT = `You draft the FIRST reply to an inbound enquiry on behalf of a small business.
A human will review, possibly edit, and send it themselves — you are drafting, not sending.
Rules:
- Write in British English.
- Address the enquirer by first name if known.
- Reference the specifics of THEIR request (what they asked for, their timescale) — never a generic template feel.
- Propose one concrete next step (a call, a valuation visit, an appointment) with a question that is easy to answer.
- Keep the body under 150 words. No jargon, no hype.
- Never invent prices, availability, credentials or claims. If the enquiry asks something you cannot know, say the sender will confirm it.
- Sign off with "Best regards," followed by "[Your name]" on the next line — the human replaces the placeholder.`;

/**
 * Fail-safe reply drafting: returns a draft or null on ANY failure. A missing
 * draft never blocks the pipeline — the lead is already stored and scored.
 */
export async function draftReply(
  submission: Submission,
  extracted: ExtractedLead,
  band: Band
): Promise<ReplyDraft | null> {
  try {
    const result = await callClaude({
      system: SYSTEM_PROMPT,
      prompt: JSON.stringify({
        enquiry: submission,
        extracted: {
          name: extracted.name,
          company: extracted.company,
          request_summary: extracted.request_summary,
          budget_signals: extracted.budget_signals,
          urgency_signals: extracted.urgency_signals,
        },
        priority_band: band,
      }),
      maxTokens: 1024,
      jsonSchema: DRAFT_SCHEMA,
    });
    if (result.stopReason !== "end_turn") {
      log.warn("draft_bad_stop_reason", { stop_reason: result.stopReason });
      return null;
    }
    const draft = JSON.parse(result.text) as ReplyDraft;
    if (typeof draft?.subject !== "string" || typeof draft?.body !== "string") {
      log.warn("draft_schema_mismatch", {});
      return null;
    }
    return draft;
  } catch (err) {
    log.warn("draft_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
