import { useEffect, useState } from "react";
import StatusPill from "./StatusPill";
import { customersApi } from "../api/customers";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export default function CustomerContextPanel({ customerId }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    setError("");
    customersApi
      .get(customerId)
      .then(setCustomer)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [customerId]);

  if (!customerId) {
    return (
      <div className="panel flex h-full items-center justify-center p-6 text-center text-sm text-slate-550">
        No customer selected.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="panel flex h-full items-center justify-center p-6 text-center text-sm text-slate-550">
        Loading customer…
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="panel flex h-full items-center justify-center p-6 text-center text-sm text-red-600">
        {error || "Could not load customer."}
      </div>
    );
  }

  return (
    <div className="panel h-full overflow-y-auto p-5">
      <div>
        <p className="font-display text-lg">
          {customer.firstName} {customer.lastName}
        </p>
        <p className="mt-0.5 text-sm text-slate-550">{customer.email}</p>
        {customer.phone && <p className="text-sm text-slate-550">{customer.phone}</p>}
        {(customer.city || customer.country) && (
          <p className="text-sm text-slate-550">
            {[customer.city, customer.country].filter(Boolean).join(", ")}
          </p>
        )}
        <p className="mt-1 text-xs text-slate-550">Customer since {formatDate(customer.createdAt)}</p>
      </div>

      <div className="mt-5 border-t border-ink/10 pt-4">
        <p className="text-sm font-medium">Recent orders</p>
        {customer.orders?.length ? (
          <div className="mt-2 space-y-2">
            {customer.orders.map((order) => (
              <div key={order.id} className="rounded-md bg-ink/[0.03] p-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">#{order.orderNumber}</span>
                  <StatusPill value={order.status} />
                </div>
                <p className="mt-1 text-xs text-slate-550">
                  {formatDate(order.placedAt)} &middot; ${order.totalAmount}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-550">No orders yet.</p>
        )}
      </div>

      <div className="mt-5 border-t border-ink/10 pt-4">
        <p className="text-sm font-medium">Past tickets</p>
        {customer.tickets?.length ? (
          <div className="mt-2 space-y-2">
            {customer.tickets.map((ticket) => (
              <div key={ticket.id} className="rounded-md bg-ink/[0.03] p-2.5 text-sm">
                <p className="truncate font-medium">{ticket.subject}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <StatusPill value={ticket.status} />
                  <StatusPill value={ticket.priority} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-550">No past tickets.</p>
        )}
      </div>
    </div>
  );
}