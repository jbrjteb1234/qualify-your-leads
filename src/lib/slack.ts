import { createLogger } from "@kit/logger";
import type { ExtractedLead } from "@/lib/extract";

const log = createLogger("lib.slack");

const TIMEOUT_MS = 10_000;

export type SlackResult =
  | { status: "notified" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

// Extracted fields derive from attacker-controlled enquiry text; Slack parses
// mrkdwn control sequences (<!channel>, masked links) unless & < > are escaped.
function escapeMrkdwn(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Pings a Slack incoming webhook about a hot lead. Fail-safe: returns a
 * status object, never throws. Skipped when SLACK_WEBHOOK_URL is not set.
 */
export async function notifyHotLead(
  leadId: string,
  extracted: ExtractedLead,
  score: number
): Promise<SlackResult> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return { status: "skipped", reason: "SLACK_WEBHOOK_URL not set" };

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const who =
    [extracted.name, extracted.company]
      .filter((v): v is string => Boolean(v))
      .map(escapeMrkdwn)
      .join(", ") || "Unknown enquirer";
  const text = [
    `:fire: *Hot lead* (score ${score}) — ${who}`,
    extracted.request_summary ? `> ${escapeMrkdwn(String(extracted.request_summary))}` : null,
    extracted.urgency_signals ? `Urgency: ${escapeMrkdwn(String(extracted.urgency_signals))}` : null,
    `Review the drafted reply: ${appUrl}/queue`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      log.error("slack_failed", { http: res.status });
      return { status: "failed", error: `webhook returned ${res.status}` };
    }
    log.info("slack_notified", { lead_id: leadId });
    return { status: "notified" };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log.error("slack_failed", { error });
    return { status: "failed", error };
  }
}
