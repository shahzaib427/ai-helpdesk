import { useEffect, useState } from "react";
import Alert from "../../components/Alert";
import BarChart from "../../components/charts/BarChart";
import SegmentedBar from "../../components/charts/SegmentedBar";
import { analyticsApi } from "../../api/analytics";

export default function AdminAnalytics() {
  const [charts, setCharts] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi
      .charts()
      .then(setCharts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-550">Loading analytics…</p>;
  if (error) return <Alert>{error}</Alert>;

  const intentData = charts.topIntents.map((i) => ({ label: i.intent, value: i.count }));
  const toolData = charts.toolUsage.map((t) => ({ label: t.tool, value: t.count }));
  const categoryData = charts.ticketsByCategory.map((c) => ({ label: c.category, value: c.count }));
  const handoffData = charts.handoffReasons.map((h) => ({ label: h.reason, value: h.count }));

  return (
    <div>
      <h1 className="font-display text-3xl">AI analytics</h1>
      <p className="mt-1 text-slate-550">
        What the AI has actually been doing — every number here comes from real conversations, not a demo.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <h2 className="font-display text-lg">Customer intents</h2>
          <p className="mt-1 text-sm text-slate-550">What people are actually asking about.</p>
          <div className="mt-4">
            <BarChart data={intentData} />
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="font-display text-lg">Sentiment</h2>
          <p className="mt-1 text-sm text-slate-550">
            A lightweight, rule-based read on tone — not a full sentiment model.
          </p>
          <div className="mt-4">
            <SegmentedBar
              segments={charts.sentimentDistribution.map((s) => ({ label: s.sentiment, value: s.count }))}
            />
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="font-display text-lg">Tool usage</h2>
          <p className="mt-1 text-sm text-slate-550">Which live lookups the AI actually called.</p>
          <div className="mt-4">
            <BarChart data={toolData} />
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="font-display text-lg">Why conversations escalated</h2>
          <p className="mt-1 text-sm text-slate-550">Reasons a human got looped in automatically.</p>
          <div className="mt-4">
            <BarChart data={handoffData} emptyMessage="No automatic escalations yet." />
          </div>
        </div>

        <div className="panel p-5 lg:col-span-2">
          <h2 className="font-display text-lg">Tickets by category</h2>
          <div className="mt-4">
            <BarChart data={categoryData} />
          </div>
        </div>
      </div>
    </div>
  );
}
