"""Extracts plain text from an uploaded document.

Only .txt is supported in Phase 4, per the project's phased rollout — but the
registry pattern here is the point: adding PDF or DOCX later means writing
one function and adding one line to LOADERS, not touching the pipeline that
calls this module.
"""
from app.core.errors import AIServiceError


def _load_txt(raw: bytes) -> str:
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        # Older Windows-authored .txt files are sometimes Latin-1. Fall back
        # rather than reject a document over an encoding quirk.
        return raw.decode("latin-1")


# Phase 4 supports .txt only. To add PDF or DOCX later:
#   1. write a _load_pdf(raw: bytes) -> str / _load_docx(raw: bytes) -> str
#   2. register it below
#   3. nothing else in app/rag or app/api needs to change
LOADERS = {
    "txt": _load_txt,
}


def load_text(file_type: str, raw: bytes) -> str:
    loader = LOADERS.get(file_type.lower().lstrip("."))
    if loader is None:
        supported = ", ".join(sorted(LOADERS))
        raise AIServiceError(
            f"Unsupported file type '{file_type}'. Supported: {supported}.",
            code="unsupported_file_type",
            status_code=400,
        )
    text = loader(raw)
    if not text.strip():
        raise AIServiceError("Document is empty after text extraction.", code="empty_document", status_code=400)
    return text
