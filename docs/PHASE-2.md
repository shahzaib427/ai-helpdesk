# Phase 2 - what was built and how to check it

Conversations and messaging are now real: a customer can start a thread, send
messages, and see them persist across reloads. There is no real AI yet — that
is Phase 5 — but the chat behaves like a real support inbox rather than a mock.
When the AI service is unreachable (which it may be, since Phase 5 hasn't
wired up a real model), the thread gets an honest fallback message instead of
silently failing, exactly as it would during a real outage.

Basic human handoff also landed early, because it shares almost all of its
data model with conversations: a customer can ask for a person, an agent can
take the conversation over, and can then reply as themselves. What's still
ahead for Phase 7 is the AI deciding *on its own* that a handoff is needed
(that requires the router from Phase 6), plus richer agent tooling like
internal notes, which arrives with tickets in Phase 3.

## Files and what each one does

### backend/src/services/aiClient.js
The only place in the Node backend that talks to the AI service. Posts to
`${AI_SERVICE_URL}/chat` with a 15-second timeout via `AbortController`. If the
call fails for any reason — the service is down, it times out, it returns a
non-2xx status — this throws, and the caller decides what to do about it. It
never decides that itself, which keeps the retry/fallback policy in one place
(`conversationService`) instead of scattered across callers.

### backend/src/services/conversationService.js
The core of Phase 2. A few decisions worth knowing:

- **Customers only ever see their own conversations.** `loadConversation`
  checks `conversation.customerId` against the caller's own customer profile
  for every read, not just on the list endpoint — visiting `/api/conversations/:id`
  directly for someone else's thread returns a 403, not a 404 (a 404 would leak
  whether the ID exists at all).
- **Starting a conversation is a transaction; asking the AI is not.** The
  conversation row and its opening message are created together inside
  `sequelize.transaction`. The AI call happens *after* that transaction
  commits, so a slow or failing AI response never holds a database lock.
- **A failed AI call becomes a visible SYSTEM message**, not a swallowed
  error: `"AI support is temporarily unavailable. Your message has been saved
  and a support ticket can be created."` This is also what you'll see in local
  development until Phase 5 wires up a real provider, since nothing is
  listening on `AI_SERVICE_URL` unless you've started the AI service too.
- **An agent can't reply until they've taken the conversation over.**
  `addMessage` checks `conversation.status === WITH_AGENT` before allowing an
  AGENT-sent message; otherwise it throws a 400. This stops an agent from
  replying to a thread the AI is still handling.
- **Handoff and take-over are separate steps on purpose.** `requestHandoff`
  (customer-triggered) moves a conversation to `WAITING_AGENT` and turns
  `aiEnabled` off. `takeOver` (agent-triggered) claims it, sets
  `assignedAgentId`, and moves it to `WITH_AGENT`. Splitting them means the
  queue an agent watches (`WAITING_AGENT`) and the thread they're actively
  working (`WITH_AGENT`) are always distinguishable in the data, which matters
  once Phase 8 builds analytics off conversation status.

### backend/src/controllers/conversationController.js and routes/conversations.routes.js
Thin as usual — the controller translates HTTP to a service call, the routes
file wires paths to roles. Two things worth noting: `GET /` and `GET /:id`
have no `requireRole` on them, because the service itself branches by role
(customer vs staff) rather than the route; and `POST /:id/messages` is open to
any authenticated role because the *service*, not the route, is what enforces
the WITH_AGENT rule for agents. Putting that check in the service instead of
the route means the same rule applies no matter how the endpoint is reached
(REST here, a future WebSocket layer, admin tooling, etc.).

### backend/tests/conversations.test.js
14 tests. The interesting ones: starting a conversation and asserting the
second message exists and is either an AI or SYSTEM sender (both are correct
outcomes, since we can't be sure the AI service happens to be running when
these tests execute); a second customer getting a 403 on the first customer's
thread; an agent getting a 400 for replying before taking over, then a 201
once they have; and a 400 for messaging a RESOLVED conversation. No live AI
service is required — the fallback path *is* the tested path.

### frontend/src/api/conversations.js
Thin wrapper matching the five backend endpoints. Nothing clever — every
method returns already-unwrapped data (`response.data.data.conversation`,
etc.) so pages don't repeat that unwrapping.

### frontend/src/pages/customer/Chat.jsx
Replaces the Phase 1 placeholder. Two views in one component: no `?c=` in the
URL shows a bare composer that starts a conversation; with a `?c=<id>` it
loads and displays that thread. Sending a message or starting a conversation
both `await` the full round trip (including the AI/fallback reply) before
updating state, since the backend already returns the updated thread in one
response — there's no polling or websocket here, deliberately, since Phase 2
doesn't need one.

Composer submits on Enter, newline on Shift+Enter. A RESOLVED or CLOSED thread
disables the composer and shows a "start a new one" link instead of letting
you type into a dead conversation.

### frontend/src/pages/customer/Conversations.jsx
A simple list, paginated, linking each row to `/chat?c=<id>`.

### frontend/src/pages/agent/Conversations.jsx
This one goes further than "Phase 2: conversations and messaging" strictly
requires, because the backend already supports take-over and staff listing —
leaving the agent screen as a placeholder while the API underneath it fully
worked would have been the dishonest direction, not the honest one. Two tabs
(`Waiting` / `Mine`), a list on the left, and a thread panel on the right.
Selecting a `WAITING_AGENT` conversation shows a **Take over** button; once
taken over, the same panel becomes a normal two-way thread.

Admin's own screens are untouched in this phase — an admin can act as staff
through the same `/api/conversations` endpoints in Phase 3 once ticket
ownership ties in, but there's no separate admin conversations screen yet.

## Commands

```bat
cd backend && npm run dev
cd ai-service && venv\Scripts\activate && uvicorn main:app --reload --port 5001
cd frontend && npm run dev
```

All three from Phase 1, unchanged. No new environment variables, no new
database setup — the `conversations` and `messages` tables already existed
from Phase 1's schema.

## Manual test walkthrough

1. Sign in as `amara@example.com`, land on **Get help**.
2. Type a message, send it. A second message appears — the `[echo provider]`
   placeholder if the AI service isn't running, or an echo-provider reply if
   it is. Either is correct; there is no real model until Phase 5.
3. Go to **Past chats** — the thread is listed with its status.
4. Back in the thread, click **Ask for a human**. Status pill changes to
   "Waiting agent".
5. Sign out, sign in as `priya@helpdesk.local`. Go to **Live chats**, the
   **Waiting** tab. The thread appears. Click **Take over**.
6. Type a reply as Priya and send it.
7. Sign back in as the customer, reopen the same thread from **Past chats** —
   Priya's reply is there.

## Errors you may hit

**A message never gets an AI reply, and no fallback appears either** — check
the backend terminal for `AI service call failed:`. If you see it, the
fallback should still have been saved; if the thread shows only your own
message with nothing after it, the request likely failed before reaching
`requestAiReply` — check the backend logs for a 4xx/5xx on
`POST /api/conversations`.

**403 on a conversation you just started** — you're testing with two
different customer accounts in two tabs. That's expected: conversations are
private to the customer who started them until an agent takes them over.

**400 "Take this conversation over before replying to the customer"** — an
agent tried to send a message on a thread still in `WAITING_AGENT` or
`ACTIVE`. Take it over first.

**Tests fail with a connection error to Postgres** — the same `helpdesk_test`
database and `.env` values from Phase 1 are still required; nothing changed
there.

## Before starting Phase 3

Confirm: a customer can start a conversation and see it reload correctly from
**Past chats**; the handoff → take-over → reply flow works end to end between
a customer and agent account; `npm test` passes with 24 tests; and a customer
still cannot open another customer's conversation by guessing its ID in the
URL.
