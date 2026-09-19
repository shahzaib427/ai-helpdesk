import { useEffect, useRef, useState } from "react";
import Alert from "../../components/Alert";
import Button from "../../components/Button";
import StatusPill from "../../components/StatusPill";
import { conversationsApi } from "../../api/conversations";

const SENDER_LABEL = { CUSTOMER: "Customer", AI: "AI Assistant", AGENT: "You", SYSTEM: "System" };

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function Thread({ conversation, onSend, sending }) {
  const [value, setValue] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [conversation?.messages?.length]);

  const canReply = conversation?.status === "WITH_AGENT";

  const submit = (event) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || sending) return;
    onSend(trimmed);
    setValue("");
  };

  if (!conversation) {
    return (
      <div className="panel flex h-full items-center justify-center p-8 text-center text-slate-550">
        Select a conversation to view it here.
      </div>
    );
  }

  return (
    <div className="panel flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
        <div>
          <p className="font-medium">{conversation.subject || "Conversation"}</p>
          <p className="mt-0.5 text-sm text-slate-550">{conversation.customerName || "Customer"}</p>
        </div>
        <StatusPill value={conversation.status} />
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {conversation.messages?.map((message) =>
          message.senderType === "SYSTEM" ? (
            <div key={message.id} className="flex justify-center py-1">
              <p className="rounded-full bg-ink/6 px-3 py-1 text-xs text-slate-550">{message.content}</p>
            </div>
          ) : (
            <div key={message.id} className={message.senderType === "AGENT" ? "text-right" : ""}>
              <p className="mb-1 text-xs text-slate-550">
                {SENDER_LABEL[message.senderType] || message.senderType}
                <span className="mx-1.5">&middot;</span>
                {formatTime(message.createdAt)}
              </p>
              <div
                className={`inline-block max-w-[80%] rounded-lg px-3.5 py-2.5 text-[15px] ${
                  message.senderType === "AGENT" ? "bg-pine text-white" : "bg-ink/5"
                }`}
              >
                {message.content}
              </div>
            </div>
          )
        )}
        <div ref={bottomRef} />
      </div>

      {canReply ? (
        <form onSubmit={submit} className="flex items-end gap-2 border-t border-ink/10 p-3">
          <textarea
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) submit(e);
            }}
            placeholder="Reply to the customer…"
            className="field-input max-h-32 flex-1 resize-none"
          />
          <Button type="submit" busy={sending} disabled={!value.trim()}>
            Reply
          </Button>
        </form>
      ) : (
        <p className="border-t border-ink/10 p-3 text-center text-sm text-slate-550">
          Take this conversation over to reply.
        </p>
      )}
    </div>
  );
}

export default function AgentConversations() {
  const [tab, setTab] = useState("queue"); // "queue" | "mine"
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [sending, setSending] = useState(false);

  const load = () => {
    setLoading(true);
    setError("");
    conversationsApi
      .list({ page: 1, limit: 50, mine: tab === "mine" })
      .then((res) => setConversations(res.data.conversations))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    setSelectedId(null);
    setSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (!selectedId) return;
    conversationsApi.get(selectedId).then(setSelected).catch((err) => setError(err.message));
  }, [selectedId]);

  const handleTakeOver = async (id) => {
    setBusyId(id);
    setError("");
    try {
      const updated = await conversationsApi.takeOver(id);
      setSelectedId(updated.id);
      setSelected(updated);
      setTab("mine");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleReply = async (content) => {
    setSending(true);
    setError("");
    try {
      const updated = await conversationsApi.sendMessage(selectedId, content);
      setSelected(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-3xl">Live chats</h1>
      <p className="mt-1 text-slate-550">Conversations waiting for a human, and the ones you've taken over.</p>

      <div className="mt-5 flex gap-2">
        {[
          ["queue", "Waiting"],
          ["mine", "Mine"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              tab === value ? "bg-ink text-white" : "bg-paper text-slate-550 hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:h-[65vh] lg:grid-cols-[320px_1fr]">
        <div className="panel divide-y divide-ink/8 overflow-y-auto">
          {loading ? (
            <p className="p-5 text-slate-550">Loading…</p>
          ) : conversations.length === 0 ? (
            <p className="p-5 text-slate-550">
              {tab === "queue" ? "Nothing waiting right now." : "You haven't taken over any chats yet."}
            </p>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className={`flex items-center justify-between gap-3 px-4 py-3 ${
                  selectedId === c.id ? "bg-pine-light" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm font-medium">{c.subject || "Conversation"}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-550">{c.customerName || "Customer"}</p>
                </button>
                {c.status === "WAITING_AGENT" && (
                  <Button
                    variant="secondary"
                    className="shrink-0 px-2.5 py-1 text-xs"
                    busy={busyId === c.id}
                    onClick={() => handleTakeOver(c.id)}
                  >
                    Take over
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        <Thread conversation={selected} onSend={handleReply} sending={sending} />
      </div>
    </div>
  );
}
