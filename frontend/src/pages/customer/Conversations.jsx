import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Alert from "../../components/Alert";
import Button from "../../components/Button";
import StatusPill from "../../components/StatusPill";
import { conversationsApi } from "../../api/conversations";

function formatWhen(iso) {
  if (!iso) return "No messages yet";
  const date = new Date(iso);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function CustomerConversations() {
  const [conversations, setConversations] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = (page = 1) => {
    setLoading(true);
    setError("");
    conversationsApi
      .list({ page, limit: 20 })
      .then((res) => {
        setConversations(res.data.conversations);
        setMeta(res.meta);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Past chats</h1>
          <p className="mt-1 text-slate-550">
            {meta.total} conversation{meta.total === 1 ? "" : "s"}.
          </p>
        </div>
        <Link to="/chat">
          <Button>Start a new chat</Button>
        </Link>
      </div>

      {error && (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="panel mt-5 divide-y divide-ink/8">
        {loading ? (
          <p className="p-6 text-slate-550">Loading conversations…</p>
        ) : conversations.length === 0 ? (
          <div className="p-6 text-center text-slate-550">
            <p>You haven't started a conversation yet.</p>
            <Link to="/chat" className="mt-2 inline-block text-pine underline underline-offset-2">
              Get help now
            </Link>
          </div>
        ) : (
          conversations.map((conversation) => (
            <Link
              key={conversation.id}
              to={`/chat?c=${conversation.id}`}
              className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-ink/[0.03]"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{conversation.subject || "Conversation"}</p>
                <p className="mt-1 text-sm text-slate-550">{formatWhen(conversation.lastMessageAt)}</p>
              </div>
              <StatusPill value={conversation.status} />
            </Link>
          ))
        )}
      </div>

      {meta.totalPages > 1 && (
        <div className="mt-4 flex items-center gap-3 text-sm text-slate-550">
          <Button variant="secondary" disabled={meta.page <= 1} onClick={() => load(meta.page - 1)}>
            Previous
          </Button>
          <span>
            Page {meta.page} of {meta.totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={meta.page >= meta.totalPages}
            onClick={() => load(meta.page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
