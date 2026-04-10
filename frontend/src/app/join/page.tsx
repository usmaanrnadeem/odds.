"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, tokenStore } from "@/lib/api";
import { useUser } from "@/lib/auth";

type Tab = "join" | "create";

export default function JoinPage() {
  const router = useRouter();
  const { refresh } = useUser();
  const [tab, setTab] = useState<Tab>("join");

  // join fields
  const [joinName,     setJoinName]     = useState("");
  const [joinPassword, setJoinPassword] = useState("");

  // create fields
  const [createName,    setCreateName]    = useState("");
  const [createPw,      setCreatePw]      = useState("");
  const [inviteToken,   setInviteToken]   = useState("");

  const [error, setError] = useState("");
  const [busy,  setBusy]  = useState(false);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const g = await api.joinGroup(joinName, joinPassword);
      tokenStore.set(g.access_token);
      await refresh();
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to join group");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const g = await api.createGroup(createName, createPw, inviteToken);
      tokenStore.set(g.access_token);
      await refresh();
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create group");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--canvas)" }}>
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 28, color: "var(--accent)" }}>
            odds.
          </span>
          <p className="mt-1 text-sm" style={{ fontFamily: "var(--font-mono)", color: "var(--muted)" }}>
            enter your universe
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", marginBottom: 24, borderBottom: "1px solid var(--border)" }}>
          {(["join", "create"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(""); }}
              style={{
                flex: 1,
                padding: "10px",
                background: "none",
                border: "none",
                borderBottom: `2px solid ${tab === t ? "var(--accent)" : "transparent"}`,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: tab === t ? "var(--accent)" : "var(--muted)",
                cursor: "pointer",
                textTransform: "uppercase",
              }}
            >
              {t === "join" ? "join universe" : "create universe"}
            </button>
          ))}
        </div>

        {tab === "join" && (
          <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              placeholder="universe name"
              value={joinName}
              onChange={e => setJoinName(e.target.value)}
              required
              className="auth-input"
            />
            <input
              type="password"
              placeholder="universe password"
              value={joinPassword}
              onChange={e => setJoinPassword(e.target.value)}
              required
              className="auth-input"
            />
            {error && <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--no)", textAlign: "center" }}>{error}</p>}
            <button type="submit" disabled={busy} className="auth-btn-primary">
              {busy ? "joining…" : "join"}
            </button>
          </form>
        )}

        {tab === "create" && (
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", margin: 0 }}>
              you need an invite link from the master admin to create a universe
            </p>
            <input
              placeholder="universe name"
              value={createName}
              onChange={e => setCreateName(e.target.value)}
              required
              minLength={2}
              maxLength={50}
              className="auth-input"
            />
            <input
              type="password"
              placeholder="set a password for your universe"
              value={createPw}
              onChange={e => setCreatePw(e.target.value)}
              required
              minLength={4}
              className="auth-input"
            />
            <input
              placeholder="invite token"
              value={inviteToken}
              onChange={e => setInviteToken(e.target.value)}
              required
              className="auth-input"
            />
            {error && <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--no)", textAlign: "center" }}>{error}</p>}
            <button type="submit" disabled={busy} className="auth-btn-primary">
              {busy ? "creating…" : "create universe"}
            </button>
          </form>
        )}
      </div>

      <style>{`
        .auth-input {
          width: 100%;
          padding: 12px 16px;
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--text);
          font-family: var(--font-mono);
          font-size: 16px;
          outline: none;
          transition: border-color 0.15s;
          box-sizing: border-box;
        }
        .auth-input:focus { border-color: var(--accent); }
        .auth-input::placeholder { color: var(--muted); }
        .auth-btn-primary {
          padding: 12px;
          background: var(--accent);
          color: #000;
          font-family: var(--font-mono);
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          border: none;
          cursor: pointer;
        }
        .auth-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </main>
  );
}
