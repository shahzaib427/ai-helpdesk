import PhaseNotice from "../../components/PhaseNotice";

export default function AdminDashboard() {
  return (
    <div>
      <h1 className="font-display text-3xl">Overview</h1>
      <div className="mt-6">
        <PhaseNotice
          title="Overview"
          phase="8"
          description="How the support operation is doing."
          buildsOn={[
            "Customers, conversations, open and resolved tickets",
            "AI resolutions against human handoffs",
            "Average first response time",
            "Conversations over time, tickets by category, sentiment spread"
          ]}
        />
      </div>
    </div>
  );
}
