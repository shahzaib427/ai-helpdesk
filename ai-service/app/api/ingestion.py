"""Ingestion API.

The Node backend is the only caller here: it owns file upload, validation and
the knowledge_documents/knowledge_chunks tables in Postgres. This service
only ever sees already-extracted text plus enough metadata to store and later
retrieve it. Keeping the boundary there is what keeps "the AI service never
touches business data directly" true even for the knowledge base.
"""
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.errors import AIServiceError
from app.core.logging import get_logger
from app.rag import pipeline

router = APIRouter(prefix="/ingest", tags=["ingestion"])
logger = get_logger(__name__)


class IngestRequest(BaseModel):
    document_id: int
    filename: str = Field(min_length=1, max_length=255)
    category: str | None = None
    text: str = Field(min_length=1)


class ChunkRecord(BaseModel):
    chunk_uid: str
    chunk_index: int
    text: str
    page_number: int | None = None


class IngestResponse(BaseModel):
    document_id: int
    chunk_count: int
    chunks: list[ChunkRecord]


class RemoveResponse(BaseModel):
    document_id: int
    removed: int


@router.post("", response_model=IngestResponse, summary="Chunk, embed and store one document")
async def ingest(payload: IngestRequest) -> IngestResponse:
    try:
        records = pipeline.ingest_document(
            document_id=payload.document_id,
            filename=payload.filename,
            category=payload.category,
            raw_text=payload.text,
        )
    except AIServiceError:
        raise
    except Exception as exc:
        logger.error("Ingestion failed for document %s: %s", payload.document_id, exc)
        raise AIServiceError(
            "Ingestion failed while chunking or embedding the document.",
            code="ingestion_failed",
            status_code=500,
        ) from exc

    return IngestResponse(
        document_id=payload.document_id,
        chunk_count=len(records),
        chunks=[
            ChunkRecord(chunk_uid=r["chunk_uid"], chunk_index=r["chunk_index"], text=r["text"], page_number=r["page_number"])
            for r in records
        ],
    )


@router.delete("/{document_id}", response_model=RemoveResponse, summary="Remove a document's vectors")
async def remove(document_id: int) -> RemoveResponse:
    removed = pipeline.remove_document(document_id)
    return RemoveResponse(document_id=document_id, removed=removed)
