"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useUser } from "@/lib/auth";
import Nav from "@/components/Nav";

export default function AdminPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [invite,       setInvite]       = useState("");
  const [inviteExpiry, setInviteExpiry] = useState("");
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && (!user || !user.is_admin)) router.replace("/");
  }, [user, loading, router]);

  async function genInvite() {
    setBusy(true);
    setError("");
    try {
      const r = await api.createInvite();
      setInvite(r.token);
      setInviteExpiry(new Date(r.expires_at).toLocaleString());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user?.is_admin) return null;

  return (
    <>
      <Nav />
      <main className="page-content">
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 24 }}>
          ADMIN
        </p>

        <section>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>INVITE TOKEN</p>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginBottom: 16, lineHeight: 1.6 }}>
            Send this to someone so they can create their own group.
            Each token is single-use and expires in 24h.
          </p>
          <button onClick={genInvite} disabled={busy} style={primaryBtnStyle}>
            {busy ? "…" : "generate invite"}
          </button>

          {error && (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--no)", marginTop: 12 }}>{error}</p>
          )}

          {invite && (
            <div style={{ marginTop: 16, padding: "12px", background: "var(--surface)", border: "1px solid var(--border)" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
                expires {inviteExpiry}
              </p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text)", wordBreak: "break-all", userSelect: "all", margin: 0 }}>
                {invite}
              </p>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  padding: "10px 16px",
  background: "var(--accent)",
  border: "none",
  color: "#000",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  cursor: "pointer",
};
