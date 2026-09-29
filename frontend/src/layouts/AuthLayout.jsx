// AuthLayout.jsx
export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-ink px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <p className="font-display text-2xl">Helpdesk</p>
          <p className="mt-1 text-sm text-white/55">Support console</p>
        </div>

        <div className="max-w-md">
          <h1 className="font-display text-4xl leading-tight">
            Every question answered once, then answered instantly.
          </h1>
          <p className="mt-4 text-white/65">
            An AI agent grounded in your own policy documents handles what it can. Anything it
            can't gets handed to a person, with the full conversation attached — nothing repeated,
            nothing lost.
          </p>

          <HandoffDiagram />

          <ul className="mt-8 space-y-2.5 text-sm text-white/70">
            {[
              "Answers grounded in your knowledge base, not guesses",
              "Live handoff to a human, mid-conversation, with context intact",
              "One inbox for chats and tickets, whoever's handling them",
            ].map((item) => (
              <li key={item} className="flex gap-2.5">
                <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-pine" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-white/35">Built for support teams who'd rather solve things than triage them.</p>

        {/* One quiet decorative moment, not fake data: a soft glow anchored
            behind the diagram, echoing the handoff it illustrates. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-pine/10 blur-3xl"
        />
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-sm">{children}</div>
      </section>
    </div>
  );
}

// A small, honest diagram of the product's actual mechanism — customer
// message in, AI resolves or hands off, person picks up where it left off.
// No fabricated numbers or names, just the shape of what the system does.
function HandoffDiagram() {
  return (
    <div className="mt-8 rounded-lg border border-white/12 bg-white/[0.04] p-5">
      <svg viewBox="0 0 320 88" className="w-full" role="img" aria-label="A customer message goes to the AI assistant, which either resolves it or hands it to a support agent">
        {/* connecting line */}
        <line x1="40" y1="44" x2="280" y2="44" stroke="white" strokeOpacity="0.14" strokeWidth="1.5" />
        <line x1="160" y1="44" x2="160" y2="44" stroke="white" strokeOpacity="0" />

        {/* Customer node */}
        <circle cx="40" cy="44" r="20" fill="white" fillOpacity="0.08" stroke="white" strokeOpacity="0.25" />
        <path d="M32 50c0-5 4-8 8-8s8 3 8 8" stroke="white" strokeOpacity="0.7" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <circle cx="40" cy="37" r="4" fill="white" fillOpacity="0.7" />

        {/* AI node (center, emphasized with pine) */}
        <circle cx="160" cy="44" r="24" fill="#1a5f4a" fillOpacity="0.35" stroke="#4fb894" strokeWidth="1.5" />
        <path
          d="M150 44l6 6 12-12"
          stroke="#8fd9bd"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* branch down to agent */}
        <path d="M180 52c14 8 26 12 40 12" stroke="white" strokeOpacity="0.14" strokeWidth="1.5" fill="none" />

        {/* Agent node */}
        <circle cx="280" cy="44" r="20" fill="white" fillOpacity="0.08" stroke="white" strokeOpacity="0.25" />
        <circle cx="280" cy="37" r="6" fill="white" fillOpacity="0.7" />
        <path d="M269 56c1.5-6 6-9 11-9s9.5 3 11 9" stroke="white" strokeOpacity="0.7" strokeWidth="1.6" fill="none" strokeLinecap="round" />

        <text x="40" y="80" textAnchor="middle" fill="white" fillOpacity="0.45" fontSize="10">Customer</text>
        <text x="160" y="80" textAnchor="middle" fill="#8fd9bd" fontSize="10">AI assistant</text>
        <text x="280" y="80" textAnchor="middle" fill="white" fillOpacity="0.45" fontSize="10">Agent</text>
      </svg>
    </div>
  );
}