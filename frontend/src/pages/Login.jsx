import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../layouts/AuthLayout";
import Alert from "../components/Alert";
import Button from "../components/Button";
import Field from "../components/Field";
import { useAuth, HOME_BY_ROLE } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await login(form);
      const destination = location.state?.from?.pathname || HOME_BY_ROLE[user.role];
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <h2 className="font-display text-3xl">Sign in</h2>
      <p className="mt-2 text-slate-550">Customers, agents and admins use the same door.</p>

      <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}

        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={update}
          required
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={update}
          required
        />

        <Button type="submit" busy={busy} className="w-full">
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-sm text-slate-550">
        New here?{" "}
        <Link to="/register" className="text-pine underline underline-offset-2">
          Create a customer account
        </Link>
      </p>

      <div className="mt-8 rounded-md border border-ink/10 bg-paper p-3.5 text-sm text-slate-550">
        <p className="font-medium text-ink">Seeded demo accounts</p>
        <p className="mt-1.5">admin@helpdesk.local &middot; priya@helpdesk.local &middot; amara@example.com</p>
        <p className="mt-1">Password for all three: Password123</p>
      </div>
    </AuthLayout>
  );
}
