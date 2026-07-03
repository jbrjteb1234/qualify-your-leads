import { getSupabase, SupabaseNotConfiguredError } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface LeadRow {
  id: string;
  created_at: string;
  raw: { name?: string; company?: string };
  extracted: { name?: string | null; company?: string | null } | null;
  score: number | null;
  band: string | null;
}

const cell = { padding: "0.4rem 0.8rem", borderBottom: "1px solid #ddd", textAlign: "left" as const };

export default async function LeadsPage() {
  let leads: LeadRow[];
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("leads")
      .select("id, created_at, raw, extracted, score, band")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    leads = (data ?? []) as LeadRow[];
  } catch (err) {
    const message =
      err instanceof SupabaseNotConfiguredError
        ? err.message
        : `Could not load leads: ${err instanceof Error ? err.message : String(err)}`;
    return (
      <main>
        <h1>Leads</h1>
        <p style={{ color: "crimson" }}>{message}</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Leads</h1>
      {leads.length === 0 ? (
        <p>No leads yet — submit one via the intake form.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={cell}>Name</th>
              <th style={cell}>Company</th>
              <th style={cell}>Score</th>
              <th style={cell}>Band</th>
              <th style={cell}>Received</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td style={cell}>{lead.extracted?.name ?? lead.raw?.name ?? "—"}</td>
                <td style={cell}>{lead.extracted?.company ?? lead.raw?.company ?? "—"}</td>
                <td style={cell}>{lead.score ?? "—"}</td>
                <td style={cell}>{lead.band ?? "unparsed"}</td>
                <td style={cell}>{new Date(lead.created_at).toLocaleString("en-GB")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
