"""Local vector store: FAISS for similarity search, backed by two plain files
so the index survives a restart with no separate database.

Design choice worth explaining: FAISS's flat index has no cheap "delete row"
operation, so instead of trying to patch the index in place, deletion filters
the underlying arrays and rebuilds the (small, fast-to-rebuild) index from
what's left. embeddings.npy and metadata.json are the source of truth; the
FAISS index itself is treated as a disposable, rebuildable cache of them, and
is never written to disk separately — one pair of files to keep in sync
instead of three.

Modular on purpose: swapping FAISS for Qdrant later means writing a class
with the same add / remove_by_document / search / count methods and changing
what get_vector_store() constructs — nothing outside this file should need
to change.
"""
import json
import os
import threading

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class VectorStore:
    def __init__(self, path: str):
        self._path = path
        self._lock = threading.Lock()
        os.makedirs(path, exist_ok=True)
        self._embeddings_path = os.path.join(path, "embeddings.npy")
        self._metadata_path = os.path.join(path, "metadata.json")
        self._dim = None
        self._embeddings = None  # numpy array, lazily typed once we know dim
        self._metadata: list[dict] = []
        self._index = None
        self._load()

    def _load(self):
        import numpy as np

        if os.path.exists(self._metadata_path):
            with open(self._metadata_path, "r", encoding="utf-8") as f:
                self._metadata = json.load(f)
        if os.path.exists(self._embeddings_path):
            self._embeddings = np.load(self._embeddings_path)
            self._dim = self._embeddings.shape[1] if self._embeddings.shape[0] else None
        else:
            self._embeddings = None
        self._rebuild_index()

    def _rebuild_index(self):
        import numpy as np
        import faiss

        if self._embeddings is None or self._embeddings.shape[0] == 0 or self._dim is None:
            self._index = None
            return
        index = faiss.IndexFlatIP(self._dim)
        index.add(np.ascontiguousarray(self._embeddings, dtype=np.float32))
        self._index = index

    def _persist(self):
        import numpy as np

        if self._embeddings is not None:
            np.save(self._embeddings_path, self._embeddings)
        with open(self._metadata_path, "w", encoding="utf-8") as f:
            json.dump(self._metadata, f)

    def add(self, vectors, records: list[dict]) -> list[str]:
        """vectors: (N, dim) float32 array. records: N dicts, each must
        include a stable 'chunk_uid'. Returns the chunk_uids, in order."""
        import numpy as np

        if len(records) != vectors.shape[0]:
            raise ValueError("vectors and records must be the same length")

        with self._lock:
            if self._dim is None:
                self._dim = vectors.shape[1]
            if self._embeddings is None:
                self._embeddings = np.zeros((0, self._dim), dtype=np.float32)
            self._embeddings = np.vstack([self._embeddings, vectors.astype(np.float32)])
            self._metadata.extend(records)
            self._rebuild_index()
            self._persist()

        return [r["chunk_uid"] for r in records]

    def remove_by_document(self, document_id) -> int:
        import numpy as np

        with self._lock:
            if not self._metadata:
                return 0
            keep_mask = [m.get("document_id") != document_id for m in self._metadata]
            removed = len(self._metadata) - sum(keep_mask)
            if removed == 0:
                return 0

            self._metadata = [m for m, keep in zip(self._metadata, keep_mask) if keep]
            if self._embeddings is not None:
                self._embeddings = self._embeddings[np.array(keep_mask, dtype=bool)]
            self._rebuild_index()
            self._persist()
            return removed

    def search(self, query_vector, top_k: int = 4):
        """Returns up to top_k (metadata, score) pairs, highest similarity
        first. score is a cosine similarity in [-1, 1] since both the store
        and the query embeddings are L2-normalised."""
        import numpy as np

        if self._index is None or self._index.ntotal == 0:
            return []

        query = np.ascontiguousarray(query_vector.reshape(1, -1), dtype=np.float32)
        scores, indices = self._index.search(query, min(top_k, self._index.ntotal))

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx == -1:
                continue
            results.append((self._metadata[idx], float(score)))
        return results

    def count(self) -> int:
        return len(self._metadata)


_store = None


def get_vector_store() -> VectorStore:
    global _store
    if _store is None:
        settings = get_settings()
        _store = VectorStore(settings.vector_store_path)
    return _store
