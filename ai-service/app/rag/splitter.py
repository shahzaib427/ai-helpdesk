"""Cleans extracted text and splits it into overlapping chunks for embedding.

Chunking is paragraph-aware rather than a blind character-count slice: it
packs whole paragraphs into a chunk up to the size limit, so a chunk doesn't
end mid-sentence unless a single paragraph is longer than the limit itself.
"""
import re


def clean_text(text: str) -> str:
    # Normalise line endings, collapse runs of blank lines to exactly two
    # (paragraph boundary), and drop trailing whitespace on each line.
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = "\n".join(line.rstrip() for line in text.split("\n"))
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _paragraphs(text: str) -> list[str]:
    return [p.strip() for p in text.split("\n\n") if p.strip()]


def split_into_chunks(text: str, chunk_size: int = 800, chunk_overlap: int = 120) -> list[str]:
    """Greedily packs paragraphs into chunks no larger than chunk_size chars.

    A paragraph that alone exceeds chunk_size is hard-split so one runaway
    paragraph can't produce a single oversized, poorly-embeddable chunk.
    Consecutive chunks share up to chunk_overlap characters of trailing
    context, which helps retrieval when the answer to a question straddles
    a chunk boundary.
    """
    paragraphs = _paragraphs(text)
    if not paragraphs:
        return []

    chunks: list[str] = []
    current = ""

    def flush():
        nonlocal current
        if current.strip():
            chunks.append(current.strip())
        current = ""

    for paragraph in paragraphs:
        if len(paragraph) > chunk_size:
            flush()
            for start in range(0, len(paragraph), chunk_size - chunk_overlap):
                chunks.append(paragraph[start : start + chunk_size].strip())
            continue

        candidate = f"{current}\n\n{paragraph}" if current else paragraph
        if len(candidate) <= chunk_size:
            current = candidate
        else:
            flush()
            # Carry the tail of the previous chunk forward as overlap context.
            tail = chunks[-1][-chunk_overlap:] if chunks and chunk_overlap else ""
            current = f"{tail}\n\n{paragraph}".strip() if tail else paragraph

    flush()
    return chunks
