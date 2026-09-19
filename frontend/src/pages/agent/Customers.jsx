import { useState } from "react";
import Alert from "../../components/Alert";
import Button from "../../components/Button";
import StatusPill from "../../components/StatusPill";
import { customersApi } from "../../api/customers";

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "—";
}

function CustomerDetail({ customer }) {
  if (!customer) {
    return (
      <div className="panel flex h-full items-center justify-center p-8 text-center text-slate-550">
        Search for a customer and select them to see their history here.
      </div>
    );
  }

  return (
    <div className="panel h-full overflow-y-auto p-5">
      <h2 className="font-display text-xl">
        {customer.firstName} {customer.lastName}
      </h2>
      <p className="mt-1 text-sm text-slate-550">{customer.email}</p>
      <div className="mt-2 space-y-0.5 text-sm text-slate-550">
        {customer.phone && <p>{customer.phone}</p>}
        {(customer.city || customer.country) && (
          <p>{[customer.city, customer.country].filter(Boolean).join(", ")}</p>
        )}
        <p>Customer since {formatDate(customer.createdAt)}</p>
      </div>

      <div className="mt-6 border-t border-ink/10 pt-4">
        <p className="text-sm font-medium">Recent orders</p>
        {customer.orders?.length === 0 || !customer.orders ? (
          <p className="mt-2 text-sm text-slate-550">No orders yet.</p>
        ) : (
          <div className="mt-2 divide-y divide-ink/8">
            {customer.orders.map((order) => (
              <div key={order.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  #{order.orderNumber} &middot; {formatDate(order.placedAt)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-550">${Number(order.totalAmount).toFixed(2)}</span>
                  <StatusPill value={order.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 border-t border-ink/10 pt-4">
        <p className="text-sm font-medium">Recent tickets</p>
        {customer.tickets?.length === 0 || !customer.tickets ? (
          <p className="mt-2 text-sm text-slate-550">No tickets yet.</p>
        ) : (
          <div className="mt-2 divide-y divide-ink/8">
            {customer.tickets.map((ticket) => (
              <div key={ticket.id} className="flex items-center justify-between py-2 text-sm">
                <span className="truncate">{ticket.subject}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusPill value={ticket.priority} />
                  <StatusPill value={ticket.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 border-t border-ink/10 pt-4">
        <p className="text-sm font-medium">Recent conversations</p>
        {customer.conversations?.length === 0 || !customer.conversations ? (
          <p className="mt-2 text-sm text-slate-550">No conversations yet.</p>
        ) : (
          <div className="mt-2 divide-y divide-ink/8">
            {customer.conversations.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 text-sm">
                <span className="truncate">{c.subject || "Conversation"}</span>
                <StatusPill value={c.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AgentCustomers() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const runSearch = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await customersApi.list({ search: search || undefined, limit: 20 });
      setResults(res.data.customers);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectCustomer = async (id) => {
    setSelectedId(id);
    setError("");
    try {
      const customer = await customersApi.get(id);
      setSelected(customer);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h1 className="font-display text-3xl">Customers</h1>
      <p className="mt-1 text-slate-550">Search for someone to see their orders, tickets and chats.</p>

      <div className="mt-5 flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          placeholder="Search by name or email…"
          className="field-input w-72"
        />
        <Button variant="secondary" onClick={runSearch} busy={loading}>
          Search
        </Button>
      </div>

      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:h-[60vh] lg:grid-cols-[340px_1fr]">
        <div className="panel divide-y divide-ink/8 overflow-y-auto">
          {results.length === 0 ? (
            <p className="p-5 text-slate-550">Search to find a customer.</p>
          ) : (
            results.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => selectCustomer(customer.id)}
                className={`block w-full px-4 py-3 text-left transition-colors ${
                  selectedId === customer.id ? "bg-pine-light" : "hover:bg-ink/[0.03]"
                }`}
              >
                <p className="text-sm font-medium">
                  {customer.firstName} {customer.lastName}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-550">{customer.email}</p>
              </button>
            ))
          )}
        </div>

        <CustomerDetail customer={selected} />
      </div>
    </div>
  );
}
