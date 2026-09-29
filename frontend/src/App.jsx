import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth, HOME_BY_ROLE } from "./context/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import AppShell from "./layouts/AppShell";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

import CustomerChat from "./pages/customer/Chat";
import CustomerConversations from "./pages/customer/Conversations";
import CustomerTickets from "./pages/customer/Tickets";
import CustomerDashboard from "./pages/customer/Dashboard"; 

import AgentDashboard from "./pages/agent/Dashboard";
import AgentTickets from "./pages/agent/Tickets";
import AgentConversations from "./pages/agent/Conversations";
import AgentCustomers from "./pages/agent/Customers";

import AdminDashboard from "./pages/admin/Dashboard";
import AdminUsers from "./pages/admin/Users";
import AdminProducts from "./pages/admin/Products";
import AdminOrders from "./pages/admin/Orders";
import AdminTickets from "./pages/admin/Tickets";
import AdminKnowledgeBase from "./pages/admin/KnowledgeBase";
import AdminAnalytics from "./pages/admin/Analytics";
import AdminSettings from "./pages/admin/Settings";

function Landing() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? HOME_BY_ROLE[user.role] : "/login"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Everything below requires a session. The shell renders the nav for the role. */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Route>

<Route element={<ProtectedRoute roles={["CUSTOMER"]} />}>
  <Route element={<AppShell />}>
    <Route path="/dashboard" element={<CustomerDashboard />} /> {/* <-- add this route */}
    <Route path="/chat" element={<CustomerChat />} />
    <Route path="/conversations" element={<CustomerConversations />} />
    <Route path="/tickets" element={<CustomerTickets />} />
  </Route>
</Route>

      <Route element={<ProtectedRoute roles={["AGENT", "ADMIN"]} />}>
        <Route element={<AppShell />}>
          <Route path="/agent/dashboard" element={<AgentDashboard />} />
          <Route path="/agent/tickets" element={<AgentTickets />} />
          <Route path="/agent/conversations" element={<AgentConversations />} />
          <Route path="/agent/customers" element={<AgentCustomers />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
        <Route element={<AppShell />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/products" element={<AdminProducts />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route path="/admin/tickets" element={<AdminTickets />} />
          <Route path="/admin/knowledge-base" element={<AdminKnowledgeBase />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
