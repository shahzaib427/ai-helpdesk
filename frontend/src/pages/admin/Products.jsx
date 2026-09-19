import { useEffect, useState } from "react";
import Alert from "../../components/Alert";
import Button from "../../components/Button";
import Field from "../../components/Field";
import { productsApi } from "../../api/products";

const EMPTY = {
  sku: "",
  name: "",
  description: "",
  category: "",
  price: "",
  stock: "",
  warrantyMonths: "12",
};

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = (page = 1) => {
    setLoading(true);
    setError("");
    productsApi
      .list({ page, limit: 20, search: search || undefined, includeInactive })
      .then((res) => {
        setProducts(res.data.products);
        setMeta(res.meta);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive]);

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const startCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setShowForm(true);
  };

  const startEdit = (product) => {
    setEditingId(product.id);
    setForm({
      sku: product.sku,
      name: product.name,
      description: product.description || "",
      category: product.category || "",
      price: String(product.price),
      stock: String(product.stock),
      warrantyMonths: String(product.warrantyMonths),
    });
    setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    setBusy(true);
    try {
      if (editingId) {
        await productsApi.update(editingId, form);
      } else {
        await productsApi.create(form);
      }
      setShowForm(false);
      setForm(EMPTY);
      setEditingId(null);
      load(meta.page);
    } catch (err) {
      setFormError(err.details?.[0]?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (product) => {
    try {
      if (product.isActive) await productsApi.retire(product.id);
      else await productsApi.reactivate(product.id);
      load(meta.page);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Products</h1>
          <p className="mt-1 text-slate-550">
            {meta.total} product{meta.total === 1 ? "" : "s"}.
          </p>
        </div>
        <Button onClick={showForm ? () => setShowForm(false) : startCreate} variant={showForm ? "secondary" : "primary"}>
          {showForm ? "Cancel" : "Add a product"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="panel mt-5 space-y-4 p-5" noValidate>
          {formError && <Alert>{formError}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SKU" name="sku" value={form.sku} onChange={update} required disabled={Boolean(editingId)} />
            <Field label="Name" name="name" value={form.name} onChange={update} required />
            <Field label="Category" name="category" value={form.category} onChange={update} />
            <Field label="Price (USD)" name="price" type="number" step="0.01" min="0" value={form.price} onChange={update} required />
            <Field label="Stock" name="stock" type="number" min="0" value={form.stock} onChange={update} />
            <Field
              label="Warranty (months)"
              name="warrantyMonths"
              type="number"
              min="0"
              value={form.warrantyMonths}
              onChange={update}
            />
          </div>
          <div>
            <label htmlFor="description" className="mb-1.5 block text-sm font-medium">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              value={form.description}
              onChange={update}
              className="field-input resize-none"
            />
          </div>
          <Button type="submit" busy={busy}>
            {editingId ? "Save changes" : "Create product"}
          </Button>
        </form>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(1)}
          placeholder="Search by name or SKU…"
          className="field-input w-64"
        />
        <Button variant="secondary" onClick={() => load(1)}>
          Search
        </Button>
        <label className="flex items-center gap-2 text-sm text-slate-550">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          Show retired products
        </label>
      </div>

      {error && (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="panel mt-5 overflow-x-auto">
        {loading ? (
          <p className="p-6 text-slate-550">Loading products…</p>
        ) : products.length === 0 ? (
          <p className="p-6 text-slate-550">No products match this filter.</p>
        ) : (
          <table className="w-full min-w-[720px] text-left text-[15px]">
            <thead className="border-b border-ink/10 text-sm text-slate-550">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Price</th>
                <th className="px-5 py-3 font-medium">Stock</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8">
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => startEdit(product)}
                      className="text-left hover:underline"
                    >
                      {product.name}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-slate-550">{product.sku}</td>
                  <td className="px-5 py-3 text-slate-550">{product.category || "—"}</td>
                  <td className="px-5 py-3">${Number(product.price).toFixed(2)}</td>
                  <td className="px-5 py-3 text-slate-550">{product.stock}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                        product.isActive ? "bg-pine-light text-pine-dark" : "bg-ink/8 text-slate-550"
                      }`}
                    >
                      {product.isActive ? "Active" : "Retired"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(product)}
                      className="text-sm text-slate-550 underline underline-offset-2 hover:text-ink"
                    >
                      {product.isActive ? "Retire" : "Reactivate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
