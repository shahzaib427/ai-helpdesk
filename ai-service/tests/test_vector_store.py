"""Tests for VectorStore: add, search, persistence, and document-scoped
removal. Uses synthetic embeddings (see conftest.fake_embeddings) rather than
the real sentence-transformers model, so these run fast and need no model
download — they're testing the store's mechanics, not embedding quality."""
import pytest

faiss = pytest.importorskip("faiss", reason="faiss-cpu not installed")
np = pytest.importorskip("numpy", reason="numpy not installed")

from app.rag.store import VectorStore  # noqa: E402


def make_records(document_id: int, n: int, prefix: str = "chunk"):
    return [
        {
            "chunk_uid": f"{document_id}:{i}",
            "document_id": document_id,
            "chunk_index": i,
            "filename": f"doc{document_id}.txt",
            "category": "policy",
            "text": f"{prefix} {i}",
            "page_number": None,
        }
        for i in range(n)
    ]


class TestVectorStore:
    def test_starts_empty(self, tmp_vector_store_path):
        store = VectorStore(tmp_vector_store_path)
        assert store.count() == 0
        assert store.search(np.zeros(8, dtype=np.float32), top_k=5) == []

    def test_add_returns_chunk_uids_in_order(self, tmp_vector_store_path, fake_embeddings):
        store = VectorStore(tmp_vector_store_path)
        uids = store.add(fake_embeddings(3, seed=1), make_records(1, 3))
        assert uids == ["1:0", "1:1", "1:2"]
        assert store.count() == 3

    def test_add_from_multiple_documents_accumulates(self, tmp_vector_store_path, fake_embeddings):
        store = VectorStore(tmp_vector_store_path)
        store.add(fake_embeddings(3, seed=1), make_records(1, 3))
        store.add(fake_embeddings(2, seed=2), make_records(2, 2))
        assert store.count() == 5

    def test_search_finds_nearest_neighbour(self, tmp_vector_store_path, fake_embeddings):
        store = VectorStore(tmp_vector_store_path)
        vectors = fake_embeddings(3, seed=1)
        store.add(vectors, make_records(1, 3))

        # A tiny perturbation of an existing vector should still match it as
        # the closest neighbour.
        query = vectors[0] + np.random.default_rng(99).normal(scale=0.01, size=8).astype(np.float32)
        query /= np.linalg.norm(query)

        results = store.search(query, top_k=2)
        assert len(results) == 2
        assert results[0][0]["chunk_uid"] == "1:0"
        assert results[0][1] > results[1][1]  # closest match scores highest

    def test_search_respects_top_k(self, tmp_vector_store_path, fake_embeddings):
        store = VectorStore(tmp_vector_store_path)
        store.add(fake_embeddings(10, seed=3), make_records(1, 10))
        results = store.search(fake_embeddings(1, seed=3)[0], top_k=4)
        assert len(results) == 4

    def test_search_caps_at_available_count(self, tmp_vector_store_path, fake_embeddings):
        store = VectorStore(tmp_vector_store_path)
        store.add(fake_embeddings(2, seed=4), make_records(1, 2))
        results = store.search(fake_embeddings(1, seed=4)[0], top_k=10)
        assert len(results) == 2  # asked for 10, only 2 exist

    def test_persists_across_instances(self, tmp_vector_store_path, fake_embeddings):
        store1 = VectorStore(tmp_vector_store_path)
        store1.add(fake_embeddings(3, seed=1), make_records(1, 3))

        store2 = VectorStore(tmp_vector_store_path)
        assert store2.count() == 3

    def test_remove_by_document_only_removes_that_document(self, tmp_vector_store_path, fake_embeddings):
        store = VectorStore(tmp_vector_store_path)
        store.add(fake_embeddings(3, seed=1), make_records(1, 3))
        store.add(fake_embeddings(2, seed=2), make_records(2, 2))

        removed = store.remove_by_document(1)

        assert removed == 3
        assert store.count() == 2
        assert all(m["document_id"] == 2 for m in store._metadata)

    def test_remove_persists(self, tmp_vector_store_path, fake_embeddings):
        store1 = VectorStore(tmp_vector_store_path)
        store1.add(fake_embeddings(3, seed=1), make_records(1, 3))
        store1.add(fake_embeddings(2, seed=2), make_records(2, 2))
        store1.remove_by_document(1)

        store2 = VectorStore(tmp_vector_store_path)
        assert store2.count() == 2

    def test_removing_nonexistent_document_is_a_safe_no_op(self, tmp_vector_store_path, fake_embeddings):
        store = VectorStore(tmp_vector_store_path)
        store.add(fake_embeddings(3, seed=1), make_records(1, 3))
        removed = store.remove_by_document(999)
        assert removed == 0
        assert store.count() == 3

    def test_remove_all_documents_returns_to_empty_searchable_state(self, tmp_vector_store_path, fake_embeddings):
        store = VectorStore(tmp_vector_store_path)
        store.add(fake_embeddings(3, seed=1), make_records(1, 3))
        store.remove_by_document(1)
        assert store.count() == 0
        assert store.search(fake_embeddings(1, seed=1)[0], top_k=5) == []
