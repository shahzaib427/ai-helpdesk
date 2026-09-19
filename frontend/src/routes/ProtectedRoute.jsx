import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth, HOME_BY_ROLE } from "../context/AuthContext";

// Guards a branch of the route tree. `roles` narrows it further.
// The backend enforces the same rules; this only keeps the UI honest.
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-550">
        <span
          aria-hidden="true"
          className="h-5 w-5 animate-spin rounded-full border-2 border-pine border-t-transparent"
        />
        <span className="sr-only">Loading your session</span>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={HOME_BY_ROLE[user.role]} replace />;

  return <Outlet />;
}
