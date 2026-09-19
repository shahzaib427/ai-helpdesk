"""Orchestrates ingestion: clean -> chunk -> embed -> store.

This is the module app/api/ingestion.py calls; nothing else in the service
talks to loader/splitter/embeddings/store directly, so the pipeline stays the
one place that has to know how those pieces fit together.
"""
from app.core.config import get_settings
from app.core.errors import AIServiceError
from app.core.logging import get_logger
from app.rag import embeddings as embeddings_module
from app.rag.splitter import clean_text, split_into_chunks
from app.rag.store import get_vector_store

logger = get_logger(__name__)


def ingest_document(document_id: int, filename: str, category: str | None, raw_text: str) -> list[dict]:
    """Cleans, chunks, embeds and stores raw_text for one document.

    Returns the chunk records that were stored, in order, so the caller
    (the Node backend, via POST /ingest) can persist matching rows in
    knowledge_chunks with the same chunk_uid for provenance.
    """
    settings = get_settings()

    cleaned = clean_text(raw_text)
    if not cleaned:
        # loader.py catches this for text extracted from a file, but this
        # function is also reachable with already-extracted text handed
        # straight to POST /ingest, so the check has to live here too.
        raise AIServiceError("Document is empty after cleaning.", code="empty_document", status_code=400)

    chunks = split_into_chunks(cleaned, chunk_size=settings.chunk_size, chunk_overlap=settings.chunk_overlap)
    if not chunks:
        return []

    vectors = embeddings_module.embed(chunks)

    records = [
        {
            "chunk_uid": f"{document_id}:{i}",
            "document_id": document_id,
            "chunk_index": i,
            "filename": filename,
            "category": category,
            "text": chunk,
            "page_number": None,  # plain text has no page concept; set by future PDF/DOCX loaders
        }
        for i, chunk in enumerate(chunks)
    ]

    store = get_vector_store()
    store.add(vectors, records)

    logger.info("Ingested document %s (%s): %d chunks", document_id, filename, len(records))
    return records


def remove_document(document_id: int) -> int:
    store = get_vector_store()
    removed = store.remove_by_document(document_id)
    logger.info("Removed document %s: %d chunks", document_id, removed)
    return removed


def search(query: str, top_k: int | None = None):
    """Embeds a query and returns the top matches. Not called by anything
    yet in Phase 4 — Phase 5 wires this into the chat endpoint — but it
    belongs next to ingest/remove since all three operate on the same store."""
    settings = get_settings()
    store = get_vector_store()
    query_vector = embeddings_module.embed([query])[0]
    return store.search(query_vector, top_k=top_k or settings.top_k)
