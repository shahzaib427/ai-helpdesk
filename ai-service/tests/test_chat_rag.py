"""Tests for POST /chat with retrieval wired in. These are the tests that
matter most for Phase 5: do real ingested chunks actually reach the prompt,
does the AI stay honest when nothing matches, and does sources/used_rag come
back correctly for the frontend to render.

The echo provider is used throughout rather than mocking a real LLM, since
echo's whole purpose (see app/llm/echo_provider.py) is to prove the prompt
wiring is correct without needing a real model — these tests are exactly the
audience that design decision was made for.
"""
import pytest

pytest.importorskip("faiss", reason="faiss-cpu not installed")
pytest.importorskip("numpy", reason="numpy not installed")
fastapi_testclient = pytest.importorskip("fastapi.testclient", reason="fastapi not installed")


@pytest.fixture(autouse=True)
def isolated_vector_store(tmp_vector_store_path, monkeypatch):
    from app.core.config import get_settings
    from app.rag import store as store_module

    get_settings.cache_clear()
    settings = get_settings()
    monkeypatch.setattr(settings, "vector_store_path", tmp_vector_store_path)
    monkeypatch.setattr(settings, "llm_provider", "echo")
    store_module._store = None
    yield
    store_module._store = None


@pytest.fixture(autouse=True)
def fake_embedding_model(monkeypatch):
    import numpy as np
    from app.rag import embeddings as embeddings_module

    # 128 dims, not fewer: two independent random unit vectors need enough
    # dimensions for their cosine similarity to reliably land near zero. At
    # only 8 dims (tried first) two unrelated fake vectors cleared the
    # default 0.35 relevance threshold by chance often enough to make
    # test_unrelated_question_does_not_use_unrelated_document flaky.

    vectors = {}

    def fake_embed(texts):
        result = np.zeros((len(texts), 128), dtype=np.float32)
        for i, text in enumerate(texts):
            if text not in vectors:
                rng = np.random.default_rng(abs(hash(text)) % (2**31))
                v = rng.normal(size=128).astype(np.float32)
                v /= np.linalg.norm(v)
                vectors[text] = v
            result[i] = vectors[text]
        return result

    monkeypatch.setattr(embeddings_module, "embed", fake_embed)


@pytest.fixture(autouse=True)
def reset_llm_provider():
    from app.llm.provider import reset_llm_provider as _reset

    _reset()
    yield
    _reset()


@pytest.fixture
def client():
    from main import app

    return fastapi_testclient.TestClient(app)


def ingest(client, document_id, filename, text, category="policy"):
    res = client.post(
        "/ingest", json={"document_id": document_id, "filename": filename, "category": category, "text": text}
    )
    assert res.status_code == 200, res.text
    return res.json()


class TestGroundedChat:
    def test_question_with_no_knowledge_base_gets_no_rag(self, client):
        res = client.post("/chat", json={"message": "What is your return policy?"})
        assert res.status_code == 200
        body = res.json()
        assert body["used_rag"] is False
        assert body["sources"] == []

    def test_question_matching_ingested_content_uses_rag(self, client):
        # A short, single-paragraph document ingests as exactly one chunk,
        # so querying with that same text is guaranteed to hit the fake
        # embedding cache and score as an exact match — unlike a multi-
        # paragraph document, which gets split into chunks whose text is
        # never identical to the full document string.
        #
        # The text is deliberately neutral with respect to the Phase 6
        # router: no order/refund/return/ticket/product keywords, so it
        # falls through to the RAG path this test is actually checking,
        # rather than being intercepted as a tool intent first.
        chunk_text = "Northwind Electronics was founded in 2016 and ships to 24 countries."
        ingest(client, 1, "company_info.txt", chunk_text)

        res = client.post("/chat", json={"message": chunk_text})
        assert res.status_code == 200
        body = res.json()
        assert body["used_rag"] is True
        assert len(body["sources"]) > 0
        assert body["sources"][0]["document"] == "company_info.txt"

    def test_echo_provider_reply_names_the_source_when_grounded(self, client):
        chunk_text = "Northwind Electronics was founded in 2016 and ships to 24 countries."
        ingest(client, 1, "company_info.txt", chunk_text)
        res = client.post("/chat", json={"message": chunk_text})
        body = res.json()
        assert "company_info.txt" in body["reply"]
        assert "echo provider" in body["reply"]

    def test_unrelated_question_does_not_use_unrelated_document(self, client):
        chunk_text = "Northwind Electronics was founded in 2016 and ships to 24 countries."
        ingest(client, 1, "company_info.txt", chunk_text)
        # A message that was never ingested gets its own independent fake
        # embedding, which the default relevance threshold should reject as
        # not a real match.
        res = client.post("/chat", json={"message": "completely different unrelated question about kayaking"})
        body = res.json()
        assert body["used_rag"] is False
        assert body["sources"] == []

    def test_removed_document_is_no_longer_retrievable(self, client):
        chunk_text = "Northwind Electronics was founded in 2016 and ships to 24 countries."
        ingest(client, 1, "company_info.txt", chunk_text)
        client.delete("/ingest/1")

        res = client.post("/chat", json={"message": chunk_text})
        body = res.json()
        assert body["used_rag"] is False

    def test_response_includes_provider_and_model(self, client):
        res = client.post("/chat", json={"message": "hello"})
        body = res.json()
        assert body["provider"] == "echo"
        assert body["model"]
        assert isinstance(body["latency_ms"], int)

    def test_conversation_history_is_forwarded(self, client):
        res = client.post(
            "/chat",
            json={
                "message": "and what about international orders?",
                "history": [
                    {"role": "user", "content": "how long does shipping take?"},
                    {"role": "assistant", "content": "Standard shipping takes 2-4 working days."},
                ],
            },
        )
        assert res.status_code == 200

    def test_rejects_empty_message_with_422(self, client):
        res = client.post("/chat", json={"message": ""})
        assert res.status_code == 422

    def test_multiple_ingested_documents_can_both_be_cited(self, client):
        ingest(client, 1, "shipping.txt", "Northwind ships from Rotterdam, Toronto and Singapore.")
        ingest(client, 2, "returns.txt", "Items can be returned within 30 days of delivery.")

        # Query with text close to doc 1's content. Deliberately avoids the
        # word "shipping" itself, which would otherwise trip the router's
        # order_status intent and never reach retrieval at all.
        res = client.post("/chat", json={"message": "Northwind ships from Rotterdam, Toronto and Singapore."})
        body = res.json()
        assert body["used_rag"] is True
        assert body["sources"][0]["document"] == "shipping.txt"
