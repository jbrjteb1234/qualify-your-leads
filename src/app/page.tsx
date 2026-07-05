"use client";

import { useState, type FormEvent } from "react";

type Result =
  | { kind: "success"; id: string }
  | { kind: "dry_run"; wouldSend: unknown }
  | { kind: "error"; message: string; fieldErrors?: Record<string, string> };

const inputStyle = { display: "block", width: "100%", padding: "0.4rem", marginTop: "0.2rem" };

export default function IntakeForm() {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (res.ok && json.dry_run) {
        // Keep the form filled so the prompt can be tweaked and resubmitted.
        setResult({ kind: "dry_run", wouldSend: json.would_send });
      } else if (res.ok) {
        setResult({ kind: "success", id: json.id });
        form.reset();
      } else if (json.errors) {
        setResult({
          kind: "error",
          message: "Please fix the highlighted fields.",
          fieldErrors: json.errors,
        });
      } else {
        setResult({ kind: "error", message: json.error ?? `Something went wrong (${res.status})` });
      }
    } catch {
      setResult({ kind: "error", message: "Could not reach the server — please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  const fieldErrors = result?.kind === "error" ? (result.fieldErrors ?? {}) : {};

  return (
    <main>
      <h1>Get in touch</h1>
      <p>Tell us what you need and we&apos;ll get back to you.</p>
      <form onSubmit={onSubmit}>
        <label>
          Name *
          <input name="name" style={inputStyle} />
          {fieldErrors.name && <span style={{ color: "crimson" }}>{fieldErrors.name}</span>}
        </label>
        <label style={{ display: "block", marginTop: "0.8rem" }}>
          Email *
          <input name="email" style={inputStyle} />
          {fieldErrors.email && <span style={{ color: "crimson" }}>{fieldErrors.email}</span>}
        </label>
        <label style={{ display: "block", marginTop: "0.8rem" }}>
          Phone
          <input name="phone" style={inputStyle} />
        </label>
        <label style={{ display: "block", marginTop: "0.8rem" }}>
          Company
          <input name="company" style={inputStyle} />
        </label>
        <label style={{ display: "block", marginTop: "0.8rem" }}>
          Message *
          <textarea name="message" rows={5} style={inputStyle} />
          {fieldErrors.message && <span style={{ color: "crimson" }}>{fieldErrors.message}</span>}
        </label>
        <button type="submit" disabled={submitting} style={{ marginTop: "1rem", padding: "0.5rem 1.5rem" }}>
          {submitting ? "Sending…" : "Send enquiry"}
        </button>
      </form>

      {result?.kind === "success" && (
        <p style={{ color: "seagreen", marginTop: "1rem" }}>
          Thanks — your enquiry has been received. <small>(ref {result.id.slice(0, 8)})</small>
        </p>
      )}
      {result?.kind === "dry_run" && (
        <div style={{ marginTop: "1rem" }}>
          <p style={{ color: "darkorange" }}>
            Dry run — nothing was stored or sent to Claude. This is the exact request the
            pipeline would send:
          </p>
          <pre
            style={{
              background: "#f5f5f5",
              padding: "1rem",
              overflowX: "auto",
              fontSize: "0.8rem",
              whiteSpace: "pre-wrap",
            }}
          >
            {JSON.stringify(result.wouldSend, null, 2)}
          </pre>
        </div>
      )}
      {result?.kind === "error" && (
        <p style={{ color: "crimson", marginTop: "1rem" }}>{result.message}</p>
      )}
    </main>
  );
}
