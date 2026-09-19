# RAG package (Phase 4-5)

Files land here in order:

- `loader.py`     read TXT first, then PDF and DOCX behind the same interface
- `splitter.py`   clean text and split into overlapping chunks
- `embeddings.py` local all-MiniLM-L6-v2 encoder, CPU only
- `store.py`      vector-store interface + FAISS implementation (Qdrant later)
- `retriever.py`  similarity search with a relevance threshold
- `pipeline.py`   ingest and query pipelines end to end
