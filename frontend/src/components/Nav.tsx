"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/lib/auth";
import Token from "./Token";
import { TokenKey } from "@/lib/tokens";

// static links — trophies href is filled in dynamically per-user
const STATIC_LINKS = [
  { href: "/",            label: "markets"  },
  { href: "/leaderboard", label: "board"    },
];

export default function Nav() {
  const { user, logout } = useUser();
  const pathname = usePathname();
  const router   = useRouter();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  if (!user) return null;

  return (
    <nav
      style={{
        background: "var(--canvas)",
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div className="nav-inner">
        {/* Logo */}
        <Link href="/" style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 18, color: "var(--accent)", textDecoration: "none" }}>
          odds.
        </Link>

        {/* Links */}
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          {STATIC_LINKS.map(l => (
            <Link
              key={l.href}
              href={l.href}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                color: pathname === l.href ? "var(--text)" : "var(--muted)",
                textDecoration: "none",
              }}
            >
              {l.label}
            </Link>
          ))}
          {/* Trophies — explicit link so it's always visible */}
          <Link
            href={`/profile/${user.user_id}`}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              color: pathname.startsWith("/profile") ? "var(--text)" : "var(--muted)",
              textDecoration: "none",
            }}
          >
            trophies
          </Link>
          {user.group_role === "admin" && (
            <Link
              href="/manage"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                color: pathname === "/manage" ? "var(--text)" : "var(--muted)",
                textDecoration: "none",
              }}
            >
              manage
            </Link>
          )}
          {user.is_admin && (
            <Link
              href="/admin"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                color: pathname === "/admin" ? "var(--text)" : "var(--muted)",
                textDecoration: "none",
              }}
            >
              admin
            </Link>
          )}
        </div>

        {/* User — token links to profile, sign out is separate */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href={`/profile/${user.user_id}`}
            title="my trophies"
            style={{ display: "flex", alignItems: "center", gap: 7, textDecoration: "none" }}
          >
            <Token tokenKey={user.token_key as TokenKey} size={28} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>
              {user.username}
            </span>
          </Link>
          <button
            onClick={handleLogout}
            title="sign out"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--border)",
              padding: "2px 4px",
              lineHeight: 1,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--muted)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--border)")}
          >
            ×
          </button>
        </div>
      </div>
    </nav>
  );
}
