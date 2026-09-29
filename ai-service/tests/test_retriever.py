"""Tests for query-time retrieval: the relevance threshold, an empty store,
and top_k, using synthetic embeddings so no real model download is needed."""
import pytest

pytest.importorskip("faiss", reason="faiss-cpu not installed")
np = pytest.importorskip("numpy", reason="numpy not installed")

from app.rag.retriever import retrieve  # noqa: E402
from app.rag.store import get_vector_store  # noqa: E402


@pytest.fixture(autouse=True)
def isolated_store(tmp_vector_store_path, monkeypatch):
    from app.core.config import get_settings
    from app.rag import store as store_module

    get_settings.cache_clear()
    settings = get_settings()
    monkeypatch.setattr(settings, "vector_store_path", tmp_vector_store_path)
    store_module._store = None
    yield
    store_module._store = None


@pytest.fixture
def mock_embed(monkeypatch):
    """Makes embed() deterministic and controllable: the same text always
    produces the same vector, so a test can plant a vector for one string and
    later "query" with the exact same string to get an exact match, or with a
    different string to get a controlled, weaker match."""
    from app.rag import embeddings as embeddings_module

    vectors = {}

    def fake_embed(texts):
        result = np.zeros((len(texts), 8), dtype=np.float32)
        for i, text in enumerate(texts):
            if text not in vectors:
                rng = np.random.default_rng(abs(hash(text)) % (2**31))
                v = rng.normal(size=8).astype(np.float32)
                v /= np.linalg.norm(v)
                vectors[text] = v
            result[i] = vectors[text]
        return result

    monkeypatch.setattr(embeddings_module, "embed", fake_embed)
    return vectors


def seed_store(text: str, document_id: int = 1, filename: str = "doc.txt"):
    from app.rag import embeddings as embeddings_module

    store = get_vector_store()
    vector = embeddings_module.embed([text])
    store.add(
        vector,
        [
            {
                "chunk_uid": f"{document_id}:0",
                "document_id": document_id,
                "chunk_index": 0,
                "filename": filename,
                "category": "policy",
                "text": text,
                "page_number": None,
            }
        ],
    )


class TestRetrieve:
    def test_empty_store_returns_nothing(self, mock_embed):
        results = retrieve("what is your return policy")
        assert results == []

    def test_exact_match_is_retrieved(self, mock_embed):
        seed_store("Our return window is 30 days.")
        results = retrieve("Our return window is 30 days.")
        assert len(results) == 1
        assert results[0].text == "Our return window is 30 days."
        assert results[0].score > 0.99  # identical text -> identical vector -> ~1.0 cosine sim

    def test_unrelated_query_is_filtered_by_threshold(self, mock_embed):
        seed_store("Our return window is 30 days.")
        # A different, unrelated string gets a different fake vector, which
        # (with random 8-dim vectors) will very likely score below any
        # reasonable relevance threshold.
        results = retrieve("completely unrelated string about kayaking", threshold=0.9)
        assert results == []

    def test_threshold_can_be_loosened_to_admit_a_weaker_match(self, mock_embed):
        seed_store("Our return window is 30 days.")
        # threshold=-1 admits everything regardless of score, proving the
        # filtering logic — not the embedding quality — is what's under test.
        results = retrieve("anything at all", threshold=-1.0)
        assert len(results) == 1

    def test_returns_retrieved_chunk_with_all_fields(self, mock_embed):
        seed_store("Content here.", document_id=7, filename="warranty.txt")
        results = retrieve("Content here.")
        chunk = results[0]
        assert chunk.filename == "warranty.txt"
        assert chunk.document_id == 7
        assert chunk.category == "policy"
        assert chunk.chunk_index == 0

    def test_respects_top_k(self, mock_embed):
        for i in range(5):
            seed_store(f"Document number {i} content.", document_id=i, filename=f"doc{i}.txt")
        results = retrieve("Document number 0 content.", top_k=2, threshold=-1.0)
        assert len(results) == 2
