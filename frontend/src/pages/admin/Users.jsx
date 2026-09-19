import { useCallback, useEffect, useState } from "react";
import Alert from "../../components/Alert";
import Button from "../../components/Button";
import Field from "../../components/Field";
import StatusPill from "../../components/StatusPill";
import { usersApi } from "../../api/users";

const NEW_USER = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  role: "AGENT",
  department: "",
};

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [roleFilter, setRoleFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(NEW_USER);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError("");
      try {
        const res = await usersApi.list({ page, limit: 20, role: roleFilter || undefined });
        setUsers(res.data.users);
        setMeta(res.meta);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [roleFilter]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const handleCreate = async (event) => {
    event.preventDefault();
    setFormError("");
    setBusy(true);
    try {
      await usersApi.create(form);
      setForm(NEW_USER);
      setShowForm(false);
      await load(meta.page);
    } catch (err) {
      setFormError(err.details?.[0]?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (user) => {
    try {
      if (user.isActive) await usersApi.deactivate(user.id);
      else await usersApi.update(user.id, { isActive: true });
      await load(meta.page);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">People</h1>
          <p className="mt-1 text-slate-550">
            {meta.total} account{meta.total === 1 ? "" : "s"}. Agents and admins are created here.
          </p>
        </div>
        <Button onClick={() => setShowForm((open) => !open)} variant={showForm ? "secondary" : "primary"}>
          {showForm ? "Cancel" : "Add a person"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="panel mt-5 space-y-4 p-5" noValidate>
          {formError && <Alert>{formError}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" name="firstName" value={form.firstName} onChange={update} required />
            <Field label="Last name" name="lastName" value={form.lastName} onChange={update} required />
            <Field label="Email" name="email" type="email" value={form.email} onChange={update} required />
            <Field
              label="Temporary password"
              name="password"
              type="password"
              hint="They can change it from their account page."
              value={form.password}
              onChange={update}
              required
            />
            <div>
              <label htmlFor="role" className="mb-1.5 block text-sm font-medium">
                Role
              </label>
              <select id="role" name="role" value={form.role} onChange={update} className="field-input">
                <option value="AGENT">Agent</option>
                <option value="ADMIN">Admin</option>
                <option value="CUSTOMER">Customer</option>
              </select>
            </div>
            {form.role === "AGENT" && (
              <Field label="Department" name="department" value={form.department} onChange={update} />
            )}
          </div>
          <Button type="submit" busy={busy}>
            Create account
          </Button>
        </form>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {["", "ADMIN", "AGENT", "CUSTOMER"].map((role) => (
          <button
            key={role || "all"}
            type="button"
            onClick={() => setRoleFilter(role)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              roleFilter === role ? "bg-ink text-white" : "bg-paper text-slate-550 hover:text-ink"
            }`}
          >
            {role ? role.toLowerCase() : "everyone"}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="panel mt-5 overflow-x-auto">
        {loading ? (
          <p className="p-6 text-slate-550">Loading people…</p>
        ) : users.length === 0 ? (
          <p className="p-6 text-slate-550">No accounts match this filter. Add one to get started.</p>
        ) : (
          <table className="w-full min-w-[640px] text-left text-[15px]">
            <thead className="border-b border-ink/10 text-sm text-slate-550">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-5 py-3">
                    {user.firstName} {user.lastName}
                  </td>
                  <td className="px-5 py-3 text-slate-550">{user.email}</td>
                  <td className="px-5 py-3">
                    <StatusPill value={user.role} />
                  </td>
                  <td className="px-5 py-3 text-slate-550">{user.isActive ? "Active" : "Deactivated"}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(user)}
                      className="text-sm text-slate-550 underline underline-offset-2 hover:text-ink"
                    >
                      {user.isActive ? "Deactivate" : "Reactivate"}
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
