import { useEffect, useRef, useState } from "react";
import Alert from "../../components/Alert";
import Button from "../../components/Button";
import StatusPill from "../../components/StatusPill";
import { knowledgeApi } from "../../api/knowledge";

const CATEGORIES = ["company", "policies", "products", "faq"];

function formatDateTime(iso) {
  return iso
    ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";
}

function DocumentDetail({ document, onReindex, onDelete, busy }) {
  if (!document) {
    return (
      <div className="panel flex h-full items-center justify-center p-8 text-center text-slate-550">
        Select a document to see its chunks here.
      </div>
    );
  }

  return (
    <div className="panel flex h-full flex-col overflow-hidden">
      <div className="border-b border-ink/10 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">{document.filename}</h2>
            <p className="mt-1 text-sm text-slate-550">
              {document.category || "uncategorized"} &middot; uploaded {formatDateTime(document.createdAt)}
              {document.uploadedBy ? ` by ${document.uploadedBy}` : ""}
            </p>
          </div>
          <StatusPill value={document.status} />
        </div>

        {document.status === "FAILED" && document.errorMessage && (
          <div className="mt-3">
            <Alert>{document.errorMessage}</Alert>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Button variant="secondary" busy={busy === "reindex"} onClick={onReindex}>
            Re-index
          </Button>
          <Button variant="danger" busy={busy === "delete"} onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <p className="text-sm font-medium">
          {document.chunkCount} chunk{document.chunkCount === 1 ? "" : "s"}
        </p>
        {document.chunks?.length > 0 ? (
          <div className="mt-3 space-y-3">
            {document.chunks.map((chunk) => (
              <div key={chunk.id} className="rounded-md border border-ink/10 p-3 text-sm">
                <p className="mb-1.5 text-xs text-slate-550">Chunk {chunk.chunkIndex + 1}</p>
                <p className="whitespace-pre-wrap leading-relaxed">{chunk.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-550">
            {document.status === "PROCESSING" ? "Still indexing…" : "No chunks yet."}
          </p>
        )}
      </div>
    </div>
  );
}

export default function AdminKnowledgeBase() {
  const [documents, setDocuments] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [rowBusy, setRowBusy] = useState(null);

  const [category, setCategory] = useState(CATEGORIES[0]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  const load = (page = 1) => {
    setLoading(true);
    setError("");
    knowledgeApi
      .list({ page, limit: 20, status: statusFilter || undefined })
      .then((res) => {
        setDocuments(res.data.documents);
        setMeta(res.meta);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    if (!selectedId) return;
    knowledgeApi.get(selectedId).then(setSelected).catch((err) => setError(err.message));
  }, [selectedId]);

  const refreshSelected = async () => {
    if (!selectedId) return;
    const updated = await knowledgeApi.get(selectedId);
    setSelected(updated);
    setDocuments((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError("");
    setUploading(true);
    try {
      const doc = await knowledgeApi.upload(file, category);
      load(1);
      setSelectedId(doc.id);
      setSelected(doc);
    } catch (err) {
      setUploadError(err.details?.[0]?.message || err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleReindex = async () => {
    setRowBusy("reindex");
    setError("");
    try {
      await knowledgeApi.reindex(selectedId);
      await refreshSelected();
      load(meta.page);
    } catch (err) {
      setError(err.message);
    } finally {
      setRowBusy(null);
    }
  };

  const handleDelete = async () => {
    setRowBusy("delete");
    setError("");
    try {
      await knowledgeApi.remove(selectedId);
      setSelectedId(null);
      setSelected(null);
      load(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setRowBusy(null);
    }
  };

  return (
    <div>
      <h1 className="font-display text-3xl">Knowledge base</h1>
      <p className="mt-1 text-slate-550">The documents the AI is allowed to answer from. Plain text only for now.</p>

      <div className="panel mt-5 flex flex-wrap items-end gap-3 p-5">
        <div>
          <label htmlFor="category" className="mb-1.5 block text-sm font-medium">
            Category
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="field-input w-auto"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            onChange={handleFileChange}
            disabled={uploading}
            className="text-sm"
          />
          <p className="mt-1 text-xs text-slate-550">.txt files only, up to 5MB. PDF and DOCX arrive later.</p>
        </div>
        {uploading && <span className="text-sm text-slate-550">Uploading and indexing…</span>}
      </div>

      {uploadError && (
        <div className="mt-3">
          <Alert>{uploadError}</Alert>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {["", "PROCESSING", "READY", "FAILED"].map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              statusFilter === s ? "bg-ink text-white" : "bg-paper text-slate-550 hover:text-ink"
            }`}
          >
            {s ? s.toLowerCase() : "all"}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:h-[60vh] lg:grid-cols-[380px_1fr]">
        <div className="panel divide-y divide-ink/8 overflow-y-auto">
          {loading ? (
            <p className="p-5 text-slate-550">Loading documents…</p>
          ) : documents.length === 0 ? (
            <p className="p-5 text-slate-550">No documents match this filter.</p>
          ) : (
            documents.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => setSelectedId(doc.id)}
                className={`block w-full px-4 py-3 text-left transition-colors ${
                  selectedId === doc.id ? "bg-pine-light" : "hover:bg-ink/[0.03]"
                }`}
              >
                <p className="truncate text-sm font-medium">{doc.filename}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <StatusPill value={doc.status} />
                  <span className="text-xs text-slate-550">
                    {doc.chunkCount} chunk{doc.chunkCount === 1 ? "" : "s"}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        <DocumentDetail
          document={selected}
          onReindex={handleReindex}
          onDelete={handleDelete}
          busy={rowBusy}
        />
      </div>

      {meta.totalPages > 1 && (
        <div className="mt-4 flex items-center gap-3 text-sm text-slate-550">
          <Button variant="secondary" disabled={meta.page <= 1} onClick={() => load(meta.page - 1)}>
            Previous
          </Button>
          <span>
            Page {meta.page} of {meta.totalPages}
          </span>
          <Button variant="secondary" disabled={meta.page >= meta.totalPages} onClick={() => load(meta.page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
