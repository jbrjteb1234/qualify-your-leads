# DEMO.md — Loom script (target: 2m30s)

**Recorded 2026-07-12:** https://www.loom.com/share/375e3a6a34fc406e903bffbf9209987d

**Prep before recording:** `npm run seed:reset`, dev server running, HubSpot
contacts view open in a second tab, Slack channel visible (or screenshot ready),
browser at the intake form. Close everything else. Full screen, cursor visible.

---

**[0:00–0:15] The hook — talk over the intake form**

> "Every small business loses leads the same way: the enquiry arrives at 8pm,
> nobody sees it until morning, and by then they've booked a competitor. This
> is a system that catches, scores and answers every enquiry in about a
> minute — with a human approving every reply. Watch."

**[0:15–0:45] Submit a live enquiry**

Fill the form as you talk — name, email, phone, and a message with money and
urgency in it, e.g. *"We need to sell our 3-bed quickly — already found a
place. Budget around £2k for fees. Call me anytime."* Click send.

> "That message mentions a budget, a deadline, and selling — a real buyer.
> Let's see what the system did with it."

**[0:45–1:15] The scored lead list**

Open `/leads`. Point at the new row at the top: score, red **HOT** band.

> "Seconds later: it's read the message, pulled out the budget and urgency
> signals, and scored it hot — using rules from a plain config file, not AI
> guesswork. Different business, different rules: for a clinic, 'in pain,
> wants an appointment this week' is what scores hot. Swapping that config
> takes two minutes per client."

Scroll to the deliberately garbled seed lead.

> "And when someone submits keyboard mash? Stored safely as unparsed — nothing
> ever crashes or disappears."

**[1:15–1:45] HubSpot**

Switch to the HubSpot tab, show the contact and the qualification note.

> "It's also filed the lead in HubSpot automatically — contact created, with a
> note carrying the score, the summary and the original message. Your CRM
> stays the single source of truth without anyone doing data entry."

**[1:45–2:20] The approval queue — the closer**

Open `/queue`. Show the drafted reply for the hot lead. Edit one word.

> "Here's the part buyers ask about first: the AI drafted a personalised
> reply — references their house, their timescale, proposes a valuation slot.
> But it hasn't gone anywhere. Nothing sends itself, ever. I can edit it…
> approve it… and NOW it opens in my email client, from my address, under my
> name. Human judgement, machine speed."

Click Approve, show the mailto opening. If Slack is wired, flash the hot-lead
ping: *"and the Slack alert landed the moment it was scored."*

**[2:20–2:35] Close on the audit trail + price**

Show the events table in Supabase (or describe over `/leads`).

> "Every step is logged — received, extracted, scored, filed, drafted,
> approved. Setup is fixed-price from £450, delivered in a week, running on
> your own accounts. If you reply to leads in the morning, this is the
> cheapest revenue you'll ever recover. Link's below — send me one line about
> how enquiries reach you today, and I'll show you this running on them."

---

**Rules while recording:** never claim client results we don't have; the ROI
framing is always "your number