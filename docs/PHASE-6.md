# Phase 6 - what was built and how to check it

This is the phase where the AI stops just talking and starts doing things.
Phase 5 could answer questions from documents; Phase 6 can look up a real
order, check a real ticket, search the real product catalog, and open a real
ticket — all without the AI ever touching Postgres. Every one of those
actions goes through a narrow internal API that exists for exactly this and
nothing else.

## The big design decision: rule-based routing, not LLM function-calling

Many "AI agent" tutorials have the model itself decide which function to
call, via the provider's native function-calling API. This project doesn't
do that, on purpose. The router (`app/agents/router.py`) is plain pattern
matching — regexes and keyword sets, no LLM call involved in deciding what
to do.

Three reasons:

1. **It works identically with the echo provider.** Function-calling is a
   capability of a real model; echo doesn't have one. A router that needs a
   real LLM to decide what to do would mean Phase 6 couldn't be verified at
   all without an API key — breaking the zero-budget-first approach every
   phase so far has held to.
2. **It's free.** No extra API round-trip just to classify a message before
   answering it.
3. **It's fully deterministic and testable.** The same message always
   classifies the same way. An LLM-based classifier would need its own
   flakiness handling — the same kind Phase 5's embedding-similarity tests
   needed — for no real benefit at this project's scale.

The tradeoff, stated plainly: a hand-written pattern set will always have
edge cases a real intent model wouldn't. Two were found and fixed during
this phase's own testing (see below) — that's not a hidden flaw, it's the
expected cost of the tradeoff, made visible by actually testing for it.

## The internal API: how the AI reaches real data without a login

The AI service has no user session — it can't carry a JWT the way a browser
request does. `backend/src/routes/internal.routes.js` is the alternative: a
small router, mounted at `/api/internal`, guarded by a shared secret
(`X-Internal-Api-Key`) instead of `requireAuth`. It exposes exactly five
endpoints, each one shaped around a tool, not around "give the AI service
general API access":

- `GET /orders/by-number/:orderNumber?customerId=`
- `GET /orders?customerId=&limit=`
- `GET /products?search=&limit=`
- `POST /tickets`
- `GET /tickets/:id?customerId=`

Every order and ticket lookup requires a `customerId` and enforces that the
resource actually belongs to that customer, the same ownership check the
public API enforces via `req.user` — just expressed as an explicit parameter
instead of a session, because there is no session. A rogue prompt asking
about a different customer's order number by guessing a number gets a 404,
identically to what a browser request would get.

Products have no such check — the catalog is public information, so
`get_product_information` needs nothing beyond the internal key itself.

## Files and what each one does

### backend/src/middleware/internalAuth.js (new)
Deliberately separate from `requireAuth`, not a special "service" role
bolted onto the user table. There is no user behind an AI-service request at
all — modelling it as one would be more confusing, not less.

### backend/src/routes/internal.routes.js (new)
The five endpoints above. Thin — each one either scopes an existing service
function by `customerId` or calls a small new variant of one
(`getByOrderNumberForCustomer`, `listForCustomerId`, `createForCustomerId`,
`getForCustomerId` — added to `orderService.js` and `ticketService.js` this
phase, alongside the existing user-scoped functions, not replacing them).

### ai-service/app/agents/router.py (new)
`classify()` returns an intent plus whatever entity the message contains (an
order number, a ticket number). Checked in a specific, deliberate order:
`human_handoff` first (an explicit request for a person should win over
everything else), then `knowledge_question` — and that ordering is the fix
for one of the two real bugs this phase's tests caught:

**Bug 1 — priority ordering.** "What is your return policy?" was originally
classified as `return_request`, the same intent as "I want to return this
item," purely because both sentences contain the word "return." Fixed by
checking explicit policy-question phrasing (`what is your`, `how do i`,
`policy`, `hours`, etc.) before the action-keyword checks. Both intents
currently route to the same handler behaviourally, so this didn't change
what the customer saw — but it matters for the intent labels Phase 8's
analytics will be built on, and it was the kind of bug that's invisible
until you write a test for the exact phrasing a real customer would use.

**Bug 2 — a regex word-boundary mistake.** `\bheadphone\b` doesn't match
"headphones" — `\b` requires a non-word character immediately after
"headphone," and "s" is a word character, so the plural silently never
matched. "Does the Aria headphones work with Android?" was falling through
to `general_conversation` instead of `product_question`. Fixed by adding
optional plurals (`headphones?`) to every product keyword that needed it.

Both bugs were caught by actually running `pytest`, not by inspection —
`test_router.py` is where to look for the tests that caught them.

### ai-service/app/tools/ (new package)
`base.py` is the one place every tool goes through to reach Node — it
attaches the internal API key, handles timeouts, and turns a 404 into
`{"found": False}` rather than an exception, since "nothing matched" is a
normal outcome a tool's caller needs to handle gracefully, not an error.
`order_tools.py`, `product_tools.py`, and `ticket_tools.py` implement the six
required tools; each validates its own inputs (a non-numeric order number,
an empty search query, a missing customer id) before ever making a network
call.

`get_refund_status` is worth calling out: there's no separate refund record
in this project's schema, so it reuses `get_order_status`'s data and
interprets the order's own `status` field (`REFUNDED` or not) rather than
needing a dedicated backend endpoint. Two tools, one underlying fact.

### ai-service/app/agents/support_agent.py (new)
The orchestrator. Given an intent, it either calls the matching tool and
builds a prompt instructing the LLM to phrase the tool's structured result
naturally, or falls through to Phase 5's original retrieval-or-plain-chat
path unchanged (`_handle_knowledge_or_general` — this is also where
`return_request` lands, since the knowledge base already documents the
return process as a self-service account action, not something a chat tool
should trigger).

Every path — tool result, RAG context, or plain conversation — still goes
through the LLM for final phrasing. That's what lets the echo provider prove
tool-calling wiring works (it names which tool ran and shows the raw result)
the same way it already proved RAG wiring works in Phase 5, with no real
model required to verify the plumbing.

One behaviour worth knowing: a **non-retryable** tool failure (the backend
rejected the request outright) sets `handoff_required = True`, escalating to
a human automatically. A **retryable** failure (a timeout, a connection
error) does not — it's treated as "try again in a moment," not "this needs a
person." `test_support_agent.py` has the tests for both branches.

### ai-service/app/llm/echo_provider.py (extended)
Already recognised `[Source N: filename]` markers from Phase 5's RAG
grounding. Now also recognises the `Tool: <name>\nData: ...` shape
`support_agent.py` produces for tool results, and names the tool plus a
snippet of its raw result in its reply — the same "prove the wiring without
a real model" trick, extended to cover the new code path.

### backend/src/services/conversationService.js (updated)
Two changes. First, `AiLog` now actually records `toolUsed` — a field that
existed on the model since Phase 1 but was never populated until there was
something real to put in it. Second, and more significant:
`transitionToHuman()` was extracted from `requestHandoff` (Phase 2's
explicit "Ask for a human" button) into its own function with no
authorization check of its own, so `requestAiReply` can call it directly
when the AI's response comes back with `handoff_required: true`. A customer
typing "let me talk to a person" mid-conversation now triggers the exact
same tested transition — status change, SYSTEM message, ticket creation —
that clicking the button always has, rather than a second, parallel
implementation of the same idea.

This genuinely closes most of what the original spec's Phase 7 ("Human
Handoff") describes for explicit requests. What's still ahead for a real
Phase 7: triggers based on the AI's own confidence (not just explicit
phrasing), repeated customer dissatisfaction, and flagging sensitive
payment/refund situations for review — none of which the router, built for
keyword-based intent classification, is the right tool to decide on its own.

## Tests

123 pytest tests total (up from 58 in Phase 5), across four new files:

- `test_router.py` (23) — every intent category, entity extraction, and the
  two bugs described above, now regression-tested.
- `test_tools.py` (19) — all six tools' HTTP handling against
  `httpx.MockTransport`: correct shaping of a successful response, a 404
  becoming `found: False`, input validation, and a backend-down scenario
  correctly raising a *retryable* `ToolError`.
- `test_support_agent.py` (16) — the orchestration logic with tools and
  retrieval mocked out: does the right intent call the right tool, does a
  missing order number trigger the "show recent orders instead" fallback,
  does a non-retryable tool failure set `handoff_required` while a retryable
  one doesn't.
- `test_chat_tools.py` (7) — full end-to-end tool calling through the real
  FastAPI app, with only the Node backend mocked. Everything above that
  layer — routing, the agent, `chat.py`, the echo provider — is real,
  unmocked code exercising the actual request path a browser's message
  would take.

Plus 63 Node tests (up from 51), including `internal.test.js`'s 12 new
tests: no key, wrong key, and — the one that matters most — that one
customer's order or ticket genuinely 404s when queried with a different
customer's id, not just when the id is missing entirely.

**A third thing worth knowing, found while wiring Phase 6 into Phase 5's
existing tests, not by writing new ones:** re-running the full suite after
finishing the router broke three of Phase 5's RAG tests. Not because the
router was wrong — because Phase 5's test fixture text, *"Items can be
returned within 30 days of delivery for a full refund,"* reads exactly like
a genuine refund complaint. The Phase 6 router correctly intercepted it as
`refund_request` and asked for an order number instead of blindly grounding
an answer in it — arguably better behaviour than Phase 5 had. The fix was in
the test data (swapped for router-neutral text that still exercises the RAG
fallback path), not the code. This is the kind of regression that only
surfaces by actually re-running old tests against new code, not by reasoning
about the new code in isolation.

## Commands

```bat
cd backend && npm install && npm run dev
cd ai-service && venv\Scripts\activate && uvicorn main:app --reload --port 5001
cd frontend && npm run dev
```

`npm install` in `backend/` isn't strictly required this phase (no new
Node dependencies), but **both `.env` files need `INTERNAL_API_KEY` set to
the same value** — see the Setup section in the main README. Without it,
every tool call fails with a 401 the moment the AI tries to look something
up, even though ordinary chat still works fine.

## Manual test walkthrough

1. Make sure `npm run db:seed` has run recently, so real orders exist (order
   numbers start at 5000).
2. Sign in as `amara@example.com`, ask "Where is order 5012?" (pick a real
   number from your seed data). The echo provider names `get_order_status`
   and shows the actual order's status and tracking info.
3. Ask "where is my order?" with no number — since you're signed in with
   real orders, it lists your recent ones instead of asking you to repeat
   the question.
4. Ask about an order number that belongs to a different seeded customer —
   a clean "not found," not their data.
5. Type "I want to talk to a human" as an ordinary message (not the button).
   Sign in as an agent, check **Live chats → Waiting** — the conversation is
   there, and a matching ticket exists too.
6. Ask "can you open a ticket, my item arrived damaged" — check **My
   tickets** as the customer afterward; it's a real ticket, not just a
   claim in the chat.
7. Ask about a product by name — real catalog data (price, stock, warranty)
   in the reply.
8. Stop the backend (`Ctrl+C`), then ask an order question again — the
   reply apologises and offers a human instead of crashing or inventing an
   answer.

## Errors you may hit

**Every tool-based question fails with something about "internal"** — check
`INTERNAL_API_KEY` is set to the exact same value in both `backend/.env` and
`ai-service/.env`. A mismatch (or one side left as the placeholder text)
fails every tool call with a 401.

**Order lookups always say "not found" even for a real order number** —
confirm you actually ran `npm run db:seed` recently, and that you're asking
about an order that belongs to the customer account you're signed in as —
this is the ownership check working as intended, not a bug.

**"Where is order 5012" doesn't extract the number** — the router requires
an order-related keyword (order, shipped, tracking, package, etc.) near the
number; a bare number with no such context is deliberately not treated as an
order reference, to avoid misreading a zip code or phone number fragment as
one. See `test_router.py`'s `test_bare_number_alone_is_not_order_status`.

**pytest fails or skips a lot of tests** — same as Phases 4-5: `faiss` or
`numpy` missing means those tests skip themselves rather than fail; install
the RAG dependencies from `requirements.txt` for full coverage.

## Before starting Phase 7

Confirm: an order question against a real seeded order returns real data; a
question about someone else's order returns "not found," not their data;
typing "I want a human" mid-chat actually moves the conversation to the
agent queue and creates a ticket, the same as the explicit button; creating
a ticket via chat actually shows up under **My tickets**; `npm test` passes
with 63; and `pytest` passes with 123, run more than once.
