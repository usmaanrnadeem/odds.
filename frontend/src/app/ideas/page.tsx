"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, MarketIdea } from "@/lib/api";
import { useUser } from "@/lib/auth";
import Nav from "@/components/Nav";
import Token from "@/components/Token";
import { TokenKey } from "@/lib/tokens";

// ── Idea feed card ────────────────────────────────────────────

function IdeaFeedCard({
  idea,
  isAdmin,
  onReviewed,
}: {
  idea: MarketIdea;
  isAdmin: boolean;
  onReviewed: () => void;
}) {
  const [editTitle, setEditTitle] = useState(idea.title);
  const [editDesc,  setEditDesc]  = useState(idea.description ?? "");
  const [b,         setB]         = useState(30);
  const [closesAt,  setClosesAt]  = useState("");
  const [note,      setNote]      = useState("");
  const [busy,      setBusy]      = useState(false);
  const [msg,       setMsg]       = useState("");
  const [showReject, setShowReject] = useState(false);

  const isPending  = idea.status === "pending";
  const isApproved = idea.status === "approved";
  const isRejected = idea.status === "rejected";

  async function approve() {
    setBusy(true); setMsg("");
    try {
      await api.approveIdea(idea.idea_id, {
        title: editTitle !== idea.title ? editTitle : undefined,
        description: editDesc !== (idea.description ?? "") ? editDesc : undefined,
        b,
        closes_at: closesAt ? new Date(closesAt).toISOString() : null,
      });
      setMsg("posted ✓");
      setTimeout(onReviewed, 600);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Failed");
    } finally { setBusy(false); }
  }

  async function reject() {
    setBusy(true); setMsg("");
    try {
      await api.rejectIdea(idea.idea_id, note || undefined);
      setMsg("declined");
      setTimeout(onReviewed, 600);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Failed");
    } finally { setBusy(false); }
  }

  return (
    <div style={{
      padding: "16px",
      background: "var(--surface)",
      border: `1px solid ${isPending && isAdmin ? "color-mix(in srgb, var(--accent) 25%, var(--border))" : "var(--border)"}`,
      opacity: isRejected ? 0.5 : 1,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Token tokenKey={idea.submitted_by_token_key as TokenKey} size={18} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", flex: 1 }}>
          {idea.submitted_by_username}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>
          {new Date(idea.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </span>
      </div>

      {/* Title — editable for admin on pending */}
      {isAdmin && isPending ? (
        <input
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          style={{ ...inputStyle, marginBottom: 6 }}
        />
      ) : (
        <p style={{ fontSize: 14, color: "var(--text)", margin: "0 0 4px", lineHeight: 1.4 }}>
          {idea.title}
        </p>
      )}

      {/* Description */}
      {isAdmin && isPending ? (
        <textarea
          value={editDesc}
          onChange={e => setEditDesc(e.target.value)}
          placeholder="description (optional)"
          rows={2}
          style={{ ...inputStyle, resize: "vertical", marginBottom: 8 }}
        />
      ) : idea.description ? (
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", margin: "0 0 8px", lineHeight: 1.5 }}>
          {idea.description}
        </p>
      ) : null}

      {/* Status / outcome */}
      {isApproved && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.08em" }}>
            LIVE
          </span>
          {idea.market_id && (
            <a
              href={`/markets/${idea.market_id}`}
              style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", textDecoration: "none" }}
            >
              view market →
            </a>
          )}
        </div>
      )}

      {isRejected && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em" }}>
          DECLINED{idea.admin_note ? ` · ${idea.admin_note}` : ""}
        </span>
      )}

      {isPending && !isAdmin && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em" }}>
          UNDER REVIEW
        </span>
      )}

      {/* Admin approve/reject controls */}
      {isAdmin && isPending && (
        <div style={{ marginTop: 12 }}>
          {/* Optional settings */}
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", whiteSpace: "nowrap" }}>b:</label>
              <input
                type="number"
                value={b}
                onChange={e => setB(Number(e.target.value))}
                min={10} max={10000}
                style={{ ...inputStyle, width: 64, padding: "6px 8px", fontSize: 12 }}
              />
            </div>
            <input
              type="datetime-local"
              value={closesAt}
              onChange={e => setClosesAt(e.target.value)}
              style={{ ...inputStyle, flex: 1, colorScheme: "dark", padding: "6px 8px", fontSize: 12 }}
            />
          </div>

          {showReject && (
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="reason (optional)"
              style={{ ...inputStyle, marginBottom: 8 }}
            />
          )}

          {msg ? (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", margin: 0 }}>{msg}</p>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={approve}
                disabled={busy}
                style={{ ...actionBtn, background: "var(--accent)", color: "#000", flex: 1 }}
              >
                post as market
              </button>
              {showReject ? (
                <button
                  onClick={reject}
                  disabled={busy}
                  style={{ ...actionBtn, background: "transparent", border: "1px solid var(--no)", color: "var(--no)" }}
                >
                  confirm
                </button>
              ) : (
                <button
                  onClick={() => setShowReject(true)}
                  style={{ ...actionBtn, background: "transparent", border: "1px solid var(--border)", color: "var(--muted)" }}
                >
                  decline
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function IdeasPage() {
  const { user, loading } = useUser();
  const router = useRouter();

  const [ideas,    setIdeas]    = useState<MarketIdea[]>([]);
  const [title,    setTitle]    = useState("");
  const [desc,     setDesc]     = useState("");
  const [busy,     setBusy]     = useState(false);
  const [msg,      setMsg]      = useState("");
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && !user.group_id) router.replace("/join");
  }, [user, loading, router]);

  function loadAll() {
    api.ideas().then(setIdeas).finally(() => setFetching(false));
  }

  useEffect(() => {
    if (!user?.group_id) return;
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true); setMsg("");
    try {
      await api.submitIdea(title.trim(), desc.trim() || undefined);
      setMsg("idea submitted — admin will review it soon");
      setTitle(""); setDesc("");
      api.ideas().then(setIdeas);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Failed");
    } finally { setBusy(false); }
  }

  if (loading || !user) return null;

  const isAdmin = user.group_role === "admin";
  const pending  = ideas.filter(i => i.status === "pending");
  const reviewed = ideas.filter(i => i.status !== "pending");

  return (
    <>
      <Nav />
      <main className="page-content">

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", margin: "0 0 4px" }}>
            MARKET IDEAS
          </p>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
            Pitch a market. Admin posts the best ones.
          </p>
        </div>

        {/* Submit box */}
        <form onSubmit={submit} style={{ marginBottom: 32 }}>
          <textarea
            placeholder="What should we bet on? (e.g. Will Jamie bail on pregame?)"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            minLength={5}
            maxLength={200}
            rows={2}
            style={{ ...inputStyle, resize: "none", marginBottom: 6 }}
          />
          <textarea
            placeholder="Add context (optional)"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            rows={2}
            style={{ ...inputStyle, resize: "none", marginBottom: 8 }}
          />
          {msg && (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", margin: "0 0 8px" }}>
              {msg}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !title.trim()}
            style={{
              width: "100%", padding: "10px",
              background: "var(--accent)", border: "none", color: "#000",
              fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700,
              letterSpacing: "0.06em", textTransform: "uppercase",
              cursor: busy || !title.trim() ? "not-allowed" : "pointer",
              opacity: busy || !title.trim() ? 0.5 : 1,
            }}
          >
            {busy ? "…" : "pitch it"}
          </button>
        </form>

        {/* Feed */}
        {fetching ? (
          <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", fontSize: 13 }}>loading…</p>
        ) : ideas.length === 0 ? (
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>
            no ideas yet — be the first
          </p>
        ) : (
          <>
            {/* Pending — shown to admin for action, shown to others as a queue */}
            {pending.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                {isAdmin && (
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", margin: "0 0 10px" }}>
                    NEEDS REVIEW · {pending.length}
                  </p>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {pending.map(idea => (
                    <IdeaFeedCard key={idea.idea_id} idea={idea} isAdmin={isAdmin} onReviewed={loadAll} />
                  ))}
                </div>
              </div>
            )}

            {/* Reviewed ideas */}
            {reviewed.length > 0 && (
              <div>
                {pending.length > 0 && (
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", margin: "0 0 10px" }}>
                    REVIEWED
                  </p>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {reviewed.map(idea => (
                    <IdeaFeedCard key={idea.idea_id} idea={idea} isAdmin={isAdmin} onReviewed={loadAll} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px",
  background: "var(--surface)", border: "1px solid var(--border)",
  color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 13,
  outline: "none", boxSizing: "border-box",
};

const actionBtn: React.CSSProperties = {
  padding: "8px 14px",
  fontFamily: "var(--font-mono)", fontSize: 11,
  fontWeight: 700, letterSpacing: "0.06em",
  border: "none", cursor: "pointer",
};
