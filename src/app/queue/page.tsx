import { createLogger } from "@kit/logger";
import { getSupabase, SupabaseNotConfiguredError } from "@/lib/supabase";
import { DraftCard, type QueueDraft } from "./DraftCard";

export const dynamic = "force-dynamic";

const log = createLogger("page.queue");

interface DraftRow {
  id: string;
  created_at: string;
  status: string;
  subject: string;
  body: string;
  decided_at: string | null;
  leads: {
    id: string;
    raw: { name?: string; email?: string; message?: string };
    extracted: {
      name?: string | null;
      email?: string | null;
      company?: string | null;
      request_summary?: string | null;
    } | null;
    score: number | null;
    band: string | null;
  } | null;
}

function toQueueDraft(row: DraftRow): QueueDraft {
  const lead = row.leads;
  return {
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    subject: row.subject,
    body: row.body,
    leadName: lead?.extracted?.name ?? lead?.raw?.name ?? "Unknown",
    // The reply recipient is the address the enquirer TYPED into the form —
    // never the extracted one, which message text can influence.
    leadEmail: lead?.raw?.email ?? "",
    extractedEmail: lead?.extracted?.email ?? null,
    company: lead?.extracted?.company ?? null,
    requestSummary: lead?.extracted?.request_summary ?? lead?.raw?.message ?? null,
    score: lead?.score ?? null,
    band: lead?.band ?? null,
  };
}

export default async function QueuePage() {
  let pending: QueueDraft[];
  let decided: QueueDraft[];
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("reply_drafts")
      .select(
        "id, created_at, status, subject, body, decided_at, leads (id, raw, extracted, score, band)"
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as DraftRow[];
    pending = rows.filter((r) => r.status === "pending").map(toQueueDraft);
    decided = rows.filter((r) => r.status !== "pending").slice(0, 10).map(toQueueDraft);
  } catch (err) {
    // Real error to the server log; generic message to the (public) page.
    log.error("queue_page_load_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    const message =
      err instanceof SupabaseNotConfiguredError
        ? err.message
        : "Could not load the queue — please try again shortly.";
    return (
      <main>
        <h1>Approval queue</h1>
        <p style={{ color: "crimson" }}>{message}</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Approval queue</h1>
      <p>
        Drafted first replies wait here. Nothing is ever sent automatically — approve
        releases the text for you to send from your own inbox.
      </p>

      {pending.length === 0 ? (
        <p style={{ color: "#666" }}>
          Queue is clear — no replies waiting for approval. New enquiries appear here
          moments after they arrive.
        </p>
      ) : (
        pending.map((draft) => <DraftCard key={draft.id} draft={draft} />)
      )}

      {decided.length > 0 && (
        <>
          <h2 style={{ marginTop: "2rem", fontSize: "1.1rem" }}>Recent decisions</h2>
          <ul>
            {decided.map((d) => (
              <li key={d.id}>
                <strong>{d.status}</strong> — {d.leadName}: “{d.subject}”
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
