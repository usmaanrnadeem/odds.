"use client";
import { useEffect, useRef, useState } from "react";
import { ChatMessage } from "@/lib/api";
import Token from "./Token";
import { TokenKey } from "@/lib/tokens";

interface Props {
  messages: ChatMessage[];
  currentUserId: number;
  onSend: (content: string) => Promise<void>;
}

export default function ChatPanel({ messages, currentUserId, onSend }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onSend(trimmed);
      setText("");
    } finally {
      setBusy(false);
    }
  }

  function fmtTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Message list */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minHeight: 0,
      }}>
        {messages.length === 0 && (
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", padding: "12px 0" }}>
            no messages yet
          </p>
        )}
        {messages.map(m => {
          const isMe = m.user_id === currentUserId;
          return (
            <div
              key={m.message_id}
              style={{
                display: "flex",
                flexDirection: isMe ? "row-reverse" : "row",
                alignItems: "flex-end",
                gap: 8,
                padding: "4px 0",
              }}
            >
              {!isMe && <Token tokenKey={m.token_key as TokenKey} size={20} />}
              <div style={{ maxWidth: "75%", display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                {!isMe && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted)", marginBottom: 2, letterSpacing: "0.06em" }}>
                    {m.username}
                  </span>
                )}
                <div style={{
                  padding: "8px 10px",
                  background: isMe ? "var(--accent)" : "var(--surface)",
                  border: isMe ? "none" : "1px solid var(--border)",
                  color: isMe ? "#000" : "var(--text)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  lineHeight: 1.4,
                  wordBreak: "break-word",
                }}>
                  {m.content}
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted)", marginTop: 2 }}>
                  {fmtTime(m.created_at)}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={submit}
        style={{ display: "flex", gap: 8, paddingTop: 12, borderTop: "1px solid var(--border)" }}
      >
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="say something…"
          maxLength={280}
          style={{
            flex: 1,
            padding: "10px 12px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--text)",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            outline: "none",
          }}
          onFocus={e => (e.currentTarget.style.borderColor = "var(--border)")}
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          style={{
            padding: "10px 16px",
            background: text.trim() ? "var(--accent)" : "var(--surface)",
            border: "1px solid var(--border)",
            color: text.trim() ? "#000" : "var(--muted)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            fontWeight: 700,
            cursor: text.trim() ? "pointer" : "default",
            transition: "background 0.15s, color 0.15s",
            flexShrink: 0,
          }}
        >
          {busy ? "…" : "send"}
        </button>
      </form>
    </div>
  );
}
