import { Link } from "react-router-dom";

// Honest placeholder for screens that arrive in a later phase. Better than a
// fake UI: it says what the screen will do and where the work stands.
export default function PhaseNotice({ title, phase, description, buildsOn = [] }) {
  return (
    <div className="panel max-w-2xl p-6">
      <p className="text-sm text-slate-550">Arriving in phase {phase}</p>
      <h2 className="mt-1 font-display text-2xl">{title}</h2>
      <p className="mt-3 text-slate-550">{description}</p>

      {buildsOn.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-sm text-slate-550">
          {buildsOn.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-pine" />
              {item}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-5 text-sm text-slate-550">
        Phase 1 covers accounts, roles and the shell around these screens.{" "}
        <Link to="/profile" className="text-pine underline underline-offset-2">
          Check your account
        </Link>
        .
      </p>
    </div>
  );
}
