# Phase 5 - what was built and how to check it

This is the phase where the AI actually answers questions. Phase 4 built a
real, queryable knowledge base; Phase 5 wires it into `/chat`, so a question
that matches an uploaded document gets answered from it, with sources cited,
and a question that doesn't gets an honest "I don't have that information"
instead of an invented one.

Two things worth being precise about, since it's easy to overstate a RAG demo:

**This is not intent routing.** Every message goes through retrieval, every
time — there's no classifier yet deciding "this is a knowledge question, that
one is small talk." That's Phase 6's job. Phase 5's approach is simpler and
still correct: if retrieval finds something relevant, ground the answer in it;
if it doesn't, don't fabricate, and let the LLM handle "hello" or "thanks"
as ordinary conversation, which it can do fine without a routing layer.

**Grounding quality depends on which provider is configured.** The default,
`echo`, never generates a real answer — it proves the retrieval pipeline is
wiring real chunks into the prompt (it literally names the source files it
was given) without needing an API key or a model download. Getting an actual
fluent, grounded answer means configuring a real provider, which this phase
also adds support for. Both are legitimate ways to run this project; which
one you want depends on whether you're verifying the plumbing or trying the
real thing.

## The query pipeline, end to end

```
Customer sends a message (Node backend forwards it + history to /chat)
  -> AI service: embed the message
  -> AI service: search the vector store, keep only results above RELEVANCE_THRESHOLD
  -> found something?
       yes -> build a prompt: "answer ONLY from this documentation, cite it,
              say so honestly if it doesn't cover the question"
       no  -> build a prompt: "no matching documentation was found — don't
              invent specifics, ordinary conversation is fine"
  -> LLM generates a reply
  -> empty reply? treat it as a failure, not a valid (blank) answer
  -> return reply + used_rag + sources to Node
  -> Node saves it as a message, with sources in message.metadata
     (already wired since Phase 2 — no Node changes needed this phase)
```

## Files and what each one does

### ai-service/app/rag/retriever.py (new)
Query-time retrieval, deliberately separate from `pipeline.py` (which is
ingestion-only). `retrieve()` embeds the query, searches the store, and drops
anything below `RELEVANCE_THRESHOLD` — an empty result here is a legitimate,
common outcome (the knowledge base has nothing on this topic), not an error
condition. `pipeline.py`'s old `search()` function — unused scaffolding left
over from Phase 4 — was removed in favour of this, since Phase 5 is what
actually needed it and gave it a proper home.

### ai-service/app/api/chat.py (rewritten)
The core of this phase. `_build_system_prompt()` takes whatever `retrieve()`
found and returns both the prompt to send the LLM and the `Source` list to
report back — built together, from the same data, so they can't drift out of
sync with each other. Two prompt variants: `GROUNDED_INSTRUCTIONS` when
something relevant was found, `NO_MATCH_INSTRUCTIONS` when nothing was —
both explicit about not fabricating specifics, with the no-match version
also explicit that ordinary conversation doesn't need documentation to
handle.

One addition worth noting: **response validation**. A provider returning an
empty string isn't a thrown exception, but it's also not a valid answer — the
customer would just see a blank message. `/chat` now treats an empty reply
the same as a provider failure (a 503, with the fallback message Node already
knows how to handle from Phase 2), rather than returning 200 with nothing in
it.

### ai-service/app/llm/echo_provider.py (enhanced)
Now inspects the system prompt it's given for the `[Source N: filename]`
pattern `chat.py` produces when grounding occurred. If it finds one, it names
the source files in its reply instead of the generic "no model configured"
text — which makes it possible to confirm retrieval is correctly wiring real
document content into the prompt without needing a real LLM at all. Still
never pretends to be a real answer, on purpose: `[echo provider]` stays in
every reply.

### ai-service/app/llm/openai_compatible_provider.py (new)
A real provider, in the sense that it makes an actual HTTP call and returns
an actual model's answer — genuinely free to use via three different routes,
because the OpenAI chat-completions wire format isn't just OpenAI's; Groq,
OpenRouter, and local Ollama all speak it too. One class, three ways to run
it, documented with exact `.env` values for each in
`ai-service/.env.example`. A missing `LLM_BASE_URL` fails loudly and clearly
at provider construction rather than as a confusing request-time error.

### ai-service/app/llm/provider.py (updated)
The registry changed from `{name: class}` to `{name: factory}`, because the
two providers now genuinely need different constructor arguments — echo
needs only a model name, the real provider also needs a base URL, an
optional key, and a timeout. Forcing them into one shape would mean every
provider accepting settings it doesn't use. A configuration mistake (like
picking `openai_compatible` without setting `LLM_BASE_URL`) now surfaces as
the same clean JSON error envelope as everything else, not a raw Python
`ValueError` turning into an unhandled 500.

### Everything on the Node side: unchanged
Worth calling out explicitly, because it's a real payoff from how earlier
phases were built. `conversationService.js` already forwarded `sources`,
`provider`, `model`, and `used_rag`-adjacent data into `message.metadata` and
logged every AI call to `ai_logs` — success or failure — since Phase 2. The
frontend's `Chat.jsx` already rendered `message.metadata?.sources` since
Phase 2, for a feature that didn't exist yet. This phase is the first time
either of those actually has real data flowing through them, and neither
needed to change to make that happen.

## Tests

58 pytest tests total (up from 35 in Phase 4), across five files:

- `test_retriever.py` — the relevance threshold actually filters (an
  unrelated query is rejected, a matching one isn't), `top_k` is respected,
  an empty store returns nothing without erroring.
- `test_chat_rag.py` — the important one. A question matching ingested
  content gets `used_rag: true` with the right source cited; an unrelated
  question gets `used_rag: false`; a removed document is no longer
  retrievable; conversation history is forwarded; a real multi-document
  scenario picks the right one.
- `test_openai_compatible_provider.py` — the real provider's HTTP logic
  against `httpx.MockTransport`: a successful completion parses correctly,
  a 401 surfaces the provider's own error text, a malformed response and a
  network error both raise a clean `LLMUnavailableError`, the health check
  works both ways, and the API key is correctly included or omitted from the
  Authorization header.
- `test_vector_store.py`, `test_rag_text.py` — unchanged from Phase 4.

**A real bug worth knowing about, caught by actually running the tests
rather than just writing them:** the first version of the retrieval tests
used 8-dimensional fake embedding vectors. Two independent random unit
vectors in only 8 dimensions have a real, non-trivial chance of scoring
above the default 0.35 relevance threshold by pure coincidence — running the
suite five times in a row reproduced two different failures this caused.
Fixed by raising the fake vectors to 128 dimensions in `test_chat_rag.py`
(at that dimensionality the chance is negligible), verified by running the
full suite 15 times and `test_chat_rag.py` alone 20 times, all clean. The
fix is documented inline in the test file specifically so a future edit
doesn't "simplify" the dimension back down and reintroduce the flakiness.

## Commands

```bat
cd backend && npm run dev
cd ai-service && venv\Scripts\activate && uvicorn main:app --reload --port 5001
cd frontend && npm run dev
```

No new environment variables are required to run with the default `echo`
provider — everything from Phase 4 still works as-is. Getting real answers
means adding a few lines to `ai-service/.env`; see the next section.

## Trying a real LLM (optional but worth doing once)

The fastest free option is Groq:

1. Sign up at console.groq.com, create an API key.
2. In `ai-service/.env`:
   ```
   LLM_PROVIDER=openai_compatible
   LLM_BASE_URL=https://api.groq.com/openai/v1
   LLM_API_KEY=<your key>
   MODEL_NAME=llama-3.3-70b-versatile
   ```
3. Restart the AI service.
4. Ask a question that matches an uploaded document — the answer is now a
   real, fluent response instead of `[echo provider] ...`.

OpenRouter and local Ollama work the same way with different `LLM_BASE_URL`
values; full details are in `ai-service/.env.example`.

## Manual test walkthrough

1. With `LLM_PROVIDER=echo` (the default), sign in as `amara@example.com`
   and go to **Get help**.
2. Ask something generic, like "hi there" — a normal-ish echo reply, no
   sources.
3. Sign in as admin, upload `knowledge-base/policies/return_policy.txt`
   under **Knowledge base**, wait for READY.
4. Sign back in as the customer, ask "what is your return policy?" — the
   echo reply now names `return_policy.txt` as a source, confirming
   retrieval found and used it.
5. Ask something the knowledge base doesn't cover, like "do you sell
   umbrellas?" — `used_rag` should be false, no source cited, and the reply
   doesn't invent an answer.
6. (Optional) Configure a real provider as above, restart, and repeat step 4
   — this time the answer is genuinely useful, not just structurally correct.

## Errors you may hit

**Every question says "no relevant documentation found," even after
uploading a document** — check `/api/knowledge` shows the document as
READY, not FAILED or still PROCESSING. Also check the category and content
actually relate to what you're asking; the relevance threshold (0.35 by
default) is real, not a formality.

**`LLM_BASE_URL is required for the openai_compatible provider`** — you set
`LLM_PROVIDER=openai_compatible` but left `LLM_BASE_URL` blank. Pick one of
the three documented options in `.env.example`.

**A real provider returns a 401** — check `LLM_API_KEY` is correct and, for
Groq/OpenRouter, that the key hasn't been revoked. Ollama doesn't need a key
at all; leave `LLM_API_KEY` blank for it.

**pytest fails or skips a lot of tests** — same as Phase 4: `faiss` or
`numpy` missing means those tests skip themselves gracefully rather than
fail; install the RAG dependencies from `requirements.txt` for full coverage.

## Before starting Phase 6

Confirm: uploading a document and then asking a matching question gets a
reply that cites it; an unrelated question doesn't; deleting the document
makes it stop being cited; `pytest` passes with 58 tests, run more than once
to rule out flakiness; and — if you tried a real provider — a real, fluent
answer came back instead of the echo placeholder.
