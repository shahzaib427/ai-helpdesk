export default function Field({ label, name, error, hint, className = "", ...rest }) {
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;

  return (
    <div className={className}>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={`field-input ${error ? "border-clay focus:border-clay focus:ring-clay/25" : ""}`}
        {...rest}
      />
      {error ? (
        <p id={`${name}-error`} className="mt-1.5 text-sm text-clay">
          {error}
        </p>
      ) : hint ? (
        <p id={`${name}-hint`} className="mt-1.5 text-sm text-slate-550">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
