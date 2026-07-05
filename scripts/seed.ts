// Seeds realistic demo data. Usage:
//   npm run seed          — insert demo leads (additive)
//   npm run seed:reset    — wipe leads/events/drafts, then seed fresh
//
// Scores are computed with the REAL scoring module against the active
// scoring.config.yaml, so the demo always matches current config behaviour.
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadScoringConfig, scoreLead } from "../src/lib/scoring";

// Standalone scripts don't get Next's .env.local loading — do it minimally.
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnvLocal();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Supabase is not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (see .env.example)"
  );
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

interface SeedLead {
  hoursAgo: number;
  raw: { name: string; email: string; phone?: string; company?: string; message: string };
  extracted: Record<string, unknown> | null; // null = unparsed
  draft?: { subject: string; body: string; status: "pending" | "approved" | "rejected" };
}

const SEEDS: SeedLead[] = [
  {
    hoursAgo: 2,
    raw: {
      name: "Sarah Whitfield",
      email: "sarah.whitfield@example.com",
      phone: "07700 900842",
      message:
        "We need to sell our 4-bed in Didsbury before the school year starts in September — already found a place we want. What would a valuation look like this week? Fees up to about £3k are fine if you can move fast.",
    },
    extracted: {
      parseable: true,
      name: "Sarah Whitfield",
      company: null,
      email: "sarah.whitfield@example.com",
      phone: "07700 900842",
      request_summary: "Wants to sell a 4-bed house in Didsbury and asks for a valuation this week.",
      budget_signals: "fees up to about £3k are fine",
      urgency_signals: "before the school year starts in September; valuation this week",
    },
    draft: {
      subject: "Valuation for your Didsbury home this week",
      body: "Hi Sarah,\n\nThanks for getting in touch — with a September deadline and a property already lined up, moving quickly makes sense. A valuation of your 4-bed in Didsbury is the right first step, and I'll confirm exact times when I reply.\n\nWould an afternoon visit this week suit you?\n\nBest regards,\n[Your name]",
      status: "pending",
    },
  },
  {
    hoursAgo: 7,
    raw: {
      name: "James O'Neill",
      email: "j.oneill@harcourtdev.example.com",
      phone: "07700 900217",
      company: "Harcourt Developments",
      message:
        "We're a small developer with three flats completing next month and want them listed the day they complete. Budget for marketing isn't an issue if the service is right. Call me any time.",
    },
    extracted: {
      parseable: true,
      name: "James O'Neill",
      company: "Harcourt Developments",
      email: "j.oneill@harcourtdev.example.com",
      phone: "07700 900217",
      request_summary: "Developer wants three flats listed immediately on completion next month.",
      budget_signals: "budget for marketing isn't an issue",
      urgency_signals: "completing next month; listed the day they complete",
    },
    draft: {
      subject: "Listing your three flats on completion day",
      body: "Hi James,\n\nThanks for reaching out. Three units completing together is the kind of launch that benefits from being prepared in advance — photography, floor plans and listings ready to go live on completion day.\n\nCould we book a short call this week to walk through the development and timings? I'll follow up afterwards with a launch plan and costs.\n\nBest regards,\n[Your name]",
      status: "approved",
    },
  },
  {
    hoursAgo: 26,
    raw: {
      name: "Priya Sharma",
      email: "priya.sharma@example.com",
      message:
        "Hi, thinking about putting our flat on the market in the next few months. What are your fees? No rush, just gathering information for now.",
    },
    extracted: {
      parseable: true,
      name: "Priya Sharma",
      company: null,
      email: "priya.sharma@example.com",
      phone: null,
      request_summary: "Considering selling a flat in the next few months; asking about fees.",
      budget_signals: "asking about fees",
      urgency_signals: null,
    },
    draft: {
      subject: "Our fees, and a no-obligation valuation when you're ready",
      body: "Hi Priya,\n\nThanks for your message — happy to help while you gather information. I'll send our fee breakdown over in a follow-up so you have it in writing.\n\nWhen you're closer to a decision, a no-obligation valuation is usually the most useful next step: it gives you an accurate asking price to plan around. Would you like me to get in touch nearer the time?\n\nBest regards,\n[Your name]",
      status: "pending",
    },
  },
  {
    hoursAgo: 31,
    raw: {
      name: "Tom Fletcher",
      email: "tom.fletcher@example.com",
      phone: "07700 900555",
      message:
        "Looking to rent out my late mother's house rather than sell. Would want it managed fully. When could someone take a look? This has dragged on a while so keen to get it sorted this month.",
    },
    extracted: {
      parseable: true,
      name: "Tom Fletcher",
      company: null,
      email: "tom.fletcher@example.com",
      phone: "07700 900555",
      request_summary: "Wants to let a house with full management and asks for a viewing/appraisal.",
      budget_signals: null,
      urgency_signals: "keen to get it sorted this month",
    },
    draft: {
      subject: "Letting and fully managing the house — next steps",
      body: "Hi Tom,\n\nThanks for getting in touch, and sorry for the circumstances behind it. Letting with full management is something we can take off your hands — tenancy set-up, referencing, maintenance and rent collection.\n\nThe first step is a rental appraisal at the property. Would an afternoon early next week work for you?\n\nBest regards,\n[Your name]",
      status: "pending",
    },
  },
  {
    hoursAgo: 50,
    raw: {
      name: "Emma Craven",
      email: "emma.craven@example.com",
      message: "How late are you open on Saturdays?",
    },
    extracted: {
      parseable: true,
      name: "Emma Craven",
      company: null,
      email: "emma.craven@example.com",
      phone: null,
      request_summary: "Asking about Saturday opening hours.",
      budget_signals: null,
      urgency_signals: null,
    },
    draft: {
      subject: "Our Saturday opening hours",
      body: "Hi Emma,\n\nThanks for your message. I'll confirm our Saturday opening hours when I reply — and if you're planning a visit, we're happy to book a time that suits you.\n\nIs there anything you'd like to arrange for this weekend?\n\nBest regards,\n[Your name]",
      status: "rejected",
    },
  },
  {
    hoursAgo: 55,
    raw: {
      name: "Dev Test",
      email: "test@example.com",
      message: "asdf asdf qwerty",
    },
    extracted: null, // unparsed — shows the fail-safe path in the demo
  },
];

async function reset() {
  console.log("Resetting demo data…");
  // FK order: events and drafts reference leads.
  const tables = ["events", "reply_drafts", "leads"] as const;
  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .not("id", "is", null); // match-all filter (delete requires one)
    if (error) {
      console.error(`Failed to clear ${table}: ${error.message}`);
      process.exit(1);
    }
  }
}

async function seed() {
  const config = loadScoringConfig();
  console.log(`Seeding ${SEEDS.length} leads (scoring config: ${config.name})…`);

  for (const s of SEEDS) {
    const createdAt = new Date(Date.now() - s.hoursAgo * 3600_000).toISOString();
    const parsed = s.extracted !== null;
    const scored = parsed
      ? scoreLead(s.extracted!, { message: s.raw.message }, config)
      : null;

    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        created_at: createdAt,
        raw: s.raw,
        parsed,
        extracted: s.extracted,
        score: scored?.score ?? null,
        band: scored?.band ?? null,
        scoring_config: parsed ? config.name : null,
      })
      .select("id")
      .single();
    if (error || !lead) {
      console.error(`Failed to insert lead for ${s.raw.name}: ${error?.message}`);
      process.exit(1);
    }

    const events: Array<{ action: string; payload: Record<string, unknown> }> = [
      { action: "received", payload: { source: "web_form", raw: s.raw } },
    ];
    if (parsed) {
      events.push({ action: "extracted", payload: { extracted: s.extracted! } });
      events.push({
        action: "scored",
        payload: { score: scored!.score, band: scored!.band, config: config.name, matched: scored!.matched },
      });
    } else {
      events.push({ action: "extraction_failed", payload: { reason: "not_parseable" } });
    }
    if (s.draft) {
      events.push({ action: "reply_drafted", payload: { subject: s.draft.subject } });
      if (s.draft.status === "approved")
        events.push({ action: "reply_approved", payload: { edited: false } });
      if (s.draft.status === "rejected")
        events.push({ action: "reply_rejected", payload: {} });
    }
    const { error: eventsError } = await supabase
      .from("events")
      .insert(events.map((e) => ({ ...e, lead_id: lead.id, created_at: createdAt })));
    if (eventsError) console.error(`Events insert warning: ${eventsError.message}`);

    if (s.draft) {
      const { error: draftError } = await supabase.from("reply_drafts").insert({
        created_at: createdAt,
        lead_id: lead.id,
        status: s.draft.status,
        subject: s.draft.subject,
        body: s.draft.body,
        decided_at: s.draft.status === "pending" ? null : createdAt,
      });
      if (draftError) console.error(`Draft insert warning: ${draftError.message}`);
    }

    console.log(
      `  ${s.raw.name}: ${parsed ? `${scored!.score} / ${scored!.band}` : "unparsed"}${s.draft ? ` (draft ${s.draft.status})` : ""}`
    );
  }
  console.log("Done. View at /leads and /queue.");
}

async function main() {
  if (process.argv.includes("--reset")) await reset();
  await seed();
}

main().catch((err) => {
  console.error(`Seed failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
