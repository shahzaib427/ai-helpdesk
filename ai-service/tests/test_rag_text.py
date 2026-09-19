"""Tests for text extraction and chunking. No embedding model or vector store
needed here — these two modules are pure text transforms."""
import pytest

from app.core.errors import AIServiceError
from app.rag.loader import load_text
from app.rag.splitter import clean_text, split_into_chunks


class TestLoader:
    def test_loads_utf8_text(self):
        text = load_text("txt", "Hello world.".encode("utf-8"))
        assert text == "Hello world."

    def test_falls_back_to_latin1_on_bad_utf8(self):
        raw = "café".encode("latin-1")
        text = load_text("txt", raw)
        assert "caf" in text

    def test_rejects_unsupported_file_type(self):
        with pytest.raises(AIServiceError) as exc_info:
            load_text("pdf", b"%PDF-1.4 fake content")
        assert exc_info.value.status_code == 400
        assert exc_info.value.code == "unsupported_file_type"

    def test_rejects_empty_document(self):
        with pytest.raises(AIServiceError) as exc_info:
            load_text("txt", b"   \n\n  ")
        assert exc_info.value.code == "empty_document"

    def test_extension_with_leading_dot_is_normalised(self):
        # loader.py strips a leading "." so ".txt" and "txt" both resolve
        text = load_text(".txt", b"content")
        assert text == "content"


class TestCleanText:
    def test_normalises_line_endings(self):
        assert "\r" not in clean_text("line one\r\nline two\r")

    def test_collapses_excess_blank_lines(self):
        messy = "para one\n\n\n\n\npara two"
        cleaned = clean_text(messy)
        assert "\n\n\n" not in cleaned
        assert "para one\n\npara two" == cleaned

    def test_strips_trailing_whitespace_per_line(self):
        assert clean_text("line with trailing spaces   \nnext line") == "line with trailing spaces\nnext line"

    def test_strips_leading_and_trailing_whitespace_overall(self):
        assert clean_text("\n\n  content  \n\n") == "content"


class TestSplitIntoChunks:
    def test_empty_text_produces_no_chunks(self):
        assert split_into_chunks("") == []
        assert split_into_chunks("   ") == []

    def test_short_text_produces_one_chunk(self):
        chunks = split_into_chunks("A single short paragraph.", chunk_size=800, chunk_overlap=120)
        assert len(chunks) == 1
        assert chunks[0] == "A single short paragraph."

    def test_no_chunk_exceeds_size_by_more_than_the_overlap_allowance(self):
        # Chunks may overshoot chunk_size by up to chunk_overlap chars,
        # since a small amount of trailing context is deliberately carried
        # forward into the next chunk — see splitter.py's comment on this.
        paragraphs = [f"Paragraph number {i}. " * 10 for i in range(20)]
        text = "\n\n".join(paragraphs)
        chunk_size, chunk_overlap = 300, 50
        chunks = split_into_chunks(text, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        assert len(chunks) > 1
        for chunk in chunks:
            assert len(chunk) <= chunk_size + chunk_overlap

    def test_all_chunks_are_non_empty(self):
        text = "Para one.\n\nPara two.\n\nPara three."
        chunks = split_into_chunks(text, chunk_size=15, chunk_overlap=3)
        assert all(len(c.strip()) > 0 for c in chunks)

    def test_oversized_single_paragraph_is_hard_split(self):
        huge_paragraph = "word " * 500  # ~2500 chars, one paragraph, no blank lines
        chunks = split_into_chunks(huge_paragraph, chunk_size=200, chunk_overlap=20)
        assert len(chunks) > 1
        for chunk in chunks:
            assert len(chunk) <= 200

    def test_real_policy_document_chunks_cleanly(self, return_policy_text):
        cleaned = clean_text(return_policy_text)
        chunks = split_into_chunks(cleaned, chunk_size=400, chunk_overlap=60)
        assert len(chunks) >= 1
        assert all(chunk.strip() for chunk in chunks)
        # The policy's key facts should survive chunking somewhere in the doc
        joined = " ".join(chunks)
        assert "30 days" in joined
