import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Alert from "../../components/Alert";
import StatusPill from "../../components/StatusPill";
import { ticketsApi } from "../../api/tickets";
import { conversationsApi } from "../../api/conversations";

function formatWhen(iso) {
  const date = new Date(iso);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

const PRIORITY_ORDER = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function SectionCard({ title, count, actionTo, actionLabel, children }) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">
          {title}
          {typeof count === "number" && <span className="ml-2 text-sm font-normal text-slate-550">{count}</span>}
        </h2>
        {actionTo && (
          <Link to={actionTo} className="text-sm text-pine underline underline-offset-2">
            {actionLabel || "View all"}
          </Link>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export default function AgentDashboard() {
  const [myTickets, setMyTickets] = useState([]);
  const [waitingConversations, setWaitingConversations] = useState([]);
  const [escalated, setEscalated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([
      ticketsApi.list({ page: 1, limit: 100, mine: true }),
      conversationsApi.list({ page: 1, limit: 50, mine: false }),
    ])
      .then(([ticketRes, convoRes]) => {
        const tickets = (ticketRes.data.tickets || [])
          .filter((t) => !["RESOLVED", "CLOSED"].includes(t.status))
          .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4));
        setMyTickets(tickets);

        const conversations = convoRes.data.conversations || [];
        const waiting = conversations.filter((c) => c.status === "WAITING_AGENT");
        setWaitingConversations(waiting);

        // "Escalated in the last hour": waiting conversations whose last
        // activity was AI-driven and recent — a reasonable proxy without a
        // dedicated backend field, since transitionToHuman always stamps
        // lastMessageAt at the moment of handoff.
// "AI escalated in the last hour": the AI's router decided a human was
// needed (handoffReason is set), as opposed to the customer clicking
// "Ask for a human" directly (handoffReason is null).
const oneHourAgo = Date.now() - 60 * 60 * 1000;
const recentEscalations = waiting.filter(
  (c) => c.handoffReason && new Date(c.lastMessageAt).getTime() >= oneHourAgo
);
setEscalated(recentEscalations);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-slate-550">Loading today's queue…</p>;
  }

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-3xl">Today</h1>
      <p className="mt-1 text-slate-550">What you need to deal with right now.</p>

      {error && (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <SectionCard
          title="Your open tickets"
          count={myTickets.length}
          actionTo="/agent/tickets"
          actionLabel="All tickets"
        >
          {myTickets.length === 0 ? (
            <p className="text-sm text-slate-550">Nothing assigned to you right now.</p>
          ) : (
            <div className="space-y-2.5">
              {myTickets.slice(0, 5).map((ticket) => (
                <div key={ticket.id} className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm">{ticket.subject}</p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <StatusPill value={ticket.priority} />
                    <StatusPill value={ticket.status} />
                  </div>
                </div>
              ))}
              {myTickets.length > 5 && (
                <p className="text-xs text-slate-550">+{myTickets.length - 5} more</p>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Waiting for a human"
          count={waitingConversations.length}
          actionTo="/agent/conversations"
          actionLabel="Live chats"
        >
          {waitingConversations.length === 0 ? (
            <p className="text-sm text-slate-550">Nothing waiting right now.</p>
          ) : (
            <div className="space-y-2.5">
              {waitingConversations.slice(0, 5).map((c) => (
                <Link
                  key={c.id}
                  to="/agent/conversations"
                  className="flex items-center justify-between gap-2 hover:opacity-80"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{c.subject || "Conversation"}</p>
                    <p className="text-xs text-slate-550">{c.customerName}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-550">{formatWhen(c.lastMessageAt)}</span>
                </Link>
              ))}
              {waitingConversations.length > 5 && (
                <p className="text-xs text-slate-550">+{waitingConversations.length - 5} more</p>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard title="AI escalated in the last hour" count={escalated.length}>
          {escalated.length === 0 ? (
            <p className="text-sm text-slate-550">No recent escalations.</p>
          ) : (
            <div className="space-y-2.5">
              {escalated.map((c) => (
                <Link
                  key={c.id}
                  to="/agent/conversations"
                  className="flex items-center justify-between gap-2 hover:opacity-80"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{c.subject || "Conversation"}</p>
                    <p className="text-xs text-slate-550">{c.customerName}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-550">{formatWhen(c.lastMessageAt)}</span>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}