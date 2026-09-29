# Phase 7 - what was built and how to check it

Phase 2 built the explicit handoff (the "Ask for a human" button). Phase 6
added one automatic trigger — the AI recognising "I want to talk to a
human" as text, not just a button click. Phase 7 is the rest of the
original spec's escalation list: a question the AI genuinely can't answer, a
sensitive payment issue, and a frustrated customer — each escalating
automatically, through the same tested path, with a ticket priority that
actually reflects how urgent the situation is.

## What triggers a handoff now

| Trigger | `handoff_reason` | Ticket priority | Still answers the question? |
|---|---|---|---|
| "I want to talk to a human" | `explicit_request` | MEDIUM | No — acknowledges and hands off |
| A `knowledge_question` with no matching document | `no_confident_answer` | MEDIUM | N/A — there was no answer to give |
| "I was charged twice for order 4021" | `sensitive_refund` | URGENT | **Yes** — looks up the order, answers, escalates too |
| A tool lookup fails and won't succeed on retry | `tool_failure` | HIGH | No — the lookup itself failed |
| "this is ridiculous, where is my order" | `customer_frustration` | HIGH | **Yes** — answers the order question, escalates too |

The last two rows matter: escalating doesn't mean giving up on the
customer's actual question. A frustrated customer asking about a real order
still gets a real answer about that order — a human just gets looped in
alongside it, so nothing falls through the cracks either way.

What deliberately does *not* escalate: ordinary conversation ("hello",
"thanks") that has no matching document, because that's normal — a greeting
was never going to match a policy document, and treating every unmatched
"hi" as an AI failure would flood the agent queue with nothing to actually
do.

## The design question this phase had to answer: how much state?

"Repeatedly dissatisfied" (the original spec's phrase) implies looking
across multiple messages, not just one. Full conversation-state tracking —
counting failed attempts, detecting a customer asking the same thing three
times — was the tempting direction, but it's real complexity for a signal
that a single-message frustration check already catches most of in
practice: someone who's been going in circles for three messages usually
says something like "this still isn't working" on the third one, which the
keyword check already catches. Phase 7 deliberately took the simpler,
single-message signal and left true multi-turn dissatisfaction tracking
out, rather than half-build a state machine. If it turns out to matter in
practice, it's a clean addition later — `is_frustrated()` in
`router.py` is the one function that would grow, not a redesign.

## Files and what each one does

### ai-service/app/agents/router.py (extended)
Two new functions, deliberately **not** new intents — `is_sensitive_payment_issue()`
and `is_frustrated()` are orthogonal signals that can apply to any intent,
not categories a message gets sorted into. A frustrated customer can be
asking about literally anything; making frustration its own intent would
have meant either losing the underlying question's intent or awkwardly
double-classifying every message.

`is_sensitive_payment_issue()` is narrower than the existing refund-request
detection — specifically a payment *error* ("charged twice," "duplicate
charge"), not just "I'd like my money back." This is what lets a genuine
double-charge get treated as urgent while an ordinary refund question
doesn't, matching the knowledge base's own stated policy that duplicate
charges are handled within one working day.

`is_frustrated()` is a keyword list, explicitly not a sentiment model —
real sentiment analysis is Phase 8's job (AI analytics), and building a
second, cruder version of it here would have been redundant scope. This one
is only precise enough to catch clear frustration, not to score how upset
someone is on a scale.

### ai-service/app/agents/support_agent.py (extended)
Two changes to the orchestration:

1. `_handle_knowledge_or_general()` now escalates when the intent was
   specifically `knowledge_question` and retrieval found nothing — the AI
   admitting it doesn't know, made into an actual escalation instead of
   just a sentence saying so. `general_conversation` intent doesn't get this
   treatment, on purpose (see above).
2. `_handle_refund_request()` checks `is_sensitive_payment_issue()`
   independently of whether the order lookup succeeds — a duplicate-charge
   complaint escalates whether or not `get_refund_status` finds the order,
   because the payment issue itself is what's urgent, not whether the
   order happens to exist.
3. `handle_message()` gained a frustration overlay, applied *after* the
   intent-specific handler runs: `is_frustrated(message) and not
   context.handoff_required`. The `and not` matters — if the handler
   already set a more specific reason (`sensitive_refund`, `tool_failure`),
   frustration doesn't silently overwrite it. `test_frustration_does_not_override_a_more_specific_reason`
   is the test that would catch a regression here.

### backend/src/services/conversationService.js (`transitionToHuman` rewritten)
Previously took no parameters beyond the conversation itself; now takes an
optional `reason`, looked up in a small `HANDOFF_REASONS` table that maps
each reason to a customer-facing SYSTEM message, a ticket priority, and a
category. `null` (the Phase 2 explicit-button case) falls back to the same
mapping as `explicit_request`.

One addition worth knowing about: if a conversation is already
`WAITING_AGENT` and a *second*, more urgent reason arrives (the customer
was already escalated for one thing, then says something that triggers a
higher-priority reason), the existing ticket's priority gets raised rather
than creating a second ticket or leaving it stuck at the original, lower
priority. `priorityRank()` is the small helper that makes "more urgent than"
comparable.

## Tests

135 pytest tests total (up from 123 in Phase 6): 4 new in `test_router.py`
for the two detection functions, 8 new in `test_support_agent.py` for the
escalation logic — including the priority test
(`test_frustration_does_not_override_a_more_specific_reason`) and a test
that a frustrated customer's actual question still gets answered
(`test_frustration_escalates_while_still_answering_the_question`).

72 Node tests total (up from 63): `handoff-reasons.test.js`'s 9 tests are
new, mocking the AI client directly (unlike `conversations.test.js`, which
relies on the AI service being genuinely absent to test the fallback path —
these tests need to control exactly which `handoff_reason` comes back, so
they mock it deliberately). Covers every reason's priority/category
mapping, an unrecognised future reason falling back safely rather than
crashing, the SYSTEM message actually explaining *why* (not just logging a
generic "moved to queue" for every reason), and the priority-raising
behaviour when a second reason arrives after a ticket already exists.

No new bugs were caught by this phase's own tests the way Phase 6's were —
worth stating plainly rather than manufacturing drama, since not every
phase's testing surfaces a bug, and that's fine. The discipline (run the
full suite repeatedly, not once) continued the same way regardless.

## Commands

```bat
cd backend && npm run dev
cd ai-service && venv\Scripts\activate && uvicorn main:app --reload --port 5001
cd frontend && npm run dev
```

No new environment variables, no new dependencies, no frontend changes —
this phase is entirely backend/AI-service logic. The existing chat UI
already renders whatever the AI hands back; a HIGH or URGENT ticket looks
exactly like any other ticket in the existing Tickets screens, just with a
different priority badge.

## Manual test walkthrough

1. Ask a policy question the knowledge base genuinely doesn't cover (upload
   the seed documents first if you haven't, then ask about something they
   don't address — "do you offer gift wrapping?"). Conversation moves to
   the human queue with no button click. Check the ticket: MEDIUM.
2. Say "I was charged twice for order 5012" (a real seeded order number).
   The AI still tells you the order's actual status — check the reply
   names `get_refund_status` — *and* the conversation escalates
   immediately. Check the ticket: URGENT, category billing.
3. Say something like "this is ridiculous, still not fixed, where is order
   5012" — escalates as HIGH, and the reply still answers the order
   question.
4. As an agent, open each escalated conversation — the SYSTEM message
   explains why differently for each one, not a single generic line.
5. Say "hi" with no documents uploaded — does not escalate. Ordinary
   conversation isn't a failure.

## Errors you may hit

**A frustrated-sounding message doesn't escalate** — check the exact
phrasing against `_FRUSTRATION_PATTERNS` in `router.py`; this is a keyword
list, not a real sentiment model, so unusual phrasing can miss it. That's
an accepted tradeoff (see above), not a bug to chase down.

**A duplicate-charge message doesn't get URGENT priority** — confirm it
actually contains the payment-error phrasing ("charged twice," "double
charged," "duplicate charge"), not just "refund" — a plain refund request
without payment-error language is deliberately not treated as urgent.

**Node tests fail with a connection error to Postgres** — same
`helpdesk_test` requirement as every previous phase; nothing changed there.

## Before starting Phase 8

Confirm: a genuinely unanswerable knowledge question escalates on its own; a
duplicate-charge complaint gets URGENT priority while still getting
answered; a frustrated customer's real question still gets a real answer
alongside the escalation; ordinary small talk never escalates just for
lacking a document match; `npm test` passes with 72; and `pytest` passes
with 135, run more than once.
