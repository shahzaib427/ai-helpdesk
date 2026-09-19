import PhaseNotice from "../../components/PhaseNotice";

export default function AdminAnalytics() {
  return (
    <div>
      <h1 className="font-display text-3xl">AI analytics</h1>
      <div className="mt-6">
        <PhaseNotice
          title="AI analytics"
          phase="8"
          description="What the AI actually did, and how well."
          buildsOn={[
            "Intent and sentiment breakdown per conversation",
            "Which tools ran, how often retrieval was used",
            "Latency, failures and provider errors"
          ]}
        />
      </div>
    </div>
  );
}
