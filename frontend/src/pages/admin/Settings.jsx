import PhaseNotice from "../../components/PhaseNotice";

export default function AdminSettings() {
  return (
    <div>
      <h1 className="font-display text-3xl">Settings</h1>
      <div className="mt-6">
        <PhaseNotice
          title="Settings"
          phase="9"
          description="Operational settings for the platform."
          buildsOn={[
            "Which LLM provider and model are active",
            "Retrieval thresholds and handoff rules"
          ]}
        />
      </div>
    </div>
  );
}
