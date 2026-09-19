// Ticket and conversation states carry meaning, so each gets its own colour
// rather than one neutral badge style everywhere.
const TONES = {
  OPEN: "bg-clay-light text-clay",
  IN_PROGRESS: "bg-amber-light text-amber",
  WAITING_CUSTOMER: "bg-amber-light text-amber",
  RESOLVED: "bg-pine-light text-pine-dark",
  CLOSED: "bg-ink/8 text-slate-550",
  ACTIVE: "bg-pine-light text-pine-dark",
  WITH_AGENT: "bg-amber-light text-amber",
  WAITING_AGENT: "bg-clay-light text-clay",
  URGENT: "bg-clay text-white",
  HIGH: "bg-clay-light text-clay",
  MEDIUM: "bg-amber-light text-amber",
  LOW: "bg-ink/8 text-slate-550",
  ADMIN: "bg-ink text-white",
  AGENT: "bg-pine-light text-pine-dark",
  CUSTOMER: "bg-ink/8 text-slate-550",
  PENDING: "bg-ink/8 text-slate-550",
  PAID: "bg-pine-light text-pine-dark",
  PROCESSING: "bg-amber-light text-amber",
  SHIPPED: "bg-amber-light text-amber",
  DELIVERED: "bg-pine-light text-pine-dark",
  CANCELLED: "bg-ink/8 text-slate-550",
  REFUNDED: "bg-clay-light text-clay",
  PROCESSING: "bg-amber-light text-amber",
  READY: "bg-pine-light text-pine-dark",
  FAILED: "bg-clay-light text-clay",
};

export default function StatusPill({ value }) {
  const label = String(value).replace(/_/g, " ").toLowerCase();
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium capitalize ${
        TONES[value] || "bg-ink/8 text-slate-550"
      }`}
    >
      {label}
    </span>
  );
}
