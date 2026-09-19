import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Alert from "../../components/Alert";
import Button from "../../components/Button";
import StatusPill from "../../components/StatusPill";
import { conversationsApi } from "../../api/conversations";

const CLOSED_STATUSES = ["RESOLVED", "CLOSED"];

const SENDER_LABEL = {
  CUSTOMER: "You",
  AI: "AI Assistant",
  AGENT: "Support agent",
  SYSTEM: "System",
};

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function MessageBubble({ message }) {
  const isCustomer = message.senderType === "CUSTOMER";
  const isSystem = message.senderType === "SYSTEM";

  if (isSystem) {
    return (
      <div className="flex justify-center py-1">
        <p className="rounded-full bg-ink/6 px-3 py-1 text-xs text-slate-550">{message.content}</p>
      </div>
    );
  }

  return (
    <div className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] sm:max-w-[70%] ${isCustomer ? "items-end" : "items-start"} flex flex-col`}>
        <p className="mb-1 px-1 text-xs text-slate-550">
          {SENDER_LABEL[message.senderType] || message.senderType}
          <span className="mx-1.5">&middot;</span>
          {formatTime(message.createdAt)}
        </p>
        <div
          className={`rounded-lg px-3.5 py-2.5 text-[15px] leading-relaxed ${
            isCustomer ? "bg-pine text-white" : "panel"
          }`}
        >
          {message.content}
        </div>
        {message.metadata?.sources?.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5 px-1">
            {message.metadata.sources.map((source, idx) => (
              <span key={idx} className="rounded bg-pine-light px-1.5 py-0.5 text-xs text-pine-dark">
                {source.document}
                {source.page ? ` · p.${source.page}` : ""}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Composer({ onSend, disabled, busy, placeholder }) {
  const [value, setValue] = useState("");

  const submit = (event) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled || busy) return;
    onSend(trimmed);
    setValue("");
  };

  return (
    <form onSubmit={submit} className="flex items-end gap-2 border-t border-ink/10 bg-paper p-3">
      <textarea
        rows={1}
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) submit(e);
        }}
        placeholder={placeholder}
        className="field-input max-h-32 flex-1 resize-none disabled:bg-ink/5 disabled:text-slate-550"
      />
      <Button type="submit" busy={busy} disabled={disabled || !value.trim()}>
        Send
      </Button>
    </form>
  );
}

export default function CustomerChat() {
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationId = searchParams.get("c");

  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(Boolean(conversationId));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useEffect(() => {
    if (!conversationId) {
      setConversation(null);
      return;
    }
    setLoading(true);
    setError("");
    conversationsApi
      .get(conversationId)
      .then((c) => {
        setConversation(c);
        setTimeout(scrollToBottom, 50);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [conversationId, scrollToBottom]);

  const handleStart = async (message) => {
    setSending(true);
    setError("");
    try {
      const created = await conversationsApi.start({ message });
      setSearchParams({ c: String(created.id) });
      setConversation(created);
      setTimeout(scrollToBottom, 50);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleSend = async (content) => {
    setSending(true);
    setError("");
    try {
      const updated = await conversationsApi.sendMessage(conversationId, content);
      setConversation(updated);
      setTimeout(scrollToBottom, 50);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleHandoff = async () => {
    setSending(true);
    setError("");
    try {
      const updated = await conversationsApi.requestHandoff(conversationId);
      setConversation(updated);
      setTimeout(scrollToBottom, 50);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const isClosed = conversation && CLOSED_STATUSES.includes(conversation.status);
  const canRequestHuman =
    conversation && !isClosed && !["WAITING_AGENT", "WITH_AGENT"].includes(conversation.status);

  // No thread open yet: a plain composer that starts one.
  if (!conversationId) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col">
        <h1 className="font-display text-3xl">Get help</h1>
        <p className="mt-2 text-slate-550">
          Ask about an order, a return, or anything else. If the assistant can't help, you can ask
          for a person at any time.
        </p>

        {error && (
          <div className="mt-4">
            <Alert>{error}</Alert>
          </div>
        )}

        <div className="panel mt-6 flex min-h-[320px] flex-col justify-end">
          <div className="flex flex-1 items-center justify-center p-8 text-center text-slate-550">
            <p>Type a message below to start a conversation.</p>
          </div>
          <Composer onSend={handleStart} busy={sending} placeholder="How can we help?" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Get help</h1>
          {conversation && (
            <div className="mt-1.5 flex items-center gap-2">
              <StatusPill value={conversation.status} />
              <span className="text-sm text-slate-550">
                {conversation.aiEnabled ? "AI assistant" : "Human support"}
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {canRequestHuman && (
            <Button variant="secondary" onClick={handleHandoff} busy={sending}>
              Ask for a human
            </Button>
          )}
          <Link to="/chat">
            <Button variant="quiet">New chat</Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="panel mt-4 flex h-[65vh] flex-col overflow-hidden">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {loading ? (
            <p className="text-center text-slate-550">Loading conversation…</p>
          ) : (
            <>
              {conversation?.messages?.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {isClosed ? (
          <div className="border-t border-ink/10 p-4 text-center text-sm text-slate-550">
            This conversation is {conversation.status.toLowerCase()}.{" "}
            <Link to="/chat" className="text-pine underline underline-offset-2">
              Start a new one
            </Link>
            .
          </div>
        ) : (
          <Composer onSend={handleSend} busy={sending} disabled={loading} placeholder="Type a message…" />
        )}
      </div>
    </div>
  );
}
