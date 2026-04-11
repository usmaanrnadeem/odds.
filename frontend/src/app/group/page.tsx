"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, GroupMember } from "@/lib/api";
import { useUser } from "@/lib/auth";
import Nav from "@/components/Nav";
import Token from "@/components/Token";
import { TokenKey } from "@/lib/tokens";

export default function GroupPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && !user.group_id && !user.is_admin) router.replace("/join");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user?.group_id) return;
    api.groupMembers().then(setMembers).finally(() => setFetching(false));
  }, [user]);

  if (loading || !user) return null;

  const admins  = members.filter(m => m.role === "admin");
  const players = members.filter(m => m.role !== "admin");

  return (
    <>
      <Nav />
      <main className="page-content">
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 4 }}>
          GROUP
        </p>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: "var(--accent)", marginBottom: 28 }}>
          {user.group_name}
        </p>

        {fetching ? (
          <p style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", fontSize: 13 }}>loading…</p>
        ) : (
          <>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 12 }}>
              {members.length} {members.length === 1 ? "MEMBER" : "MEMBERS"}
            </p>

            {[...admins, ...players].map(m => (
              <Link key={m.user_id} href={`/profile/${m.user_id}`} style={{ textDecoration: "none" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 0",
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                  }}
                >
                  <Token tokenKey={m.token_key as TokenKey} size={36} />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 14, color: "var(--text)", fontWeight: m.user_id === user.user_id ? 600 : 400 }}>
                      {m.username}
                      {m.user_id === user.user_id && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", marginLeft: 8 }}>you</span>
                      )}
                    </p>
                    {m.role === "admin" && (
                      <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.08em" }}>
                        admin
                      </p>
                    )}
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--muted)" }}>
                    {m.points.toFixed(0)} pts
                  </span>
                </div>
              </Link>
            ))}
          </>
        )}
      </main>
    </>
  );
}
