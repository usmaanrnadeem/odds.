"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError, tokenStore } from "@/lib/api";
import { useUser } from "@/lib/auth";

type Tab = "join" | "create";

function JoinPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { user, refresh } = useUser();

  const inviteToken = searchParams.get("token"); // shareable join link token

  // If a token is in the URL, preview the group name before the user is logged in
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState("");

  useEffect(() => {
    if (!inviteToken) return;
    api.previewGroup(inviteToken)
      .then(g => setPreviewName(g.group_name))
      .catch(() => setPreviewError("This invite link is invalid or has expired."));
  }, [inviteToken]);

  // Already in a group → redirect home (unless they're following a new invite link to switch)
  useEffect(() => {
    if (!user || inviteToken) return;
    if (user.group_id) router.replace("/");
  }, [user, inviteToken, router]);

  // If user is logged in AND a token is in the URL → auto-join immediately
  useEffect(() => {
    if (!user || !inviteToken) return;
    if (user.group_id) { router.replace("/"); return; } // already in a group
    api.joinGroupByToken(inviteToken)
      .then(g => {
        tokenStore.set(g.access_token);
        return refresh();
      })
      .then(() => router.replace("/"))
      .catch(err => setPreviewError(err instanceof ApiError ? err.message : "Failed to join"));
  }, [user, inviteToken, router, refresh]);

  // ── Manual join / create ─────────────────────────────────
  const [tab, setTab] = useState<Tab>("join");

  const [joinLink,   setJoinLink]   = useState("");
  const [createName, setCreateName] = useState("");

  const [error, setError] = useState("");
  const [busy,  setBusy]  = useState(false);

  function extractToken(input: string): string | null {
    const trimmed = input.trim();
    // Full URL: https://…/join?token=abc123
    try {
      const url = new URL(trimmed);
      const t = url.searchParams.get("token");
      if (t) return t;
    } catch { /* not a URL */ }
    // Raw token string (no spaces, not a URL)
    if (!trimmed.includes(" ") && !trimmed.includes("/")) return trimmed;
    return null;
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const token = extractToken(joinLink);
      if (!token) { setError("Paste the invite link you received from your group admin."); setBusy(false); return; }
      const g = await api.joinGroupByToken(token);
      tokenStore.set(g.access_token);
      await refresh();
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to join");
    } finally { setBusy(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const g = await api.createGroup(createName);
      tokenStore.set(g.access_token);
      await refresh();
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create");
    } finally { setBusy(false); }
  }

  // Not logged in + no token → send to register
  if (!inviteToken && !user) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--canvas)" }}>
        <div className="w-full max-w-sm" style={{ textAlign: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 28, color: "var(--accent)" }}>odds.</span>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)", margin: "16px 0 24px" }}>
            you need an account to join or create a group.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <a href="/register" style={{ display: "block", padding: "14px", background: "var(--accent)", color: "#000", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", textDecoration: "none" }}>
              create account
            </a>
            <a href="/login" style={{ display: "block", padding: "14px", background: "transparent", border: "1px solid var(--border)", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 13, textDecoration: "none" }}>
              sign in
            </a>
          </div>
        </div>
      </main>
    );
  }

  // ── Token flow — not logged in ───────────────────────────
  if (inviteToken && !user) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--canvas)" }}>
        <div className="w-full max-w-sm" style={{ textAlign: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 28, color: "var(--accent)" }}>
            odds.
          </span>

          {previewError ? (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--no)", marginTop: 24 }}>
              {previewError}
            </p>
          ) : (
            <>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", marginTop: 28, marginBottom: 8 }}>
                YOU'VE BEEN INVITED TO
              </p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 700, color: "var(--text)", marginBottom: 32 }}>
                {previewName ?? "…"}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <a
                  href={`/register?token=${inviteToken}`}
                  style={{
                    display: "block", padding: "14px",
                    background: "var(--accent)", color: "#000",
                    fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700,
                    letterSpacing: "0.06em", textTransform: "uppercase",
                    textDecoration: "none", textAlign: "center",
                  }}
                >
                  create account &amp; join
                </a>
                <a
                  href={`/login?token=${inviteToken}`}
                  style={{
                    display: "block", padding: "14px",
                    background: "transparent",
                    border: "1px solid var(--border)", color: "var(--muted)",
                    fontFamily: "var(--font-mono)", fontSize: 13,
                    textDecoration: "none", textAlign: "center",
                  }}
                >
                  I already have an account
                </a>
              </div>
            </>
          )}
        </div>
      </main>
    );
  }

  // ── Token flow — logged in, auto-joining (spinner) ───────
  if (inviteToken && user) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--canvas)" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>
          {previewError || `joining ${previewName ?? "group"}…`}
        </p>
      </main>
    );
  }

  // ── Manual flow (tab: join by invite OR create) ─────────
  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--canvas)" }}>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 28, color: "var(--accent)" }}>
            odds.
          </span>
          <p className="mt-1 text-sm" style={{ fontFamily: "var(--font-mono)", color: "var(--muted)" }}>
            join or start a group
          </p>
        </div>

        {/* Tab switcher */}
        <div style={{ display: "flex", marginBottom: 24, borderBottom: "1px solid var(--border)" }}>
          {(["join", "create"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(""); }}
              style={{
                flex: 1, padding: "10px 0",
                background: "none", border: "none",
                fontFamily: "var(--font-mono)", fontSize: 12,
                color: tab === t ? "var(--text)" : "var(--muted)",
                borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
                cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase",
              }}
            >
              {t === "join" ? "join a group" : "create a group"}
            </button>
          ))}
        </div>

        {tab === "join" ? (
          <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", margin: 0 }}>
              paste the invite link your group admin shared with you.
            </p>
            <input placeholder="https://…/join?token=…" value={joinLink} onChange={e => setJoinLink(e.target.value)} required className="auth-input" />
            {error && <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--no)", textAlign: "center" }}>{error}</p>}
            <button type="submit" disabled={busy} className="auth-btn-primary">{busy ? "joining…" : "join group"}</button>
          </form>
        ) : (
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", margin: 0 }}>
              pick a name for your group. you&apos;ll be the admin — share the invite link with your crew.
            </p>
            <input placeholder="group name" value={createName} onChange={e => setCreateName(e.target.value)} required minLength={2} maxLength={50} className="auth-input" />
            {error && <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--no)", textAlign: "center" }}>{error}</p>}
            <button type="submit" disabled={busy} className="auth-btn-primary">{busy ? "creating…" : "create group"}</button>
          </form>
        )}
      </div>

      <style>{`
        .auth-input {
          width: 100%; padding: 12px 16px;
          background: var(--surface); border: 1px solid var(--border);
          color: var(--text); font-family: var(--font-mono); font-size: 16px;
          outline: none; transition: border-color 0.15s; box-sizing: border-box;
        }
        .auth-input:focus { border-color: var(--accent); }
        .auth-input::placeholder { color: var(--muted); }
        .auth-btn-primary {
          padding: 14px; background: var(--accent); color: #000;
          font-family: var(--font-mono); font-size: 14px; font-weight: 700;
          letter-spacing: 0.05em; text-transform: uppercase; border: none; cursor: pointer;
        }
        .auth-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinPageInner />
    </Suspense>
  );
}
