"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/lib/auth";
import Token from "./Token";
import { TokenKey } from "@/lib/tokens";
import NotificationBell from "./NotificationBell";

const STATIC_LINKS = [
  { href: "/",            label: "markets", className: "nav-markets", tutorial: "nav-markets" },
  { href: "/leaderboard", label: "board",   className: "",            tutorial: "nav-board"   },
  { href: "/chat",        label: "chat",    className: "",            tutorial: "nav-chat"    },
  { href: "/ideas",       label: "ideas",   className: "",            tutorial: "nav-ideas"   },
];

export default function Nav() {
  const { user } = useUser();
  const pathname = usePathname();

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
        <div className="nav-links" style={{ display: "flex", gap: 20, alignItems: "center" }}>
          {STATIC_LINKS.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={l.className || undefined}
              data-tutorial={l.tutorial}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                color: pathname === l.href ? "var(--text)" : "var(--muted)",
                textDecoration: "none",
                padding: "8px 2px",  /* generous tap target */
              }}
            >
              {l.label}
            </Link>
          ))}

          {user.group_role === "admin" && (
            <Link
              href="/manage"
              data-tutorial="nav-manage"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                color: pathname === "/manage" ? "var(--text)" : "var(--muted)",
                textDecoration: "none",
                padding: "8px 2px",
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
                padding: "8px 2px",
              }}
            >
              admin
            </Link>
          )}
        </div>

        {/* Notification bell */}
        <NotificationBell />

        {/* User — points + token link to profile */}
        <Link
          href={`/profile/${user.user_id}`}
          data-tutorial="nav-profile"
          style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}
        >
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>
            {user.points.toFixed(0)}
          </span>
          <Token tokenKey={user.token_key as TokenKey} size={28} />
          <span className="nav-username" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>
            {user.username}
          </span>
        </Link>
      </div>
    </nav>
  );
}
