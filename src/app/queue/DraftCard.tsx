"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface QueueDraft {
  id: string;
  createdAt: string;
  status: string;
  subject: string;
  body: string;
  leadName: string;
  /** The address the enquirer typed into the form — the reply recipient. */
  leadEmail: string;
  /** Address the AI read out of the message text, shown only as context. */
  extractedEmail: string | null;
  company: string | null;
  requestSummary: string | null;
  score: number | null;
  band: string | null;
}

const bandColour: Record<string, string> = {
  hot: "#c0392b",
  warm: "#e67e22",
  cold: "#7f8c8d",
};

export function DraftCard({ draft }: { draft: QueueDraft }) {
  const router = useRouter();
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvedMailto, setApprovedMailto] = useState<string | null>(null);

  async function decide(action: "approve" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/drafts/${draft.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "approve" ? { action, subject, body } : { action }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `Decision failed (${res.status})`);
        return;
      }
      if (action === "approve" && draft.leadEmail) {
        setApprovedMailto(
          `mailto:${encodeURIComponent(draft.leadEmail)}?subject=${encodeURIComponent(
            subject
          )}&body=${encodeURIComponent(body)}`
        );
      } else {
        router.refresh();
      }
    } catch {
      setError("Could not reach the server — please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (approvedMailto) {
    return (
      <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: "1rem", marginTop: "1rem" }}>
        <p style={{ color: "seagreen" }}>
          Approved. Send it yourself:{" "}
          <a href={approvedMailto}>open in your email client</a> or copy the text below.
        </p>
        <pre style={{ whiteSpace: "pre-wrap", background: "#f5f5f5", padding: "0.8rem" }}>{body}</pre>
        <button onClick={() => router.refresh()} style={{ padding: "0.3rem 1rem" }}>
          Done
        </button>
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: "1rem", marginTop: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
        <strong>
          {draft.leadName}
          {draft.company ? ` — ${draft.company}` : ""}
        </strong>
        {draft.band && (
          <span style={{ color: bandColour[draft.band] ?? "#333", fontWeight: 600 }}>
            {draft.band.toUpperCase()}
            {draft.score !== null ? ` (${draft.score})` : ""}
          </span>
        )}
      </div>
      {draft.requestSummary && (
        <p style={{ color: "#555", fontSize: "0.9rem" }}>{draft.requestSummary}</p>
      )}
      <p style={{ fontSize: "0.85rem", color: "#555", margin: "0.3rem 0" }}>
        Reply to: <strong>{draft.leadEmail || "no address on the form"}</strong>
        {draft.extractedEmail && draft.extractedEmail !== draft.leadEmail && (
          <span style={{ color: "darkorange" }}>
            {" "}
            — note: the message text mentions a different address ({draft.extractedEmail})
          </span>
        )}
      </p>
      <label style={{ display: "block", marginTop: "0.5rem", fontSize: "0.9rem" }}>
        Subject
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          style={{ display: "block", width: "100%", padding: "0.4rem", marginTop: "0.2rem" }}
        />
      </label>
      <label style={{ display: "block", marginTop: "0.5rem", fontSize: "0.9rem" }}>
        Reply (edit before approving if needed)
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          style={{ display: "block", width: "100%", padding: "0.4rem", marginTop: "0.2rem" }}
        />
      </label>
      <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.6rem" }}>
        <button onClick={() => decide("approve")} disabled={busy} style={{ padding: "0.4rem 1.2rem" }}>
          {busy ? "Working…" : "Approve"}
        </button>
        <button onClick={() => decide("reject")} disabled={busy} style={{ padding: "0.4rem 1.2rem" }}>
          Reject
        </button>
      </div>
      {error && <p style={{ color: "crimson", marginTop: "0.5rem" }}>{error}</p>}
    </div>
  );
}
