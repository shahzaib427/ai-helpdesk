# Phase 4 - what was built and how to check it

This phase makes the AI service do real work for the first time. Phases 1-3
were the Node backend and Postgres; Phase 4 is the first thing that touches
Python, FAISS, and an actual embedding model. Nothing in this phase changes
how the AI *answers* a question — the chat endpoint still returns the same
`[echo provider]` placeholder it has since Phase 1 — but the knowledge base it
will eventually answer *from* is now real, uploadable, and searchable at the
storage layer. Phase 5 is what wires retrieval into `/chat`.

## The pipeline, end to end

```
Admin uploads a .txt file (browser)
  -> Node: multer validates type/size, saves to backend/uploads/knowledge/
  -> Node: creates a knowledge_documents row, status PROCESSING
  -> Node: reads the file's text, POSTs it to the AI service's /ingest
  -> AI service: cleans the text, splits it into overlapping chunks
  -> AI service: embeds each chunk locally (all-MiniLM-L6-v2, CPU only)
  -> AI service: adds the vectors to the FAISS-backed store, persists to disk
  -> AI service: returns the chunk list (uid, index, text) to Node
  -> Node: bulk-creates matching knowledge_chunks rows, status READY
```

Every step after "Node reads the file's text" can fail without corrupting
anything: if the AI service is down, or ingestion throws for any reason, the
document lands in status FAILED with a readable error message, the file stays
on disk, and clicking **Re-index** tries again. Nothing crashes, matching the
project's fallback-over-failure approach from Phase 2.

## Files and what each one does

### ai-service/app/rag/loader.py
Text extraction, registry-style: `LOADERS = {"txt": _load_txt}`. This is
where the original spec's "architect the ingestion system so PDF/DOCX can be
added cleanly" requirement actually lives — adding a PDF loader later is one
function plus one registry entry, and nothing in `pipeline.py` or the API
layer has to change to support it.

### ai-service/app/rag/splitter.py
`clean_text()` normalises line endings and collapses excess blank lines.
`split_into_chunks()` is paragraph-aware: it packs whole paragraphs into a
chunk up to `chunk_size` characters rather than slicing blindly by character
count, so a chunk doesn't cut off mid-sentence unless a single paragraph is
longer than the limit (in which case that one paragraph gets hard-split, so
one runaway paragraph can't produce an unembeddable giant chunk). Consecutive
chunks share a small amount of trailing context (`chunk_overlap`), which
matters when the answer to a question straddles a chunk boundary.

Tested directly against the real files in `knowledge-base/policies/` — not
synthetic text — so the tests are checking this actually handles the kind of
prose it will really be given.

### ai-service/app/rag/embeddings.py
Wraps `sentence-transformers`. The model loads once per process (`_model` is
a lazy-initialised singleton) — the first call after starting the AI service
will be slow while it downloads and loads `all-MiniLM-L6-v2` (~90MB,
downloaded once and cached by Hugging Face's library, not re-downloaded on
every restart); every call after that reuses the loaded model. Runs on CPU
only, no GPU code path exists.

### ai-service/app/rag/store.py
The one piece of this phase worth reading closely if you're curious how it
works. FAISS's flat index has no cheap "delete this one row" operation, so
rather than trying to patch the index in place, `remove_by_document()`
filters the underlying arrays and rebuilds the index from what's left.
`embeddings.npy` and `metadata.json` are the actual source of truth on disk;
the FAISS index itself is never separately persisted — it's rebuilt from
those two files on every process start and after every add/remove, which
keeps two files in sync instead of three. For a demo-scale knowledge base
(dozens to low hundreds of chunks) this rebuild is effectively instant; it
would need a different approach at a much larger scale, which is exactly the
kind of decision the module-swap comment at the top of the file is flagging
for later.

Chunk identity is a stable string (`"{document_id}:{chunk_index}"`), not
FAISS's internal row number — row numbers shift every time the index gets
rebuilt, so nothing outside this file ever sees or stores one.

### ai-service/app/rag/pipeline.py
Orchestrates the four pieces above. `ingest_document()` is what
`app/api/ingestion.py` calls. One bug caught here during testing: sending
whitespace-only text (as opposed to a genuinely empty string, which Pydantic
already rejects at the schema level) used to silently succeed with zero
chunks instead of returning a clear error — `clean_text()` would reduce it to
`""`, and the pipeline just returned an empty list rather than raising
anything. Fixed by checking for that case explicitly in `pipeline.py`, since
`loader.py`'s equivalent check only covers text that came from a freshly
extracted file, not text handed directly to `/ingest`.

### ai-service/app/api/ingestion.py
`POST /ingest` and `DELETE /ingest/{document_id}`. The Node backend is the
only caller — the browser never talks to the AI service directly, keeping the
"AI service never touches business data, Node owns the database" boundary
intact even for the knowledge base itself.

### ai-service/app/api/health.py (updated)
Now reports `knowledge_base_chunks`, the vector store's real count, so
`GET /health` is a quick way to confirm ingestion actually did something
without opening the admin UI.

### backend/src/middleware/upload.js
`multer` configured to accept only `.txt`, up to 5MB, one file. Rejects
anything else before it reaches a controller, service, or the AI service —
uploading a `.pdf` right now gets a clear "only .txt is supported" message at
the door instead of a confusing failure three layers deeper.

### backend/src/services/knowledgeService.js
`runIngestion()` is shared by both upload and re-index, since re-indexing is
just "run the same pipeline again" once any existing chunks for that document
are cleared. Two things worth knowing:

- **Removing vectors before a delete or re-index is best-effort.** If the AI
  service happens to be unreachable when an admin deletes a document, the
  Postgres rows and the file on disk are removed anyway rather than blocking
  the delete — an orphaned vector with no matching document is inert and gets
  cleaned up the next time anything rebuilds the index around it.
- **A failed ingestion doesn't lose the upload.** The file stays in
  `backend/uploads/knowledge/`, the document row stays in Postgres with
  status FAILED and a readable `errorMessage`, and **Re-index** retries from
  the same file — no need to upload it again.

### backend/src/services/aiClient.js (updated)
Gained `ingestDocument()` and `removeDocument()`, following the same
timeout-and-clear-error pattern `requestReply` established in Phase 2.
Ingestion gets a longer timeout (60s vs. 15s) since embedding a real document
on CPU is slower than generating one chat reply.

### backend/tests/knowledge.test.js
10 tests. `aiClient` is explicitly mocked here (`jest.mock("../src/services/aiClient")`)
rather than left to hit a real, probably-absent AI service — the difference
from Phase 2's conversation tests, which rely on the AI service being absent
to test the fallback path. Here, both outcomes (a document reaching READY
with real chunk rows, and a document reaching FAILED with a clear error) are
explicitly tested by controlling what the mock returns, rather than only ever
exercising whichever one the environment happens to produce.

### ai-service/tests/ (new)
35 pytest tests, actually run and passing — not just described. Split three
ways: `test_rag_text.py` covers the loader and splitter (including against
the real `return_policy.txt`), `test_vector_store.py` covers add/search/
persist/remove with synthetic embeddings, and `test_ingestion_api.py` covers
the FastAPI endpoints through `TestClient`. The embedding model is mocked in
every case (see `conftest.py`'s `fake_embedding_model` fixture) — these tests
check that ingestion, storage and retrieval mechanics work correctly, not
that the specific embedding model produces good vectors, so there's no reason
to pay for a model download just to run them.

### frontend/src/pages/admin/KnowledgeBase.jsx
Upload form (category picker + file input restricted to `.txt` via `accept`),
a filterable document list, and a detail panel showing the actual chunk text
once a document is READY — not just a chunk count, the real content, so an
admin can confirm the AI will be grounded in what they think it will be.
**Re-index** and **Delete** live in the same detail panel. A FAILED document
shows its error message inline rather than just a red badge.

## Commands

```bat
cd backend && npm install && npm run dev
cd ai-service && venv\Scripts\activate && pip install -r requirements.txt && uvicorn main:app --reload --port 5001
cd frontend && npm run dev
```

`npm install` is worth re-running in `backend/` — `multer` is a new
dependency this phase. `pip install -r requirements.txt` is worth re-running
in `ai-service/` too, even if you already had the venv set up: `pytest` was
added, and if you'd commented out the `sentence-transformers`/`faiss-cpu`/
`numpy` lines during Phase 1 to skip the download, this is the phase where
you need them uncommented.

## Manual test walkthrough

1. Sign in as `admin@helpdesk.local`, go to **Knowledge base**.
2. Pick "policies" as the category, upload
   `knowledge-base/policies/return_policy.txt`. Status starts PROCESSING; the
   first upload after starting the AI service will pause noticeably while the
   embedding model downloads and loads — later uploads are fast.
3. Once READY, click the document — the actual chunk text is visible, not
   just a count.
4. `curl http://localhost:5001/health` — `knowledge_base_chunks` matches.
5. Click **Re-index**. Status cycles back through PROCESSING to READY; chunk
   count is the same, since the source text didn't change.
6. Click **Delete**. The document disappears from the list;
   `knowledge_base_chunks` drops in `/health`.
7. Stop the AI service (`Ctrl+C` in its terminal). Upload another document —
   it reaches FAILED with a message mentioning the AI service being
   unreachable, not a crash or a hang.
8. Restart the AI service, click **Re-index** on the FAILED document — it
   recovers to READY without needing to upload the file again.

## Errors you may hit

**Upload sits on PROCESSING for a long time** — check the AI service's
terminal. If it's the first ingestion since starting the service, it's
downloading the embedding model; this needs internet access once. If there's
no download activity and it's still stuck, check the AI service logs for an
error — `runIngestion()` in `knowledgeService.js` should have caught it and
flipped the document to FAILED, so a genuinely stuck PROCESSING status without
any error in the logs suggests the Node process itself crashed mid-request.

**"Unsupported file type" on a .txt file** — check the actual file extension;
a file saved as `notes.txt.docx` by an editor that hid the real extension
will fail this check correctly, just confusingly. `dir` (Windows) or a file
properties dialog will show the true extension.

**`ModuleNotFoundError: No module named 'sentence_transformers'`** — the
`sentence-transformers`/`faiss-cpu`/`numpy` lines in `ai-service/requirements.txt`
were commented out during Phase 1 and never re-enabled. Uncomment them, then
`pip install -r requirements.txt` again.

**pytest fails with `ModuleNotFoundError: No module named 'faiss'`** — same
cause. The vector store and ingestion API tests skip themselves gracefully
(`pytest.importorskip`) if faiss or numpy aren't installed, so you'll see
those tests marked skipped rather than failed if this happens — install the
RAG dependencies to get full coverage.

**Node tests fail with a connection error to Postgres** — the same
`helpdesk_test` database and `.env` values from Phase 1 are still required;
nothing changed there.

## Before starting Phase 5

Confirm: uploading a `.txt` document reaches READY with a non-zero chunk
count and the chunk text is visible and looks correct; deleting a document
removes it from both the list and `/health`'s chunk count; re-indexing works;
a document survives an AI-service outage as FAILED rather than crashing
anything; `npm test` passes with 51 tests; and `pytest` in `ai-service/`
passes with 35.
