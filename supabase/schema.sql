-- P1 Lead Qualifier — run this in the Supabase SQL editor (once per project).

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  raw jsonb not null,            -- original form submission, always stored
  parsed boolean not null default false,
  extracted jsonb,               -- fixed-schema extraction (null if unparsed)
  score integer,
  band text check (band in ('hot', 'warm', 'cold')),
  scoring_config text            -- name of the config that produced the score
);

-- Append-only audit trail: every pipeline action writes a row.
create table if not exists events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  lead_id uuid references leads(id),
  action text not null,          -- received | extracted | extraction_failed | scored
  payload jsonb
);

create index if not exists leads_created_at_idx on leads (created_at desc);
create index if not exists events_lead_id_idx on events (lead_id);
