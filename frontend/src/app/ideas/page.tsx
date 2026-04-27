"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, MarketIdea } from "@/lib/api";
import { useUser } from "@/lib/auth";
import Nav from "@/components/Nav";
import Token from "@/components/Token";
import { TokenKey } from "@/lib/tokens";

function StatusBadge({ status }: { status: MarketIdea["status"] }) {
  const colors = { pending: "var(--muted)", approved: "var(--accent)", rejected: "var(--no)" };
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em",
      color: colors[status], textTransform: "uppercase",
    }}>
      {status}
    </span>
  );
}

function IdeaCard({ idea }: { idea: MarketIdea }) {
  return (
    <div style={{
      padding: "14px 16px", background: "var(--surface)", border: "1px solid var(--border)", marginBottom: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Token tokenKey={idea.submitted_by_token_key as TokenKey} size={16} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
            {idea.submitted_by_username}
          </span>
        </div>
        <StatusBadge status={idea.status} />
      </div>
      <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--text)", margin: "0 0 4px", lineHeight: 1.4 }}>
        {idea.title}
      </p>
      {idea.description && (
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--muted)", margin: "0 0 4px", lineHeight: 1.4 }}>
          {idea.description}
        </p>
      )}
      {idea.admin_note && (
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", margin: "6px 0 0", fontStyle: "italic" }}>
          note: {idea.admin_note}
        </p>
      )}
      {idea.market_id && (
        <a href={`/markets/${idea.market_id}`} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", textDecoration: "none", display: "block", marginTop: 6 }}>
          → view market
        </a>
      )}
    </div>
  );
}

function AdminReviewCard({ idea, onReviewed }: { idea: MarketIdea; onReviewed: () => void }) {
  const [editTitle, setEditTitle] = useState(idea.title);
  const [editDesc,  setEditDesc]  = useState(idea.description ?? "");
  const [b,         setB]         = useState(30);
  const [closesAt,  setClosesAt]  = useState("");
  const [note,      setNote]      = useState("");
  const [expanded,  setExpanded]  = useState(false);
  const [busy,      setBusy]      = useState(false);
  const [msg,       setMsg]       = useState("");

  async function approve() {
    setBusy(true); setMsg("");
    try {
      const closesAtUtc = closesAt ? new Date(closesAt).toISOString() : null;
      await api.approveIdea(idea.idea_id, {
        title: editTitle !== idea.title ? editTitle : undefined,
        description: editDesc !== (idea.description ?? "") ? editDesc : undefined,
        b,
        closes_at: closesAtUtc,
      });
      setMsg("approved ✓");
      setTimeout(onReviewed, 800);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Failed");
    } finally { setBusy(false); }
  }

  async function reject() {
    if (!note.trim() && !confirm("Reject without a note?")) return;
    setBusy(true); setMsg("");
    try {
      await api.rejectIdea(idea.idea_id, note || undefined);
      setMsg("rejected");
      setTimeout(onReviewed, 800);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Failed");
    } finally { setBusy(false); }
  }

  return (
    <div style={{
      padding: "14px 16px", background: "var(--surface)", border: "1px solid var(--border)", marginBottom: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Token tokenKey={idea.submitted_by_token_key as TokenKey} size={16} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
          {idea.submitted_by_username}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", marginLeft: "auto" }}>
          {new Date(idea.created_at).toLocaleDateString()}
        </span>
      </div>

      {/* Editable title */}
      <input
        value={editTitle}
        onChange={e => setEditTitle(e.target.value)}
        style={inputStyle}
      />
      <textarea
        value={editDesc}
        onChange={e => setEditDesc(e.target.value)}
        placeholder="description (optional)"
        rows={2}
        style={{ ...inputStyle, resize: "vertical", marginTop: 6 }}
      />

      {/* Expand for advanced options */}
      <button
        onClick={() => setExpanded(x => !x)}
        style={{ background: "none", border: "none", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", cursor: "pointer", padding: "6px 0", display: "block" }}
      >
        {expanded ? "▲ fewer options" : "▼ more options"}
      </button>

      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>
              liquidity b:
            </label>
            <input type="number" value={b} onChange={e => setB(Number(e.target.value))} min={10} max={10000} style={{ ...inputStyle, width: 80 }} />
          </div>
          <div>
            <label style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>close time:</label>
            <input type="datetime-local" value={closesAt} onChange={e => setClosesAt(e.target.value)} style={{ ...inputStyle, colorScheme: "dark", marginTop: 4 }} />
          </div>
        </div>
      )}

      <input
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="rejection note (optional)"
        style={{ ...inputStyle, marginBottom: 8 }}
      />

      {msg && <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", marginBottom: 6 }}>{msg}</p>}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={approve} disabled={busy} style={{ ...btnStyle, background: "var(--accent)", color: "#000", flex: 1 }}>
          {busy ? "…" : "approve"}
        </button>
        <button onClick={reject} disabled={busy} style={{ ...btnStyle, background: "transparent", border: "1px solid var(--no)", color: "var(--no)", flex: 1 }}>
          {busy ? "…" : "reject"}
        </button>
      </div>
    </div>
  );
}

export default function IdeasPage() {
  const { user, loading } = useUser();
  const router = useRouter();

  const [ideas,   setIdeas]   = useState<MarketIdea[]>([]);
  const [pending, setPending] = useState<MarketIdea[]>([]);
  const [title,   setTitle]   = useState("");
  const [desc,    setDesc]    = useState("");
  const [busy,    setBusy]    = useState(false);
  const [msg,     setMsg]     = useState("");
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && !user.group_id) router.replace("/join");
  }, [user, loading, router]);

  function loadAll() {
    const isAdmin = user?.group_role === "admin";
    const tasks: Promise<unknown>[] = [api.ideas().then(setIdeas)];
    if (isAdmin) tasks.push(api.pendingIdeas().then(setPending));
    Promise.all(tasks).finally(() => setFetching(false));
  }

  useEffect(() => {
    if (!user?.group_id) return;
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      await api.submitIdea(title.trim(), desc.trim() || undefined);
      setMsg("idea submitted ✓");
      setTitle(""); setDesc("");
      api.ideas().then(setIdeas);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Failed");
    } finally { setBusy(false); }
  }

  function onReviewed() {
    api.pendingIdeas().then(setPending);
    api.ideas().then(setIdeas);
  }

  if (loading || !user) return null;

  const isAdmin = user.group_role === "admin";
  const myIdeas = ideas.filter(i => i.submitted_by_username === user.username);

  return (
    <>
      <Nav />
      <main className="page-content">
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 24 }}>
          IDEAS
        </p>

        {/* Submit form */}
        <section style={{ marginBottom: 32 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
            PITCH A MARKET
          </p>
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              placeholder="Market question (e.g. Will Jamie bail on pregame?)"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              minLength={5}
              maxLength={200}
              style={inputStyle}
            />
            <textarea
              placeholder="More context (optional)"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            {msg && <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)" }}>{msg}</p>}
            <button type="submit" disabled={busy} style={primaryBtnStyle}>
              {busy ? "…" : "submit idea"}
            </button>
          </form>
        </section>

        {/* Admin: pending review queue */}
        {isAdmin && pending.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
              PENDING REVIEW ({pending.length})
            </p>
            {fetching ? (
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>loading…</p>
            ) : (
              pending.map(idea => (
                <AdminReviewCard key={idea.idea_id} idea={idea} onReviewed={onReviewed} />
              ))
            )}
          </section>
        )}

        {isAdmin && !fetching && pending.length === 0 && (
          <section style={{ marginBottom: 32 }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
              PENDING REVIEW
            </p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>
              no pending ideas
            </p>
          </section>
        )}

        {/* All group ideas (admin) or my ideas (member) */}
        <section>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
            {isAdmin ? "ALL IDEAS" : "MY IDEAS"}
          </p>
          {fetching ? (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>loading…</p>
          ) : (
            (isAdmin ? ideas : myIdeas).length === 0 ? (
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>
                no ideas yet — be the first to pitch one
              </p>
            ) : (
              (isAdmin ? ideas : myIdeas).filter(i => i.status !== "pending" || !isAdmin).map(idea => (
                <IdeaCard key={idea.idea_id} idea={idea} />
              ))
            )
          )}
        </section>
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

const btnStyle: React.CSSProperties = {
  padding: "10px",
  fontFamily: "var(--font-mono)", fontSize: 12,
  fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
  border: "none", cursor: "pointer",
};

const primaryBtnStyle: React.CSSProperties = {
  ...btnStyle,
  background: "var(--accent)", color: "#000",
};
