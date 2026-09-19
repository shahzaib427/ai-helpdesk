const VARIANTS = {
  primary: "bg-pine text-white hover:bg-pine-dark disabled:bg-pine/50",
  secondary: "bg-paper text-ink border border-ink/15 hover:border-ink/35 disabled:opacity-50",
  quiet: "text-slate-550 hover:text-ink hover:bg-ink/5 disabled:opacity-50",
  danger: "bg-clay text-white hover:brightness-95 disabled:opacity-50",
};

export default function Button({
  variant = "primary",
  type = "button",
  busy = false,
  className = "",
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={busy || rest.disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-[15px]
        font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {busy && (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
