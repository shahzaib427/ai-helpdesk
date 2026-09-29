import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Alert from "../../components/Alert";
import Button from "../../components/Button";
import StatusPill from "../../components/StatusPill";
import { useAuth } from "../../context/AuthContext";
import { ordersApi } from "../../api/orders";
import { ticketsApi } from "../../api/tickets";
import { conversationsApi } from "../../api/conversations";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function SectionCard({ title, actionLabel, actionTo, children }) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">{title}</h2>
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

export default function CustomerDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([
      ordersApi.list({ page: 1, limit: 3 }),
      ticketsApi.list({ page: 1, limit: 50 }), // pull more, filter open ones client-side
      conversationsApi.list({ page: 1, limit: 1 }),
    ])
      .then(([orderRes, ticketRes, convoRes]) => {
        setOrders(orderRes.data.orders || []);
        setTickets(ticketRes.data.tickets || []);
        setConversations(convoRes.data.conversations || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const openTickets = tickets.filter((t) => !["RESOLVED", "CLOSED"].includes(t.status));
  const latestConversation = conversations[0];

  if (loading) {
    return <p className="text-slate-550">Loading your dashboard…</p>;
  }

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-3xl">Welcome back, {user.firstName}</h1>
      <p className="mt-1 text-slate-550">Here's what's going on with your account.</p>

      {error && (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/chat">
          <Button>Get help</Button>
        </Link>
        <Link to="/tickets">
          <Button variant="secondary">Raise a ticket</Button>
        </Link>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <SectionCard title="Open tickets" actionTo="/tickets">
          {openTickets.length === 0 ? (
            <p className="text-sm text-slate-550">No open tickets right now.</p>
          ) : (
            <div className="space-y-2.5">
              {openTickets.slice(0, 3).map((ticket) => (
                <div key={ticket.id} className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm">{ticket.subject}</p>
                  <StatusPill value={ticket.status} />
                </div>
              ))}
              {openTickets.length > 3 && (
                <p className="text-xs text-slate-550">+{openTickets.length - 3} more</p>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Latest chat" actionTo="/conversations" actionLabel="Past chats">
          {!latestConversation ? (
            <p className="text-sm text-slate-550">No conversations yet.</p>
          ) : (
            <Link
              to={`/chat?c=${latestConversation.id}`}
              className="flex items-center justify-between gap-2 hover:opacity-80"
            >
              <p className="truncate text-sm">{latestConversation.subject || "Conversation"}</p>
              <StatusPill value={latestConversation.status} />
            </Link>
          )}
        </SectionCard>

        <SectionCard title="Recent orders" actionTo="/orders">
          {orders.length === 0 ? (
            <p className="text-sm text-slate-550">No orders yet.</p>
          ) : (
            <div className="space-y-2.5">
              {orders.map((order) => (
                <div key={order.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">#{order.orderNumber}</p>
                    <p className="text-xs text-slate-550">{formatDate(order.placedAt)}</p>
                  </div>
                  <StatusPill value={order.status} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Account">
          <p className="text-sm text-slate-550">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-sm text-slate-550">{user.email}</p>
          <Link to="/profile" className="mt-2 inline-block text-sm text-pine underline underline-offset-2">
            Manage account
          </Link>
        </SectionCard>
      </div>
    </div>
  );
}