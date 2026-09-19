import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../layouts/AuthLayout";
import Alert from "../components/Alert";
import Button from "../components/Button";
import Field from "../components/Field";
import { useAuth, HOME_BY_ROLE } from "../context/AuthContext";

const EMPTY = { firstName: "", lastName: "", email: "", password: "", phone: "" };

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    setBusy(true);
    try {
      const user = await register(form);
      navigate(HOME_BY_ROLE[user.role], { replace: true });
    } catch (err) {
      // 422 responses carry per-field messages; show them next to the inputs.
      if (err.details) {
        setFieldErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <h2 className="font-display text-3xl">Create your account</h2>
      <p className="mt-2 text-slate-550">
        Takes a moment. Agent and admin accounts are created by an administrator.
      </p>

      <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="First name"
            name="firstName"
            value={form.firstName}
            onChange={update}
            error={fieldErrors.firstName}
            autoComplete="given-name"
            required
          />
          <Field
            label="Last name"
            name="lastName"
            value={form.lastName}
            onChange={update}
            error={fieldErrors.lastName}
            autoComplete="family-name"
            required
          />
        </div>

        <Field
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={update}
          error={fieldErrors.email}
          autoComplete="email"
          required
        />
        <Field
          label="Phone"
          name="phone"
          value={form.phone}
          onChange={update}
          error={fieldErrors.phone}
          hint="Optional. Helps an agent reach you about an order."
          autoComplete="tel"
        />
        <Field
          label="Password"
          name="password"
          type="password"
          value={form.password}
          onChange={update}
          error={fieldErrors.password}
          hint="At least 8 characters, with a letter and a number."
          autoComplete="new-password"
          required
        />

        <Button type="submit" busy={busy} className="w-full">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-sm text-slate-550">
        Already have an account?{" "}
        <Link to="/login" className="text-pine underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
