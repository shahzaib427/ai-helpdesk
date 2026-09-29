import { useEffect, useState } from "react";
import Alert from "../../components/Alert";
import LineChart from "../../components/charts/LineChart";
import SegmentedBar from "../../components/charts/SegmentedBar";
import { analyticsApi } from "../../api/analytics";

function StatCard({ label, value, sub }) {
  return (
    <div className="panel p-5">
      <p className="text-sm text-slate-550">{label}</p>
      <p className="mt-1.5 font-display text-3xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-550">{sub}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [charts, setCharts] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([analyticsApi.overview(), analyticsApi.charts()])
      .then(([ov, ch]) => {
        setOverview(ov);
        setCharts(ch);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-slate-550">Loading dashboard…</p>;
  }

  if (error) {
    return <Alert>{error}</Alert>;
  }

  return (
    <div>
      <h1 className="font-display text-3xl">Overview</h1>
      <p className="mt-1 text-slate-550">How the support desk is doing right now.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Customers" value={overview.totalCustomers} />
        <StatCard label="Conversations" value={overview.totalConversations} />
        <StatCard label="Open tickets" value={overview.openTickets} />
        <StatCard label="Resolved tickets" value={overview.resolvedTickets} />
        <StatCard label="AI resolutions" value={overview.aiResolutions} />
        <StatCard label="Human handoffs" value={overview.humanHandoffs} />
        <StatCard
          label="AI resolution rate"
          value={`${Math.round(overview.aiResolutionRate * 100)}%`}
          sub="Conversations the AI handled alone"
        />
        <StatCard
          label="Avg. response time"
          value={overview.avgResponseTimeMs != null ? `${overview.avgResponseTimeMs}ms` : "—"}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <h2 className="font-display text-lg">Conversations, last 14 days</h2>
          <div className="mt-4">
            <LineChart data={charts.conversationsOverTime} />
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="font-display text-lg">AI vs. human resolution</h2>
          <div className="mt-4">
            <SegmentedBar
              segments={[
                { label: "ai", value: charts.resolutionBreakdown.ai },
                { label: "human", value: charts.resolutionBreakdown.human },
              ]}
            />
          </div>
        </div>
      </div>

      <p className="mt-6 text-sm text-slate-550">
        A closer look at intents, sentiment, and tool usage lives on{" "}
        <a href="/admin/analytics" className="text-pine underline underline-offset-2">
          AI analytics
        </a>
        .
      </p>
    </div>
  );
}
