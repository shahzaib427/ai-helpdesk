import { useEffect, useState } from "react";
import Alert from "../../components/Alert";
import Button from "../../components/Button";
import Field from "../../components/Field";
import StatusPill from "../../components/StatusPill";
import { ordersApi } from "../../api/orders";
import { productsApi } from "../../api/products";
import { customersApi } from "../../api/customers";

const STATUSES = ["PENDING", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "—";
}

function NewOrderForm({ onCreated, onCancel }) {
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([{ productId: "", quantity: 1 }]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    productsApi.list({ limit: 100 }).then((res) => setProducts(res.data.products)).catch(() => {});
  }, []);

  const findCustomers = async () => {
    if (!customerSearch.trim()) return;
    try {
      const res = await customersApi.list({ search: customerSearch, limit: 10 });
      setCustomerResults(res.data.customers);
    } catch (err) {
      setError(err.message);
    }
  };

  const updateItem = (index, field, value) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const addItem = () => setItems((prev) => [...prev, { productId: "", quantity: 1 }]);
  const removeItem = (index) => setItems((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!selectedCustomer) {
      setError("Pick a customer first.");
      return;
    }
    const validItems = items.filter((i) => i.productId);
    if (validItems.length === 0) {
      setError("Add at least one item.");
      return;
    }
    setBusy(true);
    try {
      const order = await ordersApi.create({
        customerId: selectedCustomer.id,
        items: validItems.map((i) => ({ productId: Number(i.productId), quantity: Number(i.quantity) || 1 })),
      });
      onCreated(order);
    } catch (err) {
      setError(err.details?.[0]?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="panel mt-5 space-y-4 p-5" noValidate>
      {error && <Alert>{error}</Alert>}

      <div>
        <label className="mb-1.5 block text-sm font-medium">Customer</label>
        {selectedCustomer ? (
          <div className="flex items-center justify-between rounded-md border border-ink/15 px-3 py-2.5 text-[15px]">
            <span>
              {selectedCustomer.firstName} {selectedCustomer.lastName} &middot; {selectedCustomer.email}
            </span>
            <button
              type="button"
              onClick={() => setSelectedCustomer(null)}
              className="text-sm text-slate-550 underline underline-offset-2"
            >
              Change
            </button>
          </div>
        ) : (
          <div>
            <div className="flex gap-2">
              <input
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), findCustomers())}
                placeholder="Search by name or email…"
                className="field-input flex-1"
              />
              <Button type="button" variant="secondary" onClick={findCustomers}>
                Search
              </Button>
            </div>
            {customerResults.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-ink/10">
                {customerResults.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(c);
                      setCustomerResults([]);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-ink/5"
                  >
                    {c.firstName} {c.lastName} &middot; {c.email}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Items</label>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex gap-2">
              <select
                value={item.productId}
                onChange={(e) => updateItem(index, "productId", e.target.value)}
                className="field-input flex-1"
              >
                <option value="">Select a product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (${Number(p.price).toFixed(2)})
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) => updateItem(index, "quantity", e.target.value)}
                className="field-input w-20"
              />
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="px-2 text-slate-550 hover:text-clay"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={addItem} className="mt-2 text-sm text-pine underline underline-offset-2">
          + Add another item
        </button>
      </div>

      <div className="flex gap-2">
        <Button type="submit" busy={busy}>
          Place order
        </Button>
        <Button type="button" variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function OrderDetail({ order, onUpdate, savingField }) {
  const [tracking, setTracking] = useState({ trackingNumber: "", carrier: "", estimatedDelivery: "" });

  useEffect(() => {
    if (order) {
      setTracking({
        trackingNumber: order.trackingNumber || "",
        carrier: order.carrier || "",
        estimatedDelivery: order.estimatedDelivery || "",
      });
    }
  }, [order?.id]);

  if (!order) {
    return (
      <div className="panel flex h-full items-center justify-center p-8 text-center text-slate-550">
        Select an order to view it here.
      </div>
    );
  }

  const saveTracking = () => {
    const payload = Object.fromEntries(
      Object.entries(tracking).filter(([, value]) => value !== "")
    );
    onUpdate(payload);
  };

  return (
    <div className="panel h-full overflow-y-auto p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Order #{order.orderNumber}</h2>
          <p className="mt-1 text-sm text-slate-550">
            {order.customer?.user ? `${order.customer.user.firstName} ${order.customer.user.lastName}` : ""}{" "}
            &middot; Placed {formatDate(order.placedAt)}
          </p>
        </div>
        <p className="text-lg font-medium">${Number(order.totalAmount).toFixed(2)}</p>
      </div>

      <div className="mt-4">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Status</span>
          <select
            value={order.status}
            disabled={savingField === "status"}
            onChange={(e) => onUpdate({ status: e.target.value })}
            className="field-input"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field
          label="Tracking number"
          name="trackingNumber"
          value={tracking.trackingNumber}
          onChange={(e) => setTracking({ ...tracking, trackingNumber: e.target.value })}
        />
        <Field
          label="Carrier"
          name="carrier"
          value={tracking.carrier}
          onChange={(e) => setTracking({ ...tracking, carrier: e.target.value })}
        />
        <Field
          label="Estimated delivery"
          name="estimatedDelivery"
          type="date"
          value={tracking.estimatedDelivery || ""}
          onChange={(e) => setTracking({ ...tracking, estimatedDelivery: e.target.value })}
        />
      </div>
      <Button variant="secondary" className="mt-3" busy={savingField === "tracking"} onClick={saveTracking}>
        Save tracking details
      </Button>

      <div className="mt-6 border-t border-ink/10 pt-4">
        <p className="text-sm font-medium">Items</p>
        <div className="mt-2 divide-y divide-ink/8">
          {order.items?.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                {item.product?.name || `Product #${item.productId}`} &times; {item.quantity}
              </span>
              <span className="text-slate-550">${Number(item.unitPrice).toFixed(2)} each</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [savingField, setSavingField] = useState(null);

  const load = (page = 1) => {
    setLoading(true);
    setError("");
    ordersApi
      .list({ page, limit: 20, search: search || undefined, status: statusFilter || undefined })
      .then((res) => {
        setOrders(res.data.orders);
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
    ordersApi.get(selectedId).then(setSelected).catch((err) => setError(err.message));
  }, [selectedId]);

  const handleUpdate = async (updates) => {
    const field = "status" in updates ? "status" : "tracking";
    setSavingField(field);
    setError("");
    try {
      const updated = await ordersApi.update(selectedId, updates);
      setSelected(updated);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
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
          <h1 className="font-display text-3xl">Orders</h1>
          <p className="mt-1 text-slate-550">
            {meta.total} order{meta.total === 1 ? "" : "s"}.
          </p>
        </div>
        <Button onClick={() => setShowForm((open) => !open)} variant={showForm ? "secondary" : "primary"}>
          {showForm ? "Cancel" : "Place an order"}
        </Button>
      </div>

      {showForm && (
        <NewOrderForm
          onCreated={(order) => {
            setShowForm(false);
            load(1);
            setSelectedId(order.id);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(1)}
          placeholder="Search by order number or tracking…"
          className="field-input w-64"
        />
        <Button variant="secondary" onClick={() => load(1)}>
          Search
        </Button>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="field-input w-auto"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:h-[60vh] lg:grid-cols-[380px_1fr]">
        <div className="panel divide-y divide-ink/8 overflow-y-auto">
          {loading ? (
            <p className="p-5 text-slate-550">Loading orders…</p>
          ) : orders.length === 0 ? (
            <p className="p-5 text-slate-550">No orders match this filter.</p>
          ) : (
            orders.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => setSelectedId(order.id)}
                className={`block w-full px-4 py-3 text-left transition-colors ${
                  selectedId === order.id ? "bg-pine-light" : "hover:bg-ink/[0.03]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">#{order.orderNumber}</p>
                  <StatusPill value={order.status} />
                </div>
                <p className="mt-1 truncate text-xs text-slate-550">
                  {order.customerName || "Customer"} &middot; ${Number(order.totalAmount).toFixed(2)}
                </p>
              </button>
            ))
          )}
        </div>

        <OrderDetail order={selected} onUpdate={handleUpdate} savingField={savingField} />
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
