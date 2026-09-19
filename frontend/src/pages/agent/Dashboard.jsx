import PhaseNotice from "../../components/PhaseNotice";

export default function AgentDashboard() {
  return (
    <div>
      <h1 className="font-display text-3xl">Today</h1>
      <div className="mt-6">
        <PhaseNotice
          title="Today"
          phase="3"
          description="What this agent needs to deal with right now."
          buildsOn={[
            "Assigned tickets by priority",
            "Conversations waiting for a human",
            "Chats the AI escalated in the last hour"
          ]}
        />
      </div>
    </div>
  );
}
