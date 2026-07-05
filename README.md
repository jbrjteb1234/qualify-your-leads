# Never lose or slow-reply a lead again

**AI lead intake and qualification for small businesses — every enquiry caught,
scored and answered with a human-approved draft in minutes, not mornings.**

**Live demo:** <https://qualify-your-leads.vercel.app> — submit an enquiry,
then watch it scored at [/leads](https://qualify-your-leads.vercel.app/leads)
with its drafted reply at [/queue](https://qualify-your-leads.vercel.app/queue).

[2-minute demo video — coming soon]

## The problem

Enquiries arrive at 8pm, on Saturdays, while you're on a job. By the time
someone replies the next morning, the enquirer has heard back from a
competitor. Leads live in three inboxes, nobody owns them, and the expensive
ones look identical to the tyre-kickers until someone reads every message.

## What this does about it

The moment an enquiry arrives:

1. **Caught** — stored safely with a full audit trail, even if the message is
   half-garbled. Nothing is ever silently dropped.
2. **Understood** — AI reads the message and pulls out what matters: what they
   want, budget mentions, urgency signals, contact details.
3. **Scored** — your rules (not the AI's mood) turn those signals into a score
   and a band: **hot / warm / cold**. The rules live in one config file, so
   changing what "hot" means for your business takes minutes, not a developer.
4. **Filed** — pushed to HubSpot as a contact with a qualification note.
5. **Drafted** — a personalised first reply is written and held in an approval
   queue. **Nothing sends without a human clicking Approve** — that's the
   default and it isn't optional.
6. **Flagged** — hot leads ping your Slack immediately, with a link straight
   to the waiting draft.

## What that's worth

Do the six-second version of the maths for your own numbers: if an average won
job is worth £2,000 and slow replies cost you just one enquiry a month, that's
£24,000 a year leaking out of a shared inbox. Replying first is the cheapest
sales advantage there is — this system makes first-reply-in-minutes your
default, without hiring anyone and without letting an AI speak for you
unreviewed.

**Before:** enquiry at 8pm → seen at 9:30am → generic "thanks, we'll be in
touch" by 11am.
**After:** enquiry at 8pm → scored, filed in the CRM and Slack-pinged by
8:01pm → personalised reply approved and sent from your phone by 8:05pm.

## How it fits together

```
        Enquiry (web form)
              │
              ▼
   ┌─────────────────────┐     store raw first — nothing can be lost
   │  Intake API          │───► Supabase: leads + append-only events
   └─────────┬───────────┘
             ▼
   ┌─────────────────────┐     fixed schema: request, budget & urgency signals
   │  Claude extraction   │───► unparseable? kept safely as "unparsed"
   └─────────┬───────────┘
             ▼
   ┌─────────────────────┐     rules in scoring.config.yaml — swap per client,
   │  Scoring (your rules)│     zero code changes
   └─────────┬───────────┘
      ┌──────┴──────┬──────────────┐
      ▼             ▼              ▼
  HubSpot       Reply draft    Slack ping
  contact+note  → APPROVAL     (hot leads only)
                  QUEUE
                  human approves / edits / rejects — nothing sends itself
```

## Fixed prices

- **Starter — £450:** web-form intake, scoring set up for your business,
  HubSpot push, approval queue. Delivered in one week.
- **Standard — £950:** everything in Starter + Slack hot-lead alerts, a custom
  scoring workshop, and an email intake channel built for your inbox as part
  of the engagement.
- **Pro — £1,800:** everything in Standard + a hand-prepared weekly lead
  summary and a monthly scoring tuning call for your first quarter.
- **Retainer — £150–£300/mo:** monitoring, fixes and scoring tweaks.

Common questions: *"Will it reply with something wrong?"* — it can't; nothing
sends without human approval, and the demo shows exactly that. *"Where does
our data live?"* — in your own Supabase and HubSpot accounts; nothing is used
to train AI models, and deletion is a request away.

## Run it locally

1. `npm install`
2. Create a free [Supabase](https://supabase.com) project and run `supabase/schema.sql` in its SQL editor
3. `cp .env.example .env.local` and fill in the values (HubSpot and Slack are optional — the pipeline skips them gracefully)
4. `npm run dev`
5. Submit an enquiry at <http://localhost:3000> — watch it appear scored at `/leads`, with its drafted reply at `/queue`

**Demo data:** `npm run seed:reset` loads realistic sample leads across all
bands (including one deliberately garbled enquiry showing the fail-safe path).

**No keys yet?** Set `DRY_RUN=true` in `.env.local` — submitting the form
returns the exact AI request it would have sent: full prompt preview, zero
cost, no accounts needed.

**Swap scoring per client:** replace `scoring.config.yaml` with a file from
`config-examples/` — `npm run test:scoring -- config-examples/clinic.yaml`
shows the same enquiry scoring differently under different business rules.

Built with Next.js, Supabase and Claude. Everything runs on free tiers except
AI usage (one to two pence per enquiry on the default model, measured live —
every call's exact cost is logged).
