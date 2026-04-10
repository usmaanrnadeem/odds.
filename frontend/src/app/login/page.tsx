"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError, tokenStore } from "@/lib/api";
import { useUser } from "@/lib/auth";

function LoginPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get("token");
  const { user, loading, refresh } = useUser();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [busy,     setBusy]     = useState(false);

  // Already logged in → go home
  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [user, loading, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const u = await api.login(username, password);
      if (u.access_token) tokenStore.set(u.access_token);
      await refresh();
      router.push(token ? `/join?token=${token}` : "/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--canvas)" }}>
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <span className="font-mono text-3xl font-bold tracking-tight" style={{ color: "var(--accent)" }}>
            odds.
          </span>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            prediction markets for your friend group
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            autoComplete="username"
            className="auth-input"
          />
          <input
            type="password"
            placeholder="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="auth-input"
          />
          {error && (
            <p className="text-sm text-center" style={{ color: "var(--no)" }}>{error}</p>
          )}
          <button type="submit" disabled={busy} className="auth-btn-primary">
            {busy ? "signing in…" : "sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm" style={{ color: "var(--muted)" }}>
          have an invite?{" "}
          <Link href="/register" className="underline" style={{ color: "var(--text)" }}>
            register
          </Link>
        </p>
      </div>

      <style>{`
        .auth-input {
          width: 100%; padding: 12px 16px;
          background: var(--surface); border: 1px solid var(--border);
          color: var(--text); font-family: var(--font-mono); font-size: 16px;
          outline: none; transition: border-color 0.15s;
        }
        .auth-input:focus { border-color: var(--accent); }
        .auth-input::placeholder { color: var(--muted); }
        .auth-btn-primary {
          padding: 12px; background: var(--accent); color: #000;
          font-family: var(--font-mono); font-size: 16px; font-weight: 700;
          letter-spacing: 0.05em; text-transform: uppercase;
          border: none; cursor: pointer; transition: opacity 0.15s;
        }
        .auth-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}
