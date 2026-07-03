import { callClaude } from "@kit/claude";
import { createLogger } from "@kit/logger";

const log = createLogger("lib.extract");

export interface Submission {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message: string;
}

// The fixed extraction schema from SPEC.md: name, company, contact details,
// request summary, budget signals, urgency signals.
export interface ExtractedLead {
  parseable: boolean;
  name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  request_summary: string | null;
  budget_signals: string | null;
  urgency_signals: string | null;
  [key: string]: unknown;
}

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] };

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "parseable",
    "name",
    "company",
    "email",
    "phone",
    "request_summary",
    "budget_signals",
    "urgency_signals",
  ],
  properties: {
    parseable: {
      type: "boolean",
      description:
        "false when the message is gibberish, empty of meaning, or contains no usable enquiry",
    },
    name: nullableString,
    company: nullableString,
    email: nullableString,
    phone: nullableString,
    request_summary: nullableString,
    budget_signals: nullableString,
    urgency_signals: nullableString,
  },
};

const SYSTEM_PROMPT = `You extract structured lead data from web enquiry form submissions for a small business.
You receive the raw submission as JSON. Return the fields exactly per the schema:
- name/company/email/phone: prefer values stated in the message text; fall back to the form fields. null when absent.
- request_summary: one or two sentences describing what the enquirer wants. null if there is no discernible request.
- budget_signals: any mention of money, budget, fees or price sensitivity, quoted or paraphrased. null if none.
- urgency_signals: any mention of deadlines, timescales or urgency. null if none.
- parseable: false ONLY when the message is gibberish or contains no usable enquiry at all.
Never invent information that is not in the submission.`;

/**
 * Fail-safe extraction: returns the extracted lead, or null on ANY failure
 * (API error, refusal, truncation, unparseable JSON). Callers treat null as
 * "store raw + mark unparsed" — this function never throws.
 */
export async function extractLead(submission: Submission): Promise<ExtractedLead | null> {
  try {
    const result = await callClaude({
      system: SYSTEM_PROMPT,
      prompt: JSON.stringify(submission),
      maxTokens: 1024,
      jsonSchema: EXTRACTION_SCHEMA,
    });
    if (result.stopReason !== "end_turn") {
      log.warn("extraction_bad_stop_reason", { stop_reason: result.stopReason });
      return null;
    }
    const extracted = JSON.parse(result.text) as ExtractedLead;
    if (typeof extracted?.parseable !== "boolean") {
      log.warn("extraction_schema_mismatch", {});
      return null;
    }
    return extracted;
  } catch (err) {
    log.warn("extraction_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
