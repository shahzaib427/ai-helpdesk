import os
from pathlib import Path

import pytest


@pytest.fixture
def return_policy_text():
    path = Path(__file__).resolve().parents[2] / "knowledge-base" / "policies" / "return_policy.txt"
    return path.read_text(encoding="utf-8")


@pytest.fixture
def tmp_vector_store_path(tmp_path):
    """A fresh, empty directory for a VectorStore to persist into, isolated
    per test so tests never see each other's data or the real data/vector_store."""
    path = tmp_path / "vector_store"
    os.makedirs(path, exist_ok=True)
    return str(path)


@pytest.fixture
def fake_embeddings():
    """Deterministic, L2-normalised fake vectors — avoids downloading the
    real embedding model just to test store mechanics that don't care what
    the vectors actually mean, only that they're consistent 8-dim floats."""
    import numpy as np

    def _make(n: int, seed: int = 0, dim: int = 8):
        rng = np.random.default_rng(seed)
        vectors = rng.normal(size=(n, dim)).astype(np.float32)
        vectors /= np.linalg.norm(vectors, axis=1, keepdims=True)
        return vectors

    return _make
