import { useEffect, useState } from "react";
import Alert from "../../components/Alert";
import Button from "../../components/Button";
import StatusPill from "../../components/StatusPill";
import { ticketsApi } from "../../api/tickets";
import { usersApi } from "../../api/users";

const STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function formatDateTime(iso) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function TicketDetail({ ticket, agents, onStatusChange, onPriorityChange, onAssign, savingField }) {
  if (!ticket) {
    return (
      <div className="panel flex h-full items-center justify-center p-8 text-center text-slate-550">
        Select a ticket to view it here.
      </div>
    );
  }

  return (
    <div className="panel h-full overflow-y-auto p-5">
      <h2 className="font-display text-xl">{ticket.subject}</h2>
      <p className="mt-1 text-sm text-slate-550">
        {ticket.customerName} &middot; {formatDateTime(ticket.createdAt)}
      </p>

      <div className="mt-4 flex flex-wrap gap-4">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Status</span>
          <select
            value={ticket.status}
            disabled={savingField === "status"}
            onChange={(e) => onStatusChange(e.target.value)}
            className="field-input"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ").toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Priority</span>
          <select
            value={ticket.priority}
            disabled={savingField === "priority"}
            onChange={(e) => onPriorityChange(e.target.value)}
            className="field-input"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Assigned to</span>
          <select
            value={ticket.assignedAgentId ?? ""}
            disabled={savingField === "assign"}
            onChange={(e) => onAssign(e.target.value ? Number(e.target.value) : null)}
            className="field-input"
          >
            <option value="">Unassigned</option>
            {agents.map((a) => (
              <option key={a.id} value={a.agentProfile?.id}>
                {a.firstName} {a.lastName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed">{ticket.description}</p>

      {ticket.internalNotes?.length > 0 && (
        <div className="mt-6 border-t border-ink/10 pt-4">
          <p className="text-sm font-medium">Internal notes</p>
          <div className="mt-3 space-y-2.5">
            {ticket.internalNotes.map((n, idx) => (
              <div key={idx} className="rounded-md bg-amber-light p-3 text-sm">
                <p className="mb-1 text-xs text-slate-550">
                  {n.authorName} &middot; {formatDateTime(n.createdAt)}
                </p>
                {n.content}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminTickets() {
  const [statusFilter, setStatusFilter] = useState("");
  const [tickets, setTickets] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [savingField, setSavingField] = useState(null);

  const load = () => {
    setLoading(true);
    setError("");
    ticketsApi
      .list({ page: 1, limit: 100, status: statusFilter || undefined })
      .then((res) => setTickets(res.data.tickets))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    usersApi.list({ role: "AGENT", limit: 100 }).then((res) => setAgents(res.data.users)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    if (!selectedId) return;
    ticketsApi.get(selectedId).then(setSelected).catch((err) => setError(err.message));
  }, [selectedId]);

  const refreshSelected = async () => {
    const updated = await ticketsApi.get(selectedId);
    setSelected(updated);
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
  };

  const handleStatusChange = async (status) => {
    setSavingField("status");
    setError("");
    try {
      await ticketsApi.updateStatus(selectedId, status);
      await refreshSelected();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingField(null);
    }
  };

  const handlePriorityChange = async (priority) => {
    setSavingField("priority");
    setError("");
    try {
      await ticketsApi.updatePriority(selectedId, priority);
      await refreshSelected();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingField(null);
    }
  };

  const handleAssign = async (assignedAgentId) => {
    setSavingField("assign");
    setError("");
    try {
      await ticketsApi.assign(selectedId, assignedAgentId);
      await refreshSelected();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingField(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">All tickets</h1>
          <p className="mt-1 text-slate-550">Every ticket across the desk.</p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="field-input w-auto py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ").toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:h-[65vh] lg:grid-cols-[380px_1fr]">
        <div className="panel divide-y divide-ink/8 overflow-y-auto">
          {loading ? (
            <p className="p-5 text-slate-550">Loading…</p>
          ) : tickets.length === 0 ? (
            <p className="p-5 text-slate-550">No tickets match this filter.</p>
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
                <p className="mt-0.5 truncate text-xs text-slate-550">{ticket.customerName}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <StatusPill value={ticket.status} />
                  <StatusPill value={ticket.priority} />
                </div>
              </button>
            ))
          )}
        </div>

        <TicketDetail
          ticket={selected}
          agents={agents}
          onStatusChange={handleStatusChange}
          onPriorityChange={handlePriorityChange}
          onAssign={handleAssign}
          savingField={savingField}
        />
      </div>
    </div>
  );
}
