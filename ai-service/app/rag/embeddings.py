"""Local sentence embeddings via sentence-transformers. CPU-only, no API key.

The model loads once per process (first call pays the cost, including a
one-time download from Hugging Face) and is reused for every embed() call
after that.
"""
from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_model = None


def _get_model():
    global _model
    if _model is None:
        # Imported lazily so importing this module doesn't force-load torch
        # for code paths (like /health) that never need embeddings.
        from sentence_transformers import SentenceTransformer

        settings = get_settings()
        logger.info("Loading embedding model %s (first call may download it)...", settings.embedding_model)
        _model = SentenceTransformer(settings.embedding_model, device="cpu")
        logger.info("Embedding model ready.")
    return _model


def embed(texts: list[str]):
    """Returns an (N, dim) float32 numpy array, L2-normalised so a plain dot
    product between two rows equals cosine similarity — the input the vector
    store's IndexFlatIP expects."""
    import numpy as np

    model = _get_model()
    vectors = model.encode(texts, convert_to_numpy=True, normalize_embeddings=True, show_progress_bar=False)
    return vectors.astype(np.float32)


def embedding_dimension() -> int:
    return _get_model().get_sentence_embedding_dimension()
