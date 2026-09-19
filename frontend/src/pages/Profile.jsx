import { useState } from "react";
import Alert from "../components/Alert";
import Button from "../components/Button";
import Field from "../components/Field";
import StatusPill from "../components/StatusPill";
import { authApi } from "../api/auth";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user } = useAuth();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "" });
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus(null);
    setBusy(true);
    try {
      await authApi.changePassword(form);
      setForm({ currentPassword: "", newPassword: "" });
      setStatus({ tone: "info", message: "Password updated." });
    } catch (err) {
      setStatus({ tone: "error", message: err.details?.[0]?.message || err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl">Account</h1>

      <dl className="panel mt-6 divide-y divide-ink/10">
        {[
          ["Name", `${user.firstName} ${user.lastName}`],
          ["Email", user.email],
          ["Role", <StatusPill key="role" value={user.role} />],
          ["Last signed in", user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "First visit"],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 px-5 py-3.5">
            <dt className="text-slate-550">{label}</dt>
            <dd className="text-right">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="panel mt-6 p-5">
        <h2 className="font-display text-xl">Change password</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
          {status && <Alert tone={status.tone}>{status.message}</Alert>}
          <Field
            label="Current password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={update}
            required
          />
          <Field
            label="New password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters, with a letter and a number."
            value={form.newPassword}
            onChange={update}
            required
          />
          <Button type="submit" busy={busy}>
            Update password
          </Button>
        </form>
      </section>
    </div>
  );
}
