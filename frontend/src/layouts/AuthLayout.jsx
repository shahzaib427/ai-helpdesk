import StatusPill from "../components/StatusPill";

// The sign-in screen shows the product rather than describing it: a snapshot
// of a support queue sits beside the form, so the first thing a new agent or
// admin sees is the thing they are signing in to work on.
const SNAPSHOT = [
  { id: 4192, subject: "Charged twice for order 5012", status: "OPEN", who: "Priya" },
  { id: 4188, subject: "Return window on Aria Earbuds", status: "RESOLVED", who: "AI" },
  { id: 4181, subject: "Package marked delivered, not received", status: "IN_PROGRESS", who: "Marcus" },
  { id: 4176, subject: "Warranty claim, Nomad speaker", status: "WAITING_CUSTOMER", who: "Leila" },
];

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden bg-ink px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <p className="font-display text-2xl">Helpdesk</p>
          <p className="mt-1 text-sm text-white/55">Support console</p>
        </div>

        <div className="max-w-md">
          <h1 className="font-display text-4xl leading-tight">
            Every question answered once, then answered instantly.
          </h1>
          <p className="mt-4 text-white/65">
            Customers chat with an AI agent grounded in your own policy documents. Anything it
            cannot answer becomes a ticket on a human desk, with the whole conversation attached.
          </p>

          <div className="mt-8 rounded-lg border border-white/12 bg-white/[0.04] p-4">
            <p className="text-sm text-white/55">Queue right now</p>
            <ul className="mt-3 divide-y divide-white/10">
              {SNAPSHOT.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{item.subject}</p>
                    <p className="text-xs text-white/45">
                      #{item.id} &middot; {item.who}
                    </p>
                  </div>
                  <StatusPill value={item.status} />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="text-sm text-white/40">Sample data shown until you seed your own.</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-sm">{children}</div>
      </section>
    </div>
  );
}
