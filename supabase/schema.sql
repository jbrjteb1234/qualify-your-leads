-- P1 Lead Qualifier — run this in the Supabase SQL editor (once per project).
-- Idempotent: safe to re-run.

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  raw jsonb not null,            -- original form submission, always stored
  parsed boolean not null default false,
  extracted jsonb,               -- fixed-schema extraction (null if unparsed)
  score integer,
  band text check (band in ('hot', 'warm', 'cold')),
  scoring_config text,           -- name of the config that produced the score
  hubspot_contact_id text        -- set once pushed to HubSpot (M2)
);

-- Append-only audit trail: every pipeline action writes a row.
create table if not exists events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  lead_id uuid references leads(id),
  action text not null,          -- received | extracted | extraction_failed | scored
                                 -- | hubspot_pushed | hubspot_skipped | hubspot_failed
                                 -- | reply_drafted | reply_draft_failed
                                 -- | slack_notified | slack_skipped | slack_failed
                                 -- | reply_approved | reply_rejected
  payload jsonb
);

-- Drafted first replies awaiting a human decision (M2). NOTHING sends
-- automatically: 'approved' means a human signed the text off; the reply is
-- then sent by the human from their own inbox.
create table if not exists reply_drafts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id uuid not null references leads(id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  subject text not null,
  body text not null,            -- current draft text (may be human-edited)
  decided_at timestamptz
);

create index if not exists leads_created_at_idx on leads (created_at desc);
create index if not exists events_lead_id_idx on events (lead_id);
create index if not exists reply_drafts_status_idx on reply_drafts (status, created_at desc);

-- Row Level Security: the app only ever uses the service-role key server-side
-- (which bypasses RLS), so enabling RLS with no policies costs nothing — and
-- it means the project's anon key exposes NOTHING via Supabase's auto-generated
-- REST API. Do not add policies until a client-side key is deliberately introduced.
alter table leads enable row level security;
alter table events enable row level security;
alter table reply_drafts enable row level security;

-- Already ran the M1 version of this file? The statements above are additive
-- and idempotent, EXCEPT the leads.hubspot_contact_id column — add it with:
--   alter table leads add column if not exists hubspot_contact_id text;
