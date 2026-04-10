"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ChatMessage, WSEvent, connectWS } from "@/lib/api";
import { useUser } from "@/lib/auth";
import Nav from "@/components/Nav";
import ChatPanel from "@/components/ChatPanel";

export default function GroupChatPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && !user.group_id && !user.is_admin) router.replace("/join");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user?.group_id) return;
    api.groupChat().then(setMessages).finally(() => setFetching(false));

    const disconnect = connectWS((event: WSEvent) => {
      if (event.type === "chat" && event.scope === "group" && event.scope_id === user.group_id) {
        setMessages(prev => {
          if (prev.some(m => m.message_id === event.message_id)) return prev;
          return [...prev, {
            message_id: event.message_id,
            user_id: event.user_id,
            username: event.username,
            token_key: event.token_key,
            content: event.content,
            created_at: event.created_at,
          }];
        });
      }
    });
    return disconnect;
  }, [user?.group_id, user]);

  if (loading || !user) return null;

  return (
    <>
      <Nav />
      <main className="page-content" style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 52px)" }}>
        <div style={{ marginBottom: 16, flexShrink: 0 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", margin: 0 }}>
            GROUP CHAT
          </p>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: "var(--accent)", margin: "4px 0 0" }}>
            {user.group_name}
          </p>
        </div>

        {fetching ? (
          <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", fontSize: 13 }}>loading…</p>
        ) : (
          <div style={{ flex: 1, minHeight: 0 }}>
            <ChatPanel
              messages={messages}
              currentUserId={user.user_id}
              onSend={async (content) => { await api.sendGroupChat(content); }}
            />
          </div>
        )}
      </main>
    </>
  );
}
