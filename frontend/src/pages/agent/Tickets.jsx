import { useEffect, useState } from "react";
import Alert from "../../components/Alert";
import Button from "../../components/Button";
import StatusPill from "../../components/StatusPill";
import { ticketsApi } from "../../api/tickets";
import { useAuth } from "../../context/AuthContext";
import { getSocket } from "../../socket";

const STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function formatDateTime(iso) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function TicketDetail({ ticket, onStatusChange, onPriorityChange, onAddNote, savingField, noteBusy }) {
  const [note, setNote] = useState("");

  if (!ticket) {
    return (
      <div className="panel flex h-full items-center justify-center p-8 text-center text-slate-550">
        Select a ticket to view it here.
      </div>
    );
  }

  const submitNote = (event) => {
    event.preventDefault();
    const trimmed = note.trim();
    if (!trimmed) return;
    onAddNote(trimmed);
    setNote("");
  };

  return (
    <div className="panel flex h-full flex-col overflow-hidden">
      <div className="overflow-y-auto p-5">
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
        </div>

        <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed">{ticket.description}</p>

        <div className="mt-6 border-t border-ink/10 pt-4">
          <p className="text-sm font-medium">Internal notes</p>
          <p className="text-xs text-slate-550">Only visible to staff, never to the customer.</p>

          <div className="mt-3 space-y-2.5">
            {(ticket.internalNotes || []).length === 0 ? (
              <p className="text-sm text-slate-550">No notes yet.</p>
            ) : (
              ticket.internalNotes.map((n, idx) => (
                <div key={idx} className="rounded-md bg-amber-light p-3 text-sm">
                  <p className="mb-1 text-xs text-slate-550">
                    {n.authorName} &middot; {formatDateTime(n.createdAt)}
                  </p>
                  {n.content}
                </div>
              ))
            )}
          </div>

          <form onSubmit={submitNote} className="mt-3 flex items-end gap-2">
            <textarea
              rows={1}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note only staff can see…"
              className="field-input flex-1 resize-none"
            />
            <Button type="submit" busy={noteBusy} disabled={!note.trim()}>
              Add
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function AgentTickets() {
  const { user } = useAuth();
  const [tab, setTab] = useState("queue"); // "queue" | "mine"
  const [statusFilter, setStatusFilter] = useState("");
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [savingField, setSavingField] = useState(null);
  const [noteBusy, setNoteBusy] = useState(false);
  const [unreadIds, setUnreadIds] = useState(() => new Set());

  const load = () => {
    setLoading(true);
    setError("");
    ticketsApi
      .list({ page: 1, limit: 50, mine: tab === "mine", status: statusFilter || undefined })
      .then((res) => setTickets(res.data.tickets))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, statusFilter]);

  useEffect(() => {
    if (!selectedId) return;
    ticketsApi.get(selectedId).then(setSelected).catch((err) => setError(err.message));
  }, [selectedId]);

  // Live queue: a new ticket lands, or another agent claims one visible here.
  useEffect(() => {
    const socket = getSocket();

    const handleNewTicket = (ticket) => {
      if (tab === "queue") {
        setTickets((prev) => [ticket, ...prev.filter((t) => t.id !== ticket.id)]);
        setUnreadIds((prev) => new Set(prev).add(String(ticket.id)));
      }
    };

    const handleClaimed = ({ id }) => {
      setTickets((prev) => prev.filter((t) => t.id !== id));
    };

    socket.on("ticket:new", handleNewTicket);
    socket.on("ticket:claimed", handleClaimed);

    return () => {
      socket.off("ticket:new", handleNewTicket);
      socket.off("ticket:claimed", handleClaimed);
    };
  }, [tab]);

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

  const handleAddNote = async (content) => {
    setNoteBusy(true);
    setError("");
    try {
      await ticketsApi.addNote(selectedId, content);
      await refreshSelected();
    } catch (err) {
      setError(err.message);
    } finally {
      setNoteBusy(false);
    }
  };

  const claimTicket = async (id) => {
    setError("");
    try {
      const agentProfileId = user.profile?.id;
      await ticketsApi.assign(id, agentProfileId ?? null);
      setSelectedId(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const openTicket = (id) => {
    setSelectedId(id);
    setUnreadIds((prev) => {
      if (!prev.has(String(id))) return prev;
      const next = new Set(prev);
      next.delete(String(id));
      return next;
    });
  };

  return (
    <div>
      <h1 className="font-display text-3xl">Tickets</h1>
      <p className="mt-1 text-slate-550">Unassigned tickets and the ones on your desk.</p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {[
          ["queue", "Queue"],
          ["mine", "Mine"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              tab === value ? "bg-ink text-white" : "bg-paper text-slate-550 hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="field-input ml-2 w-auto py-1.5 text-sm"
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

      <div className="mt-5 grid gap-4 lg:h-[65vh] lg:grid-cols-[360px_1fr]">
        <div className="panel divide-y divide-ink/8 overflow-y-auto">
          {loading ? (
            <p className="p-5 text-slate-550">Loading…</p>
          ) : tickets.length === 0 ? (
            <p className="p-5 text-slate-550">Nothing here right now.</p>
          ) : (
            tickets.map((ticket) => {
              const isUnread = unreadIds.has(String(ticket.id));
              return (
                <div
                  key={ticket.id}
                  className={`flex items-center justify-between gap-3 px-4 py-3 ${
                    selectedId === ticket.id ? "bg-pine-light" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => openTicket(ticket.id)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    {isUnread && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-pine" aria-label="Unread" />
                    )}
                    <div className="min-w-0">
                      <p className={`truncate text-sm ${isUnread ? "font-semibold" : "font-medium"}`}>
                        {ticket.subject}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <StatusPill value={ticket.status} />
                        <StatusPill value={ticket.priority} />
                      </div>
                    </div>
                  </button>
                  {tab === "queue" && (
                    <Button
                      variant="secondary"
                      className="shrink-0 px-2.5 py-1 text-xs"
                      onClick={() => claimTicket(ticket.id)}
                    >
                      Claim
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <TicketDetail
          ticket={selected}
          onStatusChange={handleStatusChange}
          onPriorityChange={handlePriorityChange}
          onAddNote={handleAddNote}
          savingField={savingField}
          noteBusy={noteBusy}
        />
      </div>
    </div>
  );
}