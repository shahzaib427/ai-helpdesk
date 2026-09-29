"""Query-time retrieval. Ingestion writes to the store (pipeline.py);
this module is the only thing that reads from it to answer a question.

Separated from pipeline.py on purpose: ingestion and retrieval have
different callers (the Node backend's upload flow vs. the chat endpoint),
different failure modes, and — with the relevance threshold below — genuinely
different logic, not just a different entry point into the same one.
"""
from dataclasses import dataclass

from app.core.config import get_settings
from app.rag import embeddings as embeddings_module
from app.rag.store import get_vector_store


@dataclass
class RetrievedChunk:
    text: str
    filename: str
    category: str | None
    document_id: int
    chunk_index: int
    page_number: int | None
    score: float


def retrieve(query: str, top_k: int | None = None, threshold: float | None = None) -> list[RetrievedChunk]:
    """Embeds the query, searches the store, and drops anything below the
    relevance threshold.

    The threshold exists specifically so the AI doesn't get handed a
    "closest match we had" chunk that isn't actually relevant and try to
    answer from it anyway — an empty result here is a legitimate, common
    outcome (the knowledge base has nothing on this topic), not an error.
    """
    settings = get_settings()
    threshold = settings.relevance_threshold if threshold is None else threshold

    store = get_vector_store()
    if store.count() == 0:
        return []

    query_vector = embeddings_module.embed([query])[0]
    raw_results = store.search(query_vector, top_k=top_k or settings.top_k)

    return [
        RetrievedChunk(
            text=meta["text"],
            filename=meta["filename"],
            category=meta.get("category"),
            document_id=meta["document_id"],
            chunk_index=meta["chunk_index"],
            page_number=meta.get("page_number"),
            score=score,
        )
        for meta, score in raw_results
        if score >= threshold
    ]
