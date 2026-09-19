"""Tests for POST /ingest and DELETE /ingest/{id} through the real FastAPI
app. The embedding model itself is mocked (see the autouse fixture below) so
these run without downloading sentence-transformers' weights — that model is
exercised for real only by manual testing, since mocking it out is what lets
this whole test file run in a few seconds instead of a few minutes."""
import pytest

pytest.importorskip("faiss", reason="faiss-cpu not installed")
pytest.importorskip("numpy", reason="numpy not installed")
fastapi_testclient = pytest.importorskip("fastapi.testclient", reason="fastapi not installed")


@pytest.fixture(autouse=True)
def isolated_vector_store(tmp_vector_store_path, monkeypatch):
    """Points the app at a throwaway vector store directory and resets the
    module-level singleton, so tests never touch data/vector_store or leak
    state between test functions."""
    from app.core.config import get_settings
    from app.rag import store as store_module

    get_settings.cache_clear()
    settings = get_settings()
    monkeypatch.setattr(settings, "vector_store_path", tmp_vector_store_path)
    store_module._store = None
    yield
    store_module._store = None


@pytest.fixture(autouse=True)
def fake_embedding_model(monkeypatch):
    import numpy as np
    from app.rag import embeddings as embeddings_module

    def fake_embed(texts):
        rng = np.random.default_rng(abs(hash(tuple(texts))) % (2**31))
        vectors = rng.normal(size=(len(texts), 8)).astype(np.float32)
        vectors /= np.linalg.norm(vectors, axis=1, keepdims=True)
        return vectors

    monkeypatch.setattr(embeddings_module, "embed", fake_embed)


@pytest.fixture
def client():
    from main import app

    return fastapi_testclient.TestClient(app)


class TestHealth:
    def test_reports_zero_chunks_on_a_fresh_store(self, client):
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json()["data"]["knowledge_base_chunks"] == 0

    def test_reflects_ingested_chunk_count(self, client, return_policy_text):
        client.post(
            "/ingest",
            json={"document_id": 1, "filename": "return_policy.txt", "category": "policy", "text": return_policy_text},
        )
        res = client.get("/health")
        assert res.json()["data"]["knowledge_base_chunks"] > 0


class TestIngest:
    def test_ingests_a_real_policy_document(self, client, return_policy_text):
        res = client.post(
            "/ingest",
            json={"document_id": 1, "filename": "return_policy.txt", "category": "policy", "text": return_policy_text},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["document_id"] == 1
        assert body["chunk_count"] > 0
        assert len(body["chunks"]) == body["chunk_count"]
        assert all(c["chunk_uid"].startswith("1:") for c in body["chunks"])

    def test_rejects_whitespace_only_text_with_400(self, client):
        res = client.post("/ingest", json={"document_id": 2, "filename": "empty.txt", "text": "   \n  "})
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "empty_document"

    def test_rejects_missing_text_field_with_422(self, client):
        res = client.post("/ingest", json={"document_id": 3, "filename": "no-text.txt"})
        assert res.status_code == 422

    def test_category_is_optional(self, client):
        res = client.post("/ingest", json={"document_id": 4, "filename": "faq.txt", "text": "Some FAQ content here."})
        assert res.status_code == 200


class TestRemove:
    def test_removes_an_ingested_document(self, client, return_policy_text):
        ingest_res = client.post(
            "/ingest",
            json={"document_id": 5, "filename": "policy.txt", "text": return_policy_text},
        )
        chunk_count = ingest_res.json()["chunk_count"]

        remove_res = client.delete("/ingest/5")
        assert remove_res.status_code == 200
        assert remove_res.json()["removed"] == chunk_count

        health_res = client.get("/health")
        assert health_res.json()["data"]["knowledge_base_chunks"] == 0

    def test_removing_a_document_that_was_never_ingested_is_not_an_error(self, client):
        res = client.delete("/ingest/999")
        assert res.status_code == 200
        assert res.json()["removed"] == 0

    def test_removing_one_document_does_not_affect_another(self, client, return_policy_text):
        client.post("/ingest", json={"document_id": 10, "filename": "a.txt", "text": return_policy_text})
        client.post("/ingest", json={"document_id": 11, "filename": "b.txt", "text": return_policy_text})

        client.delete("/ingest/10")

        health_res = client.get("/health")
        assert health_res.json()["data"]["knowledge_base_chunks"] > 0
