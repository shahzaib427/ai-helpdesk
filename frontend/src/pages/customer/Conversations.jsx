import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Alert from "../../components/Alert";
import Button from "../../components/Button";
import StatusPill from "../../components/StatusPill";
import { conversationsApi } from "../../api/conversations";
import { getSocket } from "../../socket";

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
  const [unreadIds, setUnreadIds] = useState(() => new Set());
  const joinedRoomsRef = useRef(new Set());

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

  // Join a room for every conversation currently in view, so this list page
  // hears about new messages and status changes without polling. Rejoins
  // whenever the visible set changes (e.g. after paging).
  useEffect(() => {
    const socket = getSocket();
    const currentIds = new Set(conversations.map((c) => String(c.id)));

    for (const id of currentIds) {
      if (!joinedRoomsRef.current.has(id)) {
        socket.emit("conversation:join", id);
        joinedRoomsRef.current.add(id);
      }
    }
    for (const id of joinedRoomsRef.current) {
      if (!currentIds.has(id)) {
        socket.emit("conversation:leave", id);
        joinedRoomsRef.current.delete(id);
      }
    }

    return () => {
      for (const id of joinedRoomsRef.current) socket.emit("conversation:leave", id);
      joinedRoomsRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations.map((c) => c.id).join(",")]);

  useEffect(() => {
    const socket = getSocket();

    const handleNewMessage = (message) => {
      const id = message.conversationId;
      setConversations((prev) => {
        const idx = prev.findIndex((c) => String(c.id) === String(id));
        if (idx === -1) return prev; // not one of ours / not in view
        const updated = { ...prev[idx], lastMessageAt: message.createdAt };
        const rest = prev.filter((_, i) => i !== idx);
        return [updated, ...rest];
      });
      // Only an agent's reply counts as "new" to read — the customer's own
      // sent messages shouldn't mark their own thread unread.
      if (message.senderType === "AGENT" || message.senderType === "AI") {
        setUnreadIds((prev) => new Set(prev).add(String(id)));
      }
    };

    const handleStatusUpdate = ({ id, status }) => {
      setConversations((prev) =>
        prev.map((c) => (String(c.id) === String(id) ? { ...c, status } : c))
      );
    };

    socket.on("message:new", handleNewMessage);
    socket.on("conversation:update", handleStatusUpdate);

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("conversation:update", handleStatusUpdate);
    };
  }, []);

  const openConversation = (id) => {
    setUnreadIds((prev) => {
      if (!prev.has(String(id))) return prev;
      const next = new Set(prev);
      next.delete(String(id));
      return next;
    });
  };

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
          conversations.map((conversation) => {
            const isUnread = unreadIds.has(String(conversation.id));
            return (
              <Link
                key={conversation.id}
                to={`/chat?c=${conversation.id}`}
                onClick={() => openConversation(conversation.id)}
                className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-ink/[0.03]"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  {isUnread && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-pine" aria-label="Unread" />
                  )}
                  <div className="min-w-0">
                    <p className={`truncate ${isUnread ? "font-semibold" : "font-medium"}`}>
                      {conversation.subject || "Conversation"}
                    </p>
                    <p className="mt-1 text-sm text-slate-550">{formatWhen(conversation.lastMessageAt)}</p>
                  </div>
                </div>
                <StatusPill value={conversation.status} />
              </Link>
            );
          })
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