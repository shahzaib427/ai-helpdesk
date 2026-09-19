# Phase 3 - what was built and how to check it

Tickets, orders, and products are now real, backed by the same 12 tables
Phase 1 created — nothing new in the schema except one small, deliberate
addition (`tickets.internal_notes`, explained below). Between them these three
resources round out what a support desk actually runs on: something to track
a problem (tickets), something to check when a customer asks "where is it"
(orders), and a catalog the AI will eventually answer product questions from
(products, in Phase 6).

## Files and what each one does

### backend/src/services/ticketService.js
The core of this phase. A few decisions worth knowing:

- **`internalNotes` never reaches a customer**, enforced in one place. `forCustomer()`
  strips it before any customer-facing response leaves the service — not in
  the controller, not per-route, so there's exactly one function to audit if
  you ever need to confirm this holds.
- **Priority sorts by actual severity, not alphabetically.** `URGENT`, `HIGH`,
  `MEDIUM`, `LOW` is not the order Postgres would give you for free — sorted
  as plain text, `HIGH` comes before `LOW` comes before `MEDIUM` comes before
  `URGENT`. The staff queue uses an explicit `CASE` expression instead, so the
  most urgent ticket is always first.
- **An agent's default queue view is "mine plus unassigned,"** not "everything."
  Passing `mine=true` narrows it to just their own. This is what keeps a
  10-agent desk usable — nobody wants to scroll through everything.
- **Internal notes are a JSON column, not a table.** Phase 3 doesn't need to
  query "all notes by this agent across all tickets," just a chronological log
  attached to one ticket — a table with foreign keys would be solving a
  problem this phase doesn't have.

### backend/src/services/orderService.js and productService.js
Both existed as scaffolding before this phase's controllers and routes were
wired up, and are unchanged here. Worth knowing regardless: `productService.retire()`
sets `isActive: false` rather than deleting the row, because a retired
product might still be referenced by past order items — deleting it would
break the order history. `orderService.create()` is an admin-only simulation
of placing an order (there's no real checkout in this project); it generates
order numbers in the same `5000+` range the Phase 1 seed data uses, so a
tool-calling example like "where's order 5012" keeps working against
whichever orders happen to exist.

### backend/src/services/customerService.js
Staff-only. `getDetail()` returns a customer's profile plus their 10 most
recent orders, tickets, and conversations in parallel (`Promise.all`) rather
than sequentially — three independent queries, no reason to wait for one
before starting the next.

### backend/src/controllers and routes (products, orders, tickets, customers)
Same thin-controller pattern as Phases 1–2. Two access-control patterns worth
noting:

- **Products and orders are readable by any signed-in role, writable by
  admins only.** An agent needs to browse the catalog to answer a question,
  but only an admin manages what's in it — matching the original spec, where
  only admins are described as managing products and orders.
- **Tickets and conversations both branch by role inside the service, not the
  route.** `GET /api/tickets` and `GET /api/tickets/:id` have no `requireRole`
  attached; the service decides what a customer vs. staff member gets to see.
  This is the same pattern conversations used in Phase 2, kept consistent
  rather than reinvented per resource.

### backend/src/models/ticket.js
One field added since Phase 1: `internalNotes` (JSONB, defaults to `[]`).
Nothing else in the schema changed — every other Phase 3 resource used tables
Phase 1 already created and never touched.

### backend/src/services/conversationService.js (updated)
`requestHandoff` now also opens a ticket if one doesn't already exist for that
conversation, matching the original handoff workflow (`Customer → AI → Human
handoff → Create/update ticket → Assign agent`). This means a conversation
and its ticket share history: the ticket's description is seeded from the
customer's first message, and its `conversationId` links back, so an agent
working the ticket can always find the original chat.

### backend/tests/tickets-orders-products.test.js
17 tests. The ones worth knowing about specifically: creating a product then
confirming a duplicate SKU is rejected with 409; retiring a product and
confirming it drops out of the default catalog listing; a customer's order
list coming back empty when they have no orders (rather than erroring); the
full ticket lifecycle from creation through an agent adding an internal note
to resolution, with an explicit assertion that the note never appears in the
customer's own view of the same ticket; and a customer getting 403 on the
staff-only customer directory.

### frontend/src/api (tickets.js, products.js, orders.js, customers.js)
Thin wrappers, same shape as Phase 2's `conversations.js` — each method
returns already-unwrapped data so pages don't repeat the unwrapping.

### frontend/src/pages/customer/Tickets.jsx
List-plus-detail, similar structure to Phase 2's chat list: a form to raise a
new ticket, a list of past ones, and a detail panel. No status or priority
controls here — those are staff actions.

### frontend/src/pages/agent/Tickets.jsx and admin/Tickets.jsx
Two views over the same data, genuinely different because the roles need
different things. The agent view has **Queue** (unassigned + mine) and
**Mine** tabs, a **Claim** button, and internal notes. The admin view skips
the queue/mine split — an admin needs to see and reassign *everything* — and
adds a reassignment dropdown populated from `/api/users?role=AGENT` (the
Phase 1 endpoint, reused rather than duplicated).

### frontend/src/pages/admin/Products.jsx
Full CRUD: create, edit (click a product name), retire, reactivate, search,
and a "show retired" toggle. One bug caught and fixed while building this:
an early version reused the `StatusPill` component with unrelated enum
values (`DELIVERED`/`CANCELLED`) to borrow its green/grey colours for
active/retired — but `StatusPill` renders its value *as the label text*, so
a retired product would have displayed the word "cancelled." Replaced with a
plain badge that says what it means.

### frontend/src/pages/admin/Orders.jsx
The most involved page in this phase. Placing a simulated order needs a
customer (searched by name/email, since there's no reason an admin would know
a customer's internal ID) and one or more line items (product picker,
quantity, add/remove rows). The order detail panel separates two kinds of
edit that don't belong together: **status** (a dropdown, saves immediately)
and **tracking details** (number, carrier, estimated delivery — batched, with
an explicit Save button). A real bug surfaced and got fixed here too: saving
tracking details unconditionally, including empty fields, would have sent an
empty string for `estimatedDelivery` — a `DATEONLY` column — which Postgres
rejects as an invalid date. The fix strips empty fields before sending, so
clearing the form and hitting Save is a no-op rather than a 500.

### frontend/src/pages/agent/Customers.jsx
Search, then a detail panel with recent orders, tickets, and conversations —
everything an agent needs to have context before replying to someone,
without paging through that customer's entire lifetime history.

## Commands

```bat
cd backend && npm run dev
cd ai-service && venv\Scripts\activate && uvicorn main:app --reload --port 5001
cd frontend && npm run dev
```

Same three terminals as before. No new environment variables. The one schema
change (`internalNotes` on tickets) is picked up automatically the next time
you run `npm run db:sync`, since it uses `alter: true`.

## Manual test walkthrough

1. Sign in as `amara@example.com`. Go to **My tickets**, raise one with a
   subject and description. It appears immediately, status OPEN.
2. Sign in as `priya@helpdesk.local`. Go to **Tickets → Queue**, find it,
   click **Claim**. Change its status to IN_PROGRESS. Add an internal note.
3. Sign back in as Amara, open the same ticket from **My tickets** — the
   status change is visible, the internal note is not.
4. As Priya, go to **Customers**, search "amara", open her profile — the
   ticket you just worked appears under "Recent tickets."
5. Sign in as `admin@helpdesk.local`. Go to **Products**, create one, edit it,
   retire it, confirm it disappears from the default list, then check "Show
   retired" and confirm it's still there.
6. Go to **Orders**, place a simulated order for any customer with one or two
   items, then open it and update its tracking number and estimated delivery.
7. Go to **Tickets**, find the one Amara raised, reassign it to a different
   agent from the dropdown.

## Errors you may hit

**403 on `/api/products` for an admin action you just tried as an agent** —
expected. Only admins can create, edit, retire, or reactivate products; any
signed-in role can browse them.

**A retired product still shows in the default Products list** — check
whether "Show retired" is ticked; it's meant to be included there.

**Placing an order fails with "Unknown customer"** — the customer search in
the order form requires clicking a result to select them, not just typing a
search term. Confirm the panel shows their name with a "Change" link before
submitting.

**Saving order tracking details 500s** — if you're running against an older
build of this project's frontend, check whether `admin/Orders.jsx` strips
empty fields before sending; an empty `estimatedDelivery` string is an
invalid date for Postgres. This zip already has the fix.

**Tests fail with a connection error to Postgres** — the same `helpdesk_test`
database and `.env` values from Phase 1 are still required; nothing changed
there.

## Before starting Phase 4

Confirm: a customer can raise a ticket and an agent can claim, update, and
add a private note to it without the customer ever seeing that note; an
admin can manage the product catalog and place a simulated order; `npm test`
passes with 41 tests; and a customer still cannot browse the customer
directory or another customer's orders.
