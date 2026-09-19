import { useEffect, useState } from "react";
import Alert from "../../components/Alert";
import Button from "../../components/Button";
import Field from "../../components/Field";
import StatusPill from "../../components/StatusPill";
import { ticketsApi } from "../../api/tickets";

const EMPTY = { subject: "", description: "", category: "general" };

function formatDate(iso) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function TicketDetail({ ticket }) {
  if (!ticket) {
    return (
      <div className="panel flex h-full items-center justify-center p-8 text-center text-slate-550">
        Select a ticket to view it here.
      </div>
    );
  }

  return (
    <div className="panel h-full overflow-y-auto p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-xl">{ticket.subject}</h2>
        <StatusPill value={ticket.status} />
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm text-slate-550">
        <StatusPill value={ticket.priority} />
        <span>&middot;</span>
        <span className="capitalize">{ticket.category}</span>
        <span>&middot;</span>
        <span>{formatDate(ticket.createdAt)}</span>
      </div>
      <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed">{ticket.description}</p>
      {ticket.resolvedAt && (
        <p className="mt-4 text-sm text-slate-550">Resolved {formatDate(ticket.resolvedAt)}.</p>
      )}
    </div>
  );
}

export default function CustomerTickets() {
  const [tickets, setTickets] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = (page = 1) => {
    setLoading(true);
    setError("");
    ticketsApi
      .list({ page, limit: 20 })
      .then((res) => {
        setTickets(res.data.tickets);
        setMeta(res.meta);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(1);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    ticketsApi.get(selectedId).then(setSelected).catch((err) => setError(err.message));
  }, [selectedId]);

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const handleCreate = async (event) => {
    event.preventDefault();
    setFormError("");
    setBusy(true);
    try {
      const ticket = await ticketsApi.create(form);
      setForm(EMPTY);
      setShowForm(false);
      load(1);
      setSelectedId(ticket.id);
      setSelected(ticket);
    } catch (err) {
      setFormError(err.details?.[0]?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">My tickets</h1>
          <p className="mt-1 text-slate-550">
            {meta.total} ticket{meta.total === 1 ? "" : "s"}.
          </p>
        </div>
        <Button onClick={() => setShowForm((open) => !open)} variant={showForm ? "secondary" : "primary"}>
          {showForm ? "Cancel" : "Raise a ticket"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="panel mt-5 space-y-4 p-5" noValidate>
          {formError && <Alert>{formError}</Alert>}
          <Field label="Subject" name="subject" value={form.subject} onChange={update} required />
          <div>
            <label htmlFor="description" className="mb-1.5 block text-sm font-medium">
              What's going on?
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              value={form.description}
              onChange={update}
              required
              className="field-input resize-none"
            />
          </div>
          <div>
            <label htmlFor="category" className="mb-1.5 block text-sm font-medium">
              Category
            </label>
            <select
              id="category"
              name="category"
              value={form.category}
              onChange={update}
              className="field-input"
            >
              {["general", "returns", "shipping", "billing", "product", "technical"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" busy={busy}>
            Submit ticket
          </Button>
        </form>
      )}

      {error && (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:h-[60vh] lg:grid-cols-[360px_1fr]">
        <div className="panel divide-y divide-ink/8 overflow-y-auto">
          {loading ? (
            <p className="p-5 text-slate-550">Loading tickets…</p>
          ) : tickets.length === 0 ? (
            <p className="p-5 text-slate-550">No tickets yet. Raise one if you need help.</p>
          ) : (
            tickets.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                onClick={() => setSelectedId(ticket.id)}
                className={`block w-full px-4 py-3 text-left transition-colors ${
                  selectedId === ticket.id ? "bg-pine-light" : "hover:bg-ink/[0.03]"
                }`}
              >
                <p className="truncate text-sm font-medium">{ticket.subject}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <StatusPill value={ticket.status} />
                  <span className="text-xs text-slate-550">{formatDate(ticket.createdAt)}</span>
                </div>
              </button>
            ))
          )}
        </div>

        <TicketDetail ticket={selected} />
      </div>

      {meta.totalPages > 1 && (
        <div className="mt-4 flex items-center gap-3 text-sm text-slate-550">
          <Button variant="secondary" disabled={meta.page <= 1} onClick={() => load(meta.page - 1)}>
            Previous
          </Button>
          <span>
            Page {meta.page} of {meta.totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={meta.page >= meta.totalPages}
            onClick={() => load(meta.page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
