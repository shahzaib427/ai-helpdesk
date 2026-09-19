import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import StatusPill from "../components/StatusPill";

const NAV_BY_ROLE = {
  CUSTOMER: [
    { to: "/chat", label: "Get help" },
    { to: "/conversations", label: "Past chats" },
    { to: "/tickets", label: "My tickets" },
    { to: "/profile", label: "Account" },
  ],
  AGENT: [
    { to: "/agent/dashboard", label: "Today" },
    { to: "/agent/tickets", label: "Tickets" },
    { to: "/agent/conversations", label: "Live chats" },
    { to: "/agent/customers", label: "Customers" },
    { to: "/profile", label: "Account" },
  ],
  ADMIN: [
    { to: "/admin/dashboard", label: "Overview" },
    { to: "/admin/users", label: "People" },
    { to: "/admin/tickets", label: "Tickets" },
    { to: "/admin/knowledge-base", label: "Knowledge base" },
    { to: "/admin/products", label: "Products" },
    { to: "/admin/orders", label: "Orders" },
    { to: "/admin/analytics", label: "AI analytics" },
    { to: "/admin/settings", label: "Settings" },
    { to: "/profile", label: "Account" },
  ],
};

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const links = NAV_BY_ROLE[user.role] || [];

  const handleSignOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const navItem = ({ isActive }) =>
    `block rounded-md px-3 py-2 text-[15px] transition-colors ${
      isActive ? "bg-pine-light font-medium text-pine-dark" : "text-slate-550 hover:bg-ink/5 hover:text-ink"
    }`;

  return (
    <div className="min-h-screen lg:flex">
      <header className="flex items-center justify-between border-b border-ink/10 bg-paper px-4 py-3 lg:hidden">
        <span className="font-display text-lg">Helpdesk</span>
        <button
          type="button"
          onClick={() => setNavOpen((open) => !open)}
          className="rounded-md border border-ink/15 px-3 py-1.5 text-sm"
          aria-expanded={navOpen}
        >
          {navOpen ? "Close" : "Menu"}
        </button>
      </header>

      <aside
        className={`${navOpen ? "block" : "hidden"} border-b border-ink/10 bg-paper p-4
          lg:sticky lg:top-0 lg:block lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r`}
      >
        <div className="hidden lg:block">
          <p className="font-display text-xl">Helpdesk</p>
          <p className="mt-0.5 text-sm text-slate-550">Support console</p>
        </div>

        <nav className="mt-0 space-y-0.5 lg:mt-6">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={navItem} onClick={() => setNavOpen(false)}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-6 border-t border-ink/10 pt-4 lg:absolute lg:bottom-4 lg:w-56">
          <p className="truncate text-sm font-medium">
            {user.firstName} {user.lastName}
          </p>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-550">
            <StatusPill value={user.role} />
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-3 text-sm text-slate-550 underline underline-offset-2 hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 px-4 py-6 sm:px-8 sm:py-10">
        <Outlet />
      </main>
    </div>
  );
}
