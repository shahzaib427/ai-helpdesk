# Phase 8 - what was built and how to check it

This phase is unusual compared to the others: most of the data it displays
already existed. `ai_logs` has been recording `intent`, `toolUsed`,
`latencyMs`, `success`, and `retrievedChunks` on every AI turn since Phase 2,
and Phase 6/7 added `handoffReason`. Phase 8 is mostly the act of finally
querying that table and putting real numbers in front of an admin, rather
than generating new data to display. The one genuinely new signal is
sentiment — nothing before this phase classified how a message sounded.

## The honest scope decision: no auto-summarization

The original spec's AI Analytics section also mentions per-conversation
**summaries**. This phase deliberately doesn't build that. Two reasons:
generating a summary means an extra LLM call per conversation (real cost,
not free like everything else this phase reads from existing logs), and
agents already have a working conversation view (Phase 3) where they can
just read the actual messages — a summary would be a convenience layered on
top of something that already works, not something missing. If it turns out
to matter at scale, it's a contained addition to `support_agent.py` later,
not a redesign of anything built here.

## Sentiment: the one new instrumentation this phase adds

Same philosophy as `router.py`'s `is_frustrated()` from Phase 7 — a keyword
list, not a model, and deliberately not customer-facing. It never changes
what the AI says or does (`is_frustrated()` already owns that decision from
Phase 7); it exists purely so the analytics dashboard has something real to
chart instead of an empty column. A wrong classification here costs a
slightly-off chart, which is an acceptable cost for a signal this cheap —
it wouldn't be acceptable for anything that changed behaviour.

**A real bug this phase's own testing caught:** `human_handoff` was an
early return in `handle_message()` (Phase 6/7's structure), which meant it
skipped the sentiment computation sitting at the bottom of the function
entirely. A customer typing "get me a human, this is ridiculous" would have
logged as NEUTRAL sentiment no matter how the message actually read —
silently wrong data feeding directly into this phase's own sentiment chart.
Fixed by restructuring `handle_message()` so every path, including
`human_handoff`, flows through one `context` variable that gets sentiment
applied at the end, rather than some paths returning early past it.
`test_sentiment_is_set_even_on_the_human_handoff_early_return` is the
regression test.

## What "AI resolution" and "human handoff" actually mean here

Worth being precise about, since these are the headline dashboard numbers.
A conversation counts as **human-handled** if its status is currently
`WAITING_AGENT`, or if `assignedAgentId` is set — and `assignedAgentId` is
set once by `takeOver` and never cleared afterward, even after the
conversation resolves, so it's a reliable permanent record rather than
something that could drift back to "AI-only" over time. Everything else
counts as **AI-resolved**. This is a real, queryable definition, not an
estimate — `analyticsService.js`'s `REQUIRED_HUMAN_WHERE` is the one place
it's defined, so changing what counts as "required a human" later means
editing one query, not hunting through several.

## Files and what each one does

### backend/src/models/aiLog.js (extended)
Two new columns: `sentiment` and `handoffReason`. Both nullable — most
`ai_logs` rows won't have a handoff reason (most turns don't escalate), and
older rows from before this phase simply have `null` sentiment rather than
breaking anything.

### backend/src/services/analyticsService.js (new)
Pure aggregation, no writes. `getOverview()` runs five queries in parallel
via `Promise.all` — no reason to wait for the customer count before starting
the ticket count. `getCharts()` does the same for the seven datasets the
two chart-heavy pages need, and reuses `getOverview()`'s numbers for the
AI-vs-human breakdown rather than computing them twice.

Every grouped query (`topIntents`, `toolUsage`, `sentimentDistribution`,
`handoffReasons`, `ticketsByCategory`) follows the same shape: group by a
column, count, order by count descending. Deliberately similar to each
other rather than each hand-optimized differently — a service like this
gets read far more often than it gets changed, so consistency between
functions matters more than shaving a query here or there.

### backend/src/controllers/analyticsController.js, routes/analytics.routes.js (new)
Two endpoints, both admin-only, both read-only: `/overview` for the
dashboard's summary cards, `/charts` for everything chart-shaped. Split
this way (not one giant endpoint) because the dashboard page only needs the
overview plus one chart, while the analytics page needs the rest — no
reason to make the lighter page pay for data it doesn't render.

### frontend/src/components/charts/ (new)
Three small, dependency-free SVG components — `BarChart`, `LineChart`,
`SegmentedBar` — rather than adding a charting library. The original
spec's own code-quality rule ("do not use unnecessary heavy UI libraries")
applied here: bar charts, one line chart, and a couple of proportional
splits don't need Recharts or Chart.js pulled in as a dependency. If the
dashboard grows into something with zoomable, interactive, or animated
charts later, that's the point where a real library earns its weight —
not before.

### frontend/src/pages/admin/Dashboard.jsx and Analytics.jsx (real, replacing placeholders)
These were the last two screens in the entire app still showing a Phase 1
placeholder notice — every other admin screen has been real since its
respective phase landed. `Dashboard.jsx` is the eight summary cards plus
the two charts an admin would check first (conversation volume, AI-vs-human
split). `Analytics.jsx` is everything else: intents, sentiment, tool usage,
handoff reasons, tickets by category — the deeper cuts an admin would look
at when actually investigating something, not just checking the pulse.

## Tests

143 pytest tests total (up from 135 in Phase 7): 5 in `test_sentiment.py`
for the classifier itself, 3 more in `test_support_agent.py` — including
the human-handoff-sentiment regression test described above.

76 Node tests total (up from 72): `analytics.test.js` seeds real data (two
conversations — one AI-only, one that reached an agent — two `ai_logs`
rows with known intent/tool/sentiment/handoff-reason values, one product)
and asserts the aggregation endpoints return numbers that actually match:
`aiResolutions: 1, humanHandoffs: 1` for the two seeded conversations,
`avgResponseTimeMs: 150` for two logged latencies of 100 and 200, and every
chart dataset containing exactly the seeded counts — not approximately
right, exactly right, since these are aggregation queries where an off-by-one
would be easy to introduce and easy to miss without a test that knows the
exact expected numbers going in.

## Commands

```bat
cd backend && npm run dev
cd ai-service && venv\Scripts\activate && uvicorn main:app --reload --port 5001
cd frontend && npm run dev
```

No new environment variables, no new dependencies (the frontend charts are
hand-rolled, not a new package). The two new `ai_logs` columns are picked
up automatically the next time you run `npm run db:sync`, same as every
other schema change so far.

## Manual test walkthrough

1. Run `npm run db:sync` to pick up the new `sentiment` and `handoffReason`
   columns.
2. Have a few real conversations as the seeded customer accounts — ask an
   order question, say "thanks that helped," trigger a Phase 7 escalation
   (a duplicate-charge message, or something frustrated).
3. Sign in as admin, check **Overview** — the numbers should match what you
   just did: conversation count went up, and if you triggered a handoff,
   "Human handoffs" reflects it.
4. Check **AI analytics** — the intent you triggered appears in the bar
   chart, "thanks" shows up as POSITIVE sentiment, and if you triggered a
   tool call, it's in the tool usage chart.
5. Refresh both pages — numbers should be stable (not regenerating
   randomly), since this is real aggregation over real rows, not a demo
   animation.

## Errors you may hit

**Dashboard shows all zeros** — confirm `npm run db:sync` actually ran
after pulling this phase's files; the sentiment/handoffReason columns need
to exist before any new AI turns can populate them, and old `ai_logs` rows
from before this phase legitimately have `null` sentiment.

**Sentiment chart looks wrong for an obviously frustrated message** — check
the exact phrasing against `_NEGATIVE_PATTERNS` in
`app/agents/sentiment.py`; like Phase 7's frustration detector, this is a
keyword list, not a real sentiment model, and unusual phrasing can miss it.
That's a stated, accepted tradeoff, not a bug to chase.

**Node tests fail with a connection error to Postgres** — same
`helpdesk_test` requirement as every previous phase.

## Before starting Phase 9

Confirm: the dashboard's numbers genuinely match what's in the database (not
just "look plausible"); a real conversation with a real escalation shows up
correctly in both the reason breakdown and the priority it created; sentiment
is captured on every AI turn including an explicit handoff request; `npm
test` passes with 76; and `pytest` passes with 143, run more than once.
