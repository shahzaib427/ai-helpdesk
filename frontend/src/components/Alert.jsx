const TONES = {
  error: "bg-clay-light text-clay border-clay/25",
  info: "bg-pine-light text-pine-dark border-pine/25",
  warning: "bg-amber-light text-amber border-amber/25",
};

export default function Alert({ tone = "error", title, children }) {
  return (
    <div role="alert" className={`rounded-md border px-3.5 py-3 text-sm ${TONES[tone]}`}>
      {title && <p className="font-medium">{title}</p>}
      {children && <div className={title ? "mt-1" : ""}>{children}</div>}
    </div>
  );
}
