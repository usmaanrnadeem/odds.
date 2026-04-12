"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError, tokenStore } from "@/lib/api";
import { useUser } from "@/lib/auth";
import Token from "@/components/Token";
import {
  TOKEN_KEYS, TOKEN_LABELS, TokenKey,
  CUSTOM_TOKEN_KEYS, CUSTOM_TOKEN_LABELS, CustomTokenKey,
} from "@/lib/tokens";

// Group ID that gets the custom friend tokens
const CUSTOM_TOKEN_GROUP_ID = 1;

function RegisterPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get("token");
  const { refresh } = useUser();

  const [username,    setUsername]    = useState("");
  const [tokenKey,    setTokenKey]    = useState<TokenKey>("rocket");
  const [error,       setError]       = useState("");
  const [busy,        setBusy]        = useState(false);
  const [useCustom,   setUseCustom]   = useState(false);

  // If there's a join token, preview the group to decide which token set to show
  useEffect(() => {
    if (!token) return;
    api.previewGroup(token)
      .then(g => {
        if (g.group_id === CUSTOM_TOKEN_GROUP_ID) {
          setUseCustom(true);
          setTokenKey("p_ati"); // default selection
        }
      })
      .catch(() => {}); // silently ignore — fall back to standard tokens
  }, [token]);

  const displayKeys   = useCustom ? CUSTOM_TOKEN_KEYS   : TOKEN_KEYS;
  const displayLabels = useCustom ? CUSTOM_TOKEN_LABELS  : TOKEN_LABELS;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const u = await api.register(username.trim(), tokenKey);
      if (u.access_token) tokenStore.set(u.access_token);
      localStorage.removeItem("onboarding_v1_seen");
      await refresh();
      router.push(token ? `/join?token=${token}` : "/join");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--canvas)" }}>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="font-mono text-3xl font-bold tracking-tight" style={{ color: "var(--accent)" }}>
            odds.
          </span>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>create your account</p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          {/* Token picker */}
          <div>
            <p className="text-xs mb-3 font-mono" style={{ color: "var(--muted)" }}>CHOOSE YOUR TOKEN</p>
            <div className="grid grid-cols-4 gap-2">
              {(displayKeys as TokenKey[]).map(key => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTokenKey(key)}
                  title={(displayLabels as Record<string, string>)[key]}
                  style={{
                    padding: "12px 8px",
                    background: tokenKey === key ? "var(--surface)" : "transparent",
                    border: `1px solid ${tokenKey === key ? "var(--accent)" : "var(--border)"}`,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    transition: "border-color 0.15s",
                  }}
                >
                  <Token tokenKey={key} size={40} />
                  <span className="font-mono text-xs" style={{ color: tokenKey === key ? "var(--accent)" : "var(--muted)" }}>
                    {(displayLabels as Record<string, string>)[key].toLowerCase()}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <input
            type="text"
            placeholder="username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            minLength={2}
            maxLength={30}
            autoComplete="username"
            className="auth-input"
          />
          {error && (
            <p className="text-sm text-center" style={{ color: "var(--no)" }}>{error}</p>
          )}

          <button type="submit" disabled={busy} className="auth-btn-primary">
            {busy ? "creating account…" : "create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm" style={{ color: "var(--muted)" }}>
          already have an account?{" "}
          <Link href="/login" className="underline" style={{ color: "var(--text)" }}>sign in</Link>
        </p>
      </div>

      <style>{`
        .auth-input {
          width: 100%;
          padding: 12px 16px;
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--text);
          font-family: var(--font-mono);
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s;
        }
        .auth-input:focus { border-color: var(--accent); }
        .auth-input::placeholder { color: var(--muted); }
        .auth-btn-primary {
          padding: 12px;
          background: var(--accent);
          color: #000;
          font-family: var(--font-mono);
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          border: none;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .auth-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterPageInner />
    </Suspense>
  );
}
