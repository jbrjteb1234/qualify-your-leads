# Lead Intake & Qualification Agent — M1

Intake form → Claude extraction → config-driven scoring → Supabase, with a bare
list view. (README becomes a proper sales page at M3.)

## Local setup

1. `npm install`
2. Create a free [Supabase](https://supabase.com) project and run `supabase/schema.sql` in its SQL editor
3. `cp .env.example .env.local` and fill in the four values
4. `npm run dev`
5. Submit an enquiry at <http://localhost:3000> — it appears scored at <http://localhost:3000/leads>

Scoring rules live in `scoring.config.yaml`. Swap it for a file from
`config-examples/` to change scoring behaviour with zero code changes:
`npm run test:scoring -- config-examples/clinic.yaml` shows the same enquiry
scoring differently per config.
