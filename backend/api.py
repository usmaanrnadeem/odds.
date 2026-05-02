"""
FastAPI application — all routes.
"""
import asyncio
import logging
import os
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

import asyncpg
from fastapi import Depends, FastAPI, HTTPException, Response, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware

from . import lmsr
from .auth import (
    create_token,
    get_current_user,
)
from .bots import start_bots, stop_bots
from .db import close_pool, get_pool, init_pool
from .push import send_push_to_user, VAPID_PUBLIC_KEY
from . import market_cache
from .models import (
    ApproveIdeaRequest,
    BuyRequest,
    FeedEntry,
    GroupCreate,
    GroupJoin,
    GroupOut,
    InviteOut,
    LeaderboardEntry,
    LoginRequest,
    MarketCreate,
    MarketIdeaCreate,
    MarketIdeaOut,
    MarketOut,
    MessageIn,
    MessageOut,
    MarketPnLOut,
    RegisterRequest,
    RejectIdeaRequest,
    SellRequest,
    SettleRequest,
    TradeOut,
    UserOut,
    NotificationOut,
    WSBalanceUpdateEvent,
    WSChatEvent,
    WSMarketCreatedEvent,
    WSNotificationEvent,
    WSSettlementEvent,
    WSTradeEvent,
)
from .ws import manager

logger = logging.getLogger(__name__)


# ── Notifications ────────────────────────────────────────────────────────────

async def _push_notification(pool: asyncpg.Pool, user_id: int, notif_type: str,
                              market_id: Optional[int], market_title: Optional[str],
                              actor_username: Optional[str], content: str) -> None:
    """Insert one notification row, broadcast over WS, and send a device push."""
    row = await pool.fetchrow(
        """INSERT INTO notifications (user_id, type, market_id, market_title, actor_username, content)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at""",
        user_id, notif_type, market_id, market_title, actor_username, content,
    )
    out = NotificationOut(
        id=row["id"],
        type=notif_type,
        market_id=market_id,
        market_title=market_title,
        actor_username=actor_username,
        content=content,
        is_read=False,
        created_at=row["created_at"].isoformat(),
    )
    asyncio.create_task(
        manager.broadcast(
            WSNotificationEvent(user_id=user_id, notification=out.model_dump()).model_dump()
        )
    )
    # Device push (fire-and-forget)
    url = f"/markets/{market_id}" if market_id else "/"
    asyncio.create_task(
        send_push_to_user(pool, user_id, "odds.", content, url)
    )


async def _notify_participants(pool: asyncpg.Pool, market_id: int, market_title: str,
                                actor_user_id: int, actor_username: str,
                                notif_type: str, content: str) -> None:
    """Notify all users who have traded in this market (excluding the actor)."""
    rows = await pool.fetch(
        """SELECT DISTINCT userid FROM trades
           WHERE marketid = $1 AND userid != $2 AND userid IS NOT NULL AND is_bot = FALSE""",
        market_id, actor_user_id,
    )
    for r in rows:
        asyncio.create_task(
            _push_notification(pool, r["userid"], notif_type, market_id, market_title, actor_username, content)
        )


# ── Auto-refund ───────────────────────────────────────────────

async def _do_auto_refund(pool: asyncpg.Pool, market: asyncpg.Record) -> None:
    """Refund all positions at the close-time probability, then mark settled."""
    market_id = market["marketid"]
    b = float(market["b"])
    yes_qty = float(market["outstandingyes"])
    no_qty  = float(market["outstandingno"])

    # Best-effort: find the price snapshot closest to closes_at
    price_row = await pool.fetchrow(
        "SELECT yes_prob FROM market_prices WHERE marketID = $1 AND timestamp <= $2 ORDER BY timestamp DESC LIMIT 1",
        market_id, market["closes_at"],
    )
    yes_prob = float(price_row["yes_prob"]) if price_row else lmsr.current_price(b, yes_qty, no_qty)
    no_prob  = 1 - yes_prob

    async with pool.acquire() as con:
        async with con.transaction():
            # Check nothing changed since we queried
            current = await con.fetchrow(
                "SELECT status FROM markets WHERE marketID = $1 FOR UPDATE", market_id
            )
            if not current or current["status"] != "open":
                return  # already settled by admin

            # Refund each user: yes_prob × yesPos + no_prob × noPos
            positions = await con.fetch(
                "SELECT userID, yesPos, noPos FROM positions WHERE marketID = $1", market_id
            )
            for pos in positions:
                refund = yes_prob * float(pos["yespos"]) + no_prob * float(pos["nopos"])
                if refund > 0:
                    await con.execute(
                        "UPDATE users SET points = points + $1 WHERE userID = $2",
                        refund, pos["userid"],
                    )

            await con.execute("DELETE FROM positions WHERE marketID = $1", market_id)
            await con.execute(
                """
                UPDATE markets SET status = 'settled', settled_at = NOW(),
                    settled_side = NULL, outstandingYes = 0, outstandingNo = 0
                WHERE marketID = $1
                """,
                market_id,
            )

    market_cache.invalidate(market_id)
    logger.info("Auto-refunded market %d at close-time yes_prob=%.3f", market_id, yes_prob)


async def _auto_refund_loop() -> None:
    """Background loop: every hour, refund markets closed >7 days ago without settlement."""
    while True:
        await asyncio.sleep(3600)
        try:
            pool = get_pool()
            cutoff = datetime.now(timezone.utc) - timedelta(days=7)
            rows = await pool.fetch(
                "SELECT * FROM markets WHERE status = 'open' AND closes_at IS NOT NULL AND closes_at < $1",
                cutoff,
            )
            for market in rows:
                try:
                    await _do_auto_refund(pool, market)
                except Exception:
                    logger.exception("Auto-refund failed for market %d", market["marketid"])
        except Exception:
            logger.exception("Auto-refund loop error")


# ── Lifespan ─────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool()
    await _warm_market_cache()
    await start_bots()
    asyncio.create_task(_auto_refund_loop())
    yield
    await stop_bots()
    await close_pool()


async def _warm_market_cache() -> None:
    pool = get_pool()
    rows = await pool.fetch(
        "SELECT marketid, b, outstandingyes, outstandingno, status, group_id, closes_at FROM markets WHERE status = 'open'"
    )
    for row in rows:
        market_cache._cache[row["marketid"]] = {
            "b":         float(row["b"]),
            "yes_qty":   float(row["outstandingyes"]),
            "no_qty":    float(row["outstandingno"]),
            "status":    row["status"],
            "group_id":  row["group_id"],
            "closes_at": row["closes_at"],
        }
    logger.info("Market cache warmed: %d open markets", len(rows))


# ── Shared helper ─────────────────────────────────────────────

_USER_GROUP_SQL = """
SELECT u.userid, u.username, u.points, u.is_admin, u.token_key,
       gm.group_id, g.name AS group_name, gm.role AS group_role
FROM users u
LEFT JOIN group_memberships gm ON gm.user_id = u.userid
LEFT JOIN groups g ON g.group_id = gm.group_id
WHERE u.userid = $1
"""


# ── App ──────────────────────────────────────────────────────

app = FastAPI(title="Prediction Market", lifespan=lifespan)

_frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Helpers ──────────────────────────────────────────────────

def _market_out(row: asyncpg.Record) -> MarketOut:
    if row["status"] == "settled" and row.get("final_yes_prob") is not None:
        yes_prob = float(row["final_yes_prob"])
    else:
        yes_prob = lmsr.current_price(row["b"], row["outstandingyes"], row["outstandingno"])
    no_prob = 1 - yes_prob
    return MarketOut(
        market_id=row["marketid"],
        title=row["title"],
        description=row["description"],
        b=float(row["b"]),
        outstanding_yes=float(row["outstandingyes"]),
        outstanding_no=float(row["outstandingno"]),
        status=row["status"],
        yes_prob=yes_prob,
        no_prob=no_prob,
        yes_odds=lmsr.decimal_odds(yes_prob),
        no_odds=lmsr.decimal_odds(no_prob),
        created_at=row["created_at"].isoformat(),
        settled_at=row["settled_at"].isoformat() if row["settled_at"] else None,
        settled_side=row["settled_side"],
        closes_at=row["closes_at"].isoformat() if row["closes_at"] else None,
        subject_user_id=row["subject_user_id"],
        subject_username=row.get("subject_username"),
        subject_token_key=row.get("subject_token_key"),
    )


async def _require_market(pool: asyncpg.Pool, market_id: int) -> asyncpg.Record:
    row = await pool.fetchrow("SELECT * FROM markets WHERE marketID = $1", market_id)
    if not row:
        raise HTTPException(status_code=404, detail="Market not found")
    return row


# ── Auth routes ──────────────────────────────────────────────

@app.post("/auth/register", response_model=UserOut)
async def register(body: RegisterRequest, response: Response):
    pool = get_pool()
    async with pool.acquire() as con:
        if await con.fetchrow("SELECT 1 FROM users WHERE username = $1", body.username):
            raise HTTPException(status_code=409, detail="Username already taken")
        user = await con.fetchrow(
            "INSERT INTO users (username, token_key) VALUES ($1, $2) RETURNING *",
            body.username, body.token_key,
        )

    token = create_token(user["userid"], user["is_admin"])
    response.set_cookie("access_token", token, httponly=True, samesite="none", secure=True, max_age=86400)
    return UserOut(
        user_id=user["userid"],
        username=user["username"],
        points=float(user["points"]),
        is_admin=user["is_admin"],
        token_key=user["token_key"],
        access_token=token,
    )


@app.post("/auth/login", response_model=UserOut)
async def login(body: LoginRequest, response: Response):
    pool = get_pool()
    row = await pool.fetchrow(
        """
        SELECT u.*, gm.group_id, g.name AS group_name, gm.role AS group_role
        FROM users u
        LEFT JOIN group_memberships gm ON gm.user_id = u.userid
        LEFT JOIN groups g ON g.group_id = gm.group_id
        WHERE u.username = $1
        """,
        body.username,
    )
    if not row:
        raise HTTPException(status_code=401, detail="Username not found")

    token = create_token(row["userid"], row["is_admin"], row["group_id"], row["group_role"])
    response.set_cookie("access_token", token, httponly=True, samesite="none", secure=True, max_age=86400)
    return UserOut(
        user_id=row["userid"],
        username=row["username"],
        points=float(row["points"]),
        is_admin=row["is_admin"],
        token_key=row["token_key"],
        access_token=token,
        group_id=row["group_id"],
        group_name=row["group_name"],
        group_role=row["group_role"],
    )


@app.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", samesite="none", secure=True)
    return {"ok": True}


@app.get("/auth/me", response_model=UserOut)
async def me(current: Annotated[dict, Depends(get_current_user)]):
    pool = get_pool()
    row = await pool.fetchrow(_USER_GROUP_SQL, current["user_id"])
    # Always mint a fresh token from DB state so stale JWTs self-heal on next refresh().
    # This fixes the case where a user has a token from before they joined a group.
    fresh_token = create_token(row["userid"], row["is_admin"], row["group_id"], row["group_role"])
    return UserOut(
        user_id=row["userid"],
        username=row["username"],
        points=float(row["points"]),
        is_admin=row["is_admin"],
        token_key=row["token_key"],
        access_token=fresh_token,
        group_id=row["group_id"],
        group_name=row["group_name"],
        group_role=row["group_role"],
    )


# ── Group routes ─────────────────────────────────────────────

@app.post("/groups", response_model=GroupOut)
async def create_group(body: GroupCreate, current: Annotated[dict, Depends(get_current_user)]):
    """Create a new group. Open to any registered user. Creator becomes group admin."""
    pool = get_pool()
    async with pool.acquire() as con:
        if await con.fetchrow("SELECT 1 FROM group_memberships WHERE user_id = $1", current["user_id"]):
            raise HTTPException(status_code=400, detail="You are already in a group")

        if await con.fetchrow("SELECT 1 FROM groups WHERE name = $1", body.name):
            raise HTTPException(status_code=409, detail="Group name already taken")

        async with con.transaction():
            join_tok = secrets.token_urlsafe(16)
            group = await con.fetchrow(
                "INSERT INTO groups (name, created_by, join_token) VALUES ($1, $2, $3) RETURNING *",
                body.name, current["user_id"], join_tok,
            )
            await con.execute(
                "INSERT INTO group_memberships (group_id, user_id, role) VALUES ($1, $2, 'admin')",
                group["group_id"], current["user_id"],
            )

    token = create_token(current["user_id"], current["is_admin"], group["group_id"], "admin")
    return GroupOut(
        group_id=group["group_id"],
        name=group["name"],
        role="admin",
        created_at=group["created_at"].isoformat(),
        access_token=token,
        join_token=group["join_token"],
    )


@app.post("/groups/join", response_model=GroupOut)
async def join_group(body: GroupJoin, current: Annotated[dict, Depends(get_current_user)]):
    """Join via shareable join_token link."""
    pool = get_pool()
    async with pool.acquire() as con:
        if await con.fetchrow("SELECT 1 FROM group_memberships WHERE user_id = $1", current["user_id"]):
            raise HTTPException(status_code=400, detail="You are already in a group")

        if not body.join_token:
            raise HTTPException(status_code=400, detail="Invite link required")
        group = await con.fetchrow("SELECT * FROM groups WHERE join_token = $1", body.join_token)
        if not group:
            raise HTTPException(status_code=400, detail="Invalid or expired invite link")

        await con.execute(
            "INSERT INTO group_memberships (group_id, user_id, role) VALUES ($1, $2, 'member')",
            group["group_id"], current["user_id"],
        )

    token = create_token(current["user_id"], current["is_admin"], group["group_id"], "member")
    return GroupOut(
        group_id=group["group_id"],
        name=group["name"],
        role="member",
        created_at=group["created_at"].isoformat(),
        access_token=token,
    )


@app.get("/groups/preview/{join_token}")
async def preview_group(join_token: str):
    """Public endpoint — returns group name for a join token (no auth needed)."""
    pool = get_pool()
    row = await pool.fetchrow("SELECT group_id, name FROM groups WHERE join_token = $1", join_token)
    if not row:
        raise HTTPException(status_code=404, detail="Invalid invite link")
    return {"group_id": row["group_id"], "group_name": row["name"]}


@app.post("/groups/me/regenerate-join-token")
async def regenerate_join_token(current: Annotated[dict, Depends(get_current_user)]):
    """Group admin only — rotate the join token (invalidates the old link)."""
    if current.get("group_role") != "admin":
        raise HTTPException(status_code=403, detail="Group admin only")
    pool = get_pool()
    new_tok = secrets.token_urlsafe(16)
    await pool.execute(
        "UPDATE groups SET join_token = $1 WHERE group_id = $2",
        new_tok, current["group_id"],
    )
    return {"join_token": new_tok}


@app.get("/groups/me")
async def my_group(current: Annotated[dict, Depends(get_current_user)]):
    """Return current group info including join_token (admin only sees token)."""
    group_id = current.get("group_id")
    if not group_id:
        raise HTTPException(status_code=400, detail="Not in a group")
    pool = get_pool()
    row = await pool.fetchrow("SELECT * FROM groups WHERE group_id = $1", group_id)
    result = {"group_id": row["group_id"], "name": row["name"]}
    if current.get("group_role") == "admin":
        result["join_token"] = row["join_token"]
    return result


@app.post("/groups/me/transfer-admin")
async def transfer_admin(
    body: dict,
    current: Annotated[dict, Depends(get_current_user)],
):
    if current.get("group_role") != "admin":
        raise HTTPException(status_code=403, detail="Group admin only")
    target_user_id = body.get("target_user_id")
    if not target_user_id or target_user_id == current["user_id"]:
        raise HTTPException(status_code=400, detail="Invalid target user")
    group_id = current["group_id"]
    pool = get_pool()
    async with pool.acquire() as con:
        async with con.transaction():
            member = await con.fetchrow(
                "SELECT 1 FROM group_memberships WHERE group_id = $1 AND user_id = $2",
                group_id, target_user_id,
            )
            if not member:
                raise HTTPException(status_code=400, detail="User is not in your group")
            await con.execute(
                "UPDATE group_memberships SET role = 'member' WHERE group_id = $1 AND user_id = $2",
                group_id, current["user_id"],
            )
            await con.execute(
                "UPDATE group_memberships SET role = 'admin' WHERE group_id = $1 AND user_id = $2",
                group_id, target_user_id,
            )
    return {"ok": True}


@app.get("/groups/members")
async def group_members(current: Annotated[dict, Depends(get_current_user)]):
    """Return all members in the current user's group."""
    group_id = current.get("group_id")
    if not group_id:
        return []
    pool = get_pool()
    rows = await pool.fetch(
        """
        SELECT u.userid, u.username, u.token_key, u.points, gm.role
        FROM users u
        JOIN group_memberships gm ON gm.user_id = u.userid
        WHERE gm.group_id = $1
        ORDER BY u.username
        """,
        group_id,
    )
    return [
        {
            "user_id": r["userid"],
            "username": r["username"],
            "token_key": r["token_key"],
            "points": float(r["points"]),
            "role": r["role"],
        }
        for r in rows
    ]


# ── Chat routes ───────────────────────────────────────────────

@app.get("/markets/{market_id}/chat", response_model=list[MessageOut])
async def market_chat(market_id: int, current: Annotated[dict, Depends(get_current_user)]):
    pool = get_pool()
    row = await _require_market(pool, market_id)
    if not current["is_admin"] and row["group_id"] != current.get("group_id"):
        raise HTTPException(status_code=404, detail="Market not found")
    rows = await pool.fetch(
        """
        SELECT m.id, m.user_id, u.username, u.token_key, m.content, m.created_at
        FROM messages m JOIN users u ON u.userid = m.user_id
        WHERE m.market_id = $1
        ORDER BY m.created_at ASC
        LIMIT 100
        """,
        market_id,
    )
    return [MessageOut(message_id=r["id"], user_id=r["user_id"], username=r["username"],
                       token_key=r["token_key"], content=r["content"],
                       created_at=r["created_at"].isoformat()) for r in rows]


@app.post("/markets/{market_id}/chat", response_model=MessageOut)
async def send_market_chat(market_id: int, body: MessageIn, current: Annotated[dict, Depends(get_current_user)]):
    pool = get_pool()
    row = await _require_market(pool, market_id)
    if not current["is_admin"] and row["group_id"] != current.get("group_id"):
        raise HTTPException(status_code=404, detail="Market not found")
    user_row = await pool.fetchrow("SELECT username, token_key FROM users WHERE userid = $1", current["user_id"])
    msg = await pool.fetchrow(
        "INSERT INTO messages (market_id, user_id, content) VALUES ($1, $2, $3) RETURNING *",
        market_id, current["user_id"], body.content,
    )
    out = MessageOut(message_id=msg["id"], user_id=current["user_id"],
                     username=user_row["username"], token_key=user_row["token_key"],
                     content=body.content, created_at=msg["created_at"].isoformat())
    await manager.broadcast(
        WSChatEvent(scope="market", scope_id=market_id, message_id=msg["id"],
                    user_id=current["user_id"], username=user_row["username"],
                    token_key=user_row["token_key"], content=body.content,
                    created_at=msg["created_at"].isoformat()).model_dump()
    )
    # Notify market participants (fire-and-forget)
    preview = body.content if len(body.content) <= 40 else body.content[:37] + "..."
    asyncio.create_task(
        _notify_participants(
            pool, market_id, row["title"],
            current["user_id"], user_row["username"],
            "chat", f"{user_row['username']}: {preview}",
        )
    )
    return out


@app.get("/groups/me/chat", response_model=list[MessageOut])
async def group_chat_history(current: Annotated[dict, Depends(get_current_user)]):
    group_id = current.get("group_id")
    if not group_id:
        raise HTTPException(status_code=400, detail="Not in a group")
    pool = get_pool()
    rows = await pool.fetch(
        """
        SELECT m.id, m.user_id, u.username, u.token_key, m.content, m.created_at
        FROM messages m JOIN users u ON u.userid = m.user_id
        WHERE m.group_id = $1
        ORDER BY m.created_at ASC
        LIMIT 100
        """,
        group_id,
    )
    return [MessageOut(message_id=r["id"], user_id=r["user_id"], username=r["username"],
                       token_key=r["token_key"], content=r["content"],
                       created_at=r["created_at"].isoformat()) for r in rows]


@app.post("/groups/me/chat", response_model=MessageOut)
async def send_group_chat(body: MessageIn, current: Annotated[dict, Depends(get_current_user)]):
    group_id = current.get("group_id")
    if not group_id:
        raise HTTPException(status_code=400, detail="Not in a group")
    pool = get_pool()
    user_row = await pool.fetchrow("SELECT username, token_key FROM users WHERE userid = $1", current["user_id"])
    msg = await pool.fetchrow(
        "INSERT INTO messages (group_id, user_id, content) VALUES ($1, $2, $3) RETURNING *",
        group_id, current["user_id"], body.content,
    )
    out = MessageOut(message_id=msg["id"], user_id=current["user_id"],
                     username=user_row["username"], token_key=user_row["token_key"],
                     content=body.content, created_at=msg["created_at"].isoformat())
    await manager.broadcast(
        WSChatEvent(scope="group", scope_id=group_id, message_id=msg["id"],
                    user_id=current["user_id"], username=user_row["username"],
                    token_key=user_row["token_key"], content=body.content,
                    created_at=msg["created_at"].isoformat()).model_dump()
    )
    # Notify all other group members
    preview = body.content if len(body.content) <= 40 else body.content[:37] + "..."
    async def _fire_group_chat_notifs() -> None:
        members = await pool.fetch(
            "SELECT user_id FROM group_memberships WHERE group_id = $1 AND user_id != $2",
            group_id, current["user_id"],
        )
        for m in members:
            await _push_notification(
                pool, m["user_id"], "chat", None, "Group chat",
                user_row["username"], f"{user_row['username']}: {preview}",
            )
    asyncio.create_task(_fire_group_chat_notifs())
    return out


# ── Market routes ────────────────────────────────────────────

_MARKET_WITH_SUBJECT = """
    SELECT m.*, u.username AS subject_username, u.token_key AS subject_token_key
    FROM markets m
    LEFT JOIN users u ON u.userid = m.subject_user_id
"""

@app.get("/markets", response_model=list[MarketOut])
async def list_markets(current: Annotated[dict, Depends(get_current_user)]):
    pool = get_pool()
    if current["is_admin"]:
        rows = await pool.fetch(
            _MARKET_WITH_SUBJECT + "WHERE m.status IN ('open','settled') ORDER BY m.created_at DESC"
        )
    else:
        group_id = current.get("group_id")
        if not group_id:
            return []
        rows = await pool.fetch(
            _MARKET_WITH_SUBJECT + "WHERE m.group_id = $1 AND m.status IN ('open','settled') ORDER BY m.created_at DESC",
            group_id,
        )
    return [_market_out(r) for r in rows]


@app.get("/markets/{market_id}", response_model=MarketOut)
async def get_market(market_id: int, current: Annotated[dict, Depends(get_current_user)]):
    pool = get_pool()
    row = await pool.fetchrow(
        _MARKET_WITH_SUBJECT + "WHERE m.marketid = $1",
        market_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Market not found")
    if not current["is_admin"] and row["group_id"] != current.get("group_id"):
        raise HTTPException(status_code=404, detail="Market not found")
    return _market_out(row)


@app.get("/markets/{market_id}/position")
async def my_position(market_id: int, current: Annotated[dict, Depends(get_current_user)]):
    pool = get_pool()
    row = await pool.fetchrow(
        "SELECT yesPos, noPos FROM positions WHERE marketID = $1 AND userID = $2",
        market_id, current["user_id"],
    )
    return {"yes": float(row["yespos"]) if row else 0.0, "no": float(row["nopos"]) if row else 0.0}


@app.get("/users/me/positions")
async def all_my_positions(current: Annotated[dict, Depends(get_current_user)]):
    pool = get_pool()
    rows = await pool.fetch(
        "SELECT marketID AS market_id, yesPos AS yes, noPos AS no FROM positions WHERE userID = $1",
        current["user_id"],
    )
    return [{"market_id": r["market_id"], "yes": float(r["yes"]), "no": float(r["no"])} for r in rows]


@app.get("/markets/{market_id}/price_arc", response_model=list[float])
async def market_price_arc(market_id: int, _: Annotated[dict, Depends(get_current_user)]):
    pool = get_pool()
    rows = await pool.fetch(
        "SELECT yes_prob FROM market_prices WHERE marketID = $1 ORDER BY timestamp",
        market_id,
    )
    return [float(r["yes_prob"]) for r in rows]


@app.get("/markets/{market_id}/activity", response_model=list[FeedEntry])
async def market_activity(market_id: int, _: Annotated[dict, Depends(get_current_user)]):
    """Human trades only — bots filtered out."""
    pool = get_pool()
    rows = await pool.fetch(
        """
        SELECT t.tradeID, u.username, u.token_key, t.side, t.quantity, t.cost, t.is_sell, t.timestamp
        FROM trades t
        JOIN users u ON u.userID = t.userID
        WHERE t.marketID = $1 AND t.is_bot = FALSE
        ORDER BY t.timestamp DESC
        LIMIT 50
        """,
        market_id,
    )
    return [
        FeedEntry(
            trade_id=r["tradeid"],
            is_sell=bool(r["is_sell"]),
            username=r["username"],
            token_key=r["token_key"],
            side=r["side"],
            quantity=int(r["quantity"]),
            cost=float(r["cost"]),
            timestamp=r["timestamp"].isoformat(),
        )
        for r in rows
    ]


@app.post("/markets/{market_id}/buy", response_model=TradeOut)
async def buy(
    market_id: int,
    body: BuyRequest,
    current: Annotated[dict, Depends(get_current_user)],
):
    pool = get_pool()
    lock = market_cache.get_lock(market_id)

    async with lock:
        # Cache hit = 0ms; cold start = 1 DB round trip then cached forever
        state = await market_cache.get_state(pool, market_id)
        if not state:
            raise HTTPException(status_code=404, detail="Market not found")
        if state["status"] != "open":
            raise HTTPException(status_code=400, detail="Market is not open")

        closes_at = state.get("closes_at")
        if closes_at and closes_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Market is closed — awaiting settlement")

        if not current["is_admin"] and state.get("group_id") != current.get("group_id"):
            raise HTTPException(status_code=403, detail="Market not in your group")

        b       = state["b"]
        yes_qty = state["yes_qty"]
        no_qty  = state["no_qty"]

        # Pure Python — 0ms
        cost = lmsr.cost_buy(b, yes_qty, no_qty, body.quantity, body.side)

        # ── Single CTE — 1 DB round trip ─────────────────────────────────────
        # usr: atomically deduct cost; returns nothing if balance insufficient
        # pos: UPSERT position — conditional on usr succeeding (SELECT FROM usr)
        # mkt: delta-update outstanding — conditional on usr (EXISTS)
        # trd: insert trade record — conditional on usr (SELECT FROM usr)
        # If usr returns 0 rows, all other CTEs are no-ops; fetchrow returns None
        if body.side:  # YES
            row = await pool.fetchrow(
                """
                WITH usr AS (
                    UPDATE users SET points = points - $1
                    WHERE userID = $2 AND points >= $1
                    RETURNING points, username, token_key
                ),
                pos AS (
                    INSERT INTO positions (userID, marketID, yesPos, noPos)
                    SELECT $2, $3, $4, 0 FROM usr
                    ON CONFLICT (userID, marketID)
                    DO UPDATE SET yesPos = positions.yesPos + EXCLUDED.yesPos
                ),
                mkt AS (
                    UPDATE markets SET outstandingYes = outstandingYes + $4
                    WHERE marketID = $3 AND EXISTS (SELECT 1 FROM usr)
                ),
                trd AS (
                    INSERT INTO trades (marketID, userID, side, quantity, cost, is_bot)
                    SELECT $3, $2, TRUE, $4, $1, FALSE FROM usr
                    RETURNING tradeID
                )
                SELECT trd.tradeID, usr.points, usr.username, usr.token_key
                FROM trd CROSS JOIN usr
                """,
                cost, current["user_id"], market_id, body.quantity,
            )
        else:  # NO
            row = await pool.fetchrow(
                """
                WITH usr AS (
                    UPDATE users SET points = points - $1
                    WHERE userID = $2 AND points >= $1
                    RETURNING points, username, token_key
                ),
                pos AS (
                    INSERT INTO positions (userID, marketID, yesPos, noPos)
                    SELECT $2, $3, 0, $4 FROM usr
                    ON CONFLICT (userID, marketID)
                    DO UPDATE SET noPos = positions.noPos + EXCLUDED.noPos
                ),
                mkt AS (
                    UPDATE markets SET outstandingNo = outstandingNo + $4
                    WHERE marketID = $3 AND EXISTS (SELECT 1 FROM usr)
                ),
                trd AS (
                    INSERT INTO trades (marketID, userID, side, quantity, cost, is_bot)
                    SELECT $3, $2, FALSE, $4, $1, FALSE FROM usr
                    RETURNING tradeID
                )
                SELECT trd.tradeID, usr.points, usr.username, usr.token_key
                FROM trd CROSS JOIN usr
                """,
                cost, current["user_id"], market_id, body.quantity,
            )

        if not row:
            raise HTTPException(status_code=400, detail="Insufficient balance")

        yes_delta  = body.quantity if body.side else 0
        no_delta   = 0 if body.side else body.quantity
        market_cache.apply_delta(market_id, yes_delta, no_delta)
        new_yes_qty = yes_qty + yes_delta
        new_no_qty  = no_qty  + no_delta

    # Lock released — compute derived values from already-captured locals
    yes_prob    = lmsr.current_price(b, new_yes_qty, new_no_qty)
    no_prob     = 1 - yes_prob
    new_balance = float(row["points"])

    # Price snapshot: fire-and-forget, does not block the response
    asyncio.create_task(
        pool.execute(
            "INSERT INTO market_prices (marketID, yes_prob, no_prob) VALUES ($1,$2,$3)",
            market_id, yes_prob, no_prob,
        )
    )

    feed_entry = FeedEntry(
        trade_id=row["tradeid"],
        is_sell=False,
        username=row["username"],
        token_key=row["token_key"],
        side=body.side,
        quantity=body.quantity,
        cost=cost,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
    await manager.broadcast(
        WSTradeEvent(
            market_id=market_id,
            yes_prob=yes_prob,
            no_prob=no_prob,
            yes_odds=lmsr.decimal_odds(yes_prob),
            no_odds=lmsr.decimal_odds(no_prob),
            feed_entry=feed_entry,
        ).model_dump()
    )
    asyncio.create_task(
        manager.broadcast(
            WSBalanceUpdateEvent(user_id=current["user_id"], new_balance=new_balance).model_dump()
        )
    )

    async def _fire_trade_notifs() -> None:
        title_row = await pool.fetchrow("SELECT title FROM markets WHERE marketid = $1", market_id)
        if title_row:
            side_label = "YES" if body.side else "NO"
            await _notify_participants(
                pool, market_id, title_row["title"],
                current["user_id"], row["username"],
                "trade", f"{row['username']} bought {side_label} ×{body.quantity}",
            )
    asyncio.create_task(_fire_trade_notifs())

    return TradeOut(
        trade_id=row["tradeid"],
        market_id=market_id,
        side=body.side,
        quantity=body.quantity,
        cost=cost,
        new_yes_odds=lmsr.decimal_odds(yes_prob),
        new_no_odds=lmsr.decimal_odds(no_prob),
        new_yes_prob=yes_prob,
        new_balance=new_balance,
    )


@app.post("/markets/{market_id}/sell", response_model=TradeOut)
async def sell(
    market_id: int,
    body: SellRequest,
    current: Annotated[dict, Depends(get_current_user)],
):
    pool = get_pool()
    lock = market_cache.get_lock(market_id)

    async with lock:
        state = await market_cache.get_state(pool, market_id)
        if not state:
            raise HTTPException(status_code=404, detail="Market not found")
        if state["status"] != "open":
            raise HTTPException(status_code=400, detail="Market is not open")

        closes_at = state.get("closes_at")
        if closes_at and closes_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Market is closed — awaiting settlement")

        if not current["is_admin"] and state.get("group_id") != current.get("group_id"):
            raise HTTPException(status_code=403, detail="Market not in your group")

        b       = state["b"]
        yes_qty = state["yes_qty"]
        no_qty  = state["no_qty"]

        payout = lmsr.cost_sell(b, yes_qty, no_qty, body.quantity, body.side)

        # ── Single CTE — 1 DB round trip ─────────────────────────────────────
        # pos: atomically deduct position; returns nothing if position insufficient
        # usr: credit payout — conditional on pos succeeding (EXISTS)
        # mkt: delta-update outstanding — conditional on pos (EXISTS)
        # trd: insert trade record — conditional on pos (SELECT FROM pos)
        # If pos returns 0 rows (insufficient), all other CTEs are no-ops
        if body.side:  # YES
            row = await pool.fetchrow(
                """
                WITH pos AS (
                    UPDATE positions SET yesPos = yesPos - $1
                    WHERE userID = $2 AND marketID = $3 AND yesPos >= $1
                    RETURNING yesPos
                ),
                usr AS (
                    UPDATE users SET points = points + $4
                    WHERE userID = $2 AND EXISTS (SELECT 1 FROM pos)
                    RETURNING points, username, token_key
                ),
                mkt AS (
                    UPDATE markets SET outstandingYes = outstandingYes - $1
                    WHERE marketID = $3 AND EXISTS (SELECT 1 FROM pos)
                ),
                trd AS (
                    INSERT INTO trades (marketID, userID, side, quantity, cost, is_bot, is_sell)
                    SELECT $3, $2, TRUE, $1, $4, FALSE, TRUE FROM pos
                    RETURNING tradeID
                )
                SELECT trd.tradeID, usr.points, usr.username, usr.token_key
                FROM trd CROSS JOIN usr
                """,
                body.quantity, current["user_id"], market_id, payout,
            )
        else:  # NO
            row = await pool.fetchrow(
                """
                WITH pos AS (
                    UPDATE positions SET noPos = noPos - $1
                    WHERE userID = $2 AND marketID = $3 AND noPos >= $1
                    RETURNING noPos
                ),
                usr AS (
                    UPDATE users SET points = points + $4
                    WHERE userID = $2 AND EXISTS (SELECT 1 FROM pos)
                    RETURNING points, username, token_key
                ),
                mkt AS (
                    UPDATE markets SET outstandingNo = outstandingNo - $1
                    WHERE marketID = $3 AND EXISTS (SELECT 1 FROM pos)
                ),
                trd AS (
                    INSERT INTO trades (marketID, userID, side, quantity, cost, is_bot, is_sell)
                    SELECT $3, $2, FALSE, $1, $4, FALSE, TRUE FROM pos
                    RETURNING tradeID
                )
                SELECT trd.tradeID, usr.points, usr.username, usr.token_key
                FROM trd CROSS JOIN usr
                """,
                body.quantity, current["user_id"], market_id, payout,
            )

        if not row:
            raise HTTPException(status_code=400, detail="No position or insufficient position")

        yes_delta  = -(body.quantity if body.side else 0)
        no_delta   = 0 if body.side else -body.quantity
        market_cache.apply_delta(market_id, yes_delta, no_delta)
        new_yes_qty = yes_qty + yes_delta
        new_no_qty  = no_qty  + no_delta

    # Lock released
    yes_prob    = lmsr.current_price(b, new_yes_qty, new_no_qty)
    no_prob     = 1 - yes_prob
    new_balance = float(row["points"])

    # Price snapshot: fire-and-forget, does not block the response
    asyncio.create_task(
        pool.execute(
            "INSERT INTO market_prices (marketID, yes_prob, no_prob) VALUES ($1,$2,$3)",
            market_id, yes_prob, no_prob,
        )
    )

    feed_entry = FeedEntry(
        trade_id=row["tradeid"],
        is_sell=True,
        username=row["username"],
        token_key=row["token_key"],
        side=body.side,
        quantity=body.quantity,
        cost=payout,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
    await manager.broadcast(
        WSTradeEvent(
            market_id=market_id,
            yes_prob=yes_prob,
            no_prob=no_prob,
            yes_odds=lmsr.decimal_odds(yes_prob),
            no_odds=lmsr.decimal_odds(no_prob),
            feed_entry=feed_entry,
        ).model_dump()
    )
    asyncio.create_task(
        manager.broadcast(
            WSBalanceUpdateEvent(user_id=current["user_id"], new_balance=new_balance).model_dump()
        )
    )

    async def _fire_sell_notifs() -> None:
        title_row = await pool.fetchrow("SELECT title FROM markets WHERE marketid = $1", market_id)
        if title_row:
            side_label = "YES" if body.side else "NO"
            await _notify_participants(
                pool, market_id, title_row["title"],
                current["user_id"], row["username"],
                "trade", f"{row['username']} sold {side_label} ×{body.quantity}",
            )
    asyncio.create_task(_fire_sell_notifs())

    return TradeOut(
        trade_id=row["tradeid"],
        market_id=market_id,
        side=body.side,
        quantity=body.quantity,
        cost=payout,
        new_yes_odds=lmsr.decimal_odds(yes_prob),
        new_no_odds=lmsr.decimal_odds(no_prob),
        new_yes_prob=yes_prob,
        new_balance=new_balance,
    )


# ── Notifications ────────────────────────────────────────────────────────────

@app.get("/notifications", response_model=list[NotificationOut])
async def get_notifications(current: Annotated[dict, Depends(get_current_user)]):
    pool = get_pool()
    rows = await pool.fetch(
        """SELECT id, type, market_id, market_title, actor_username, content, is_read, created_at
           FROM notifications WHERE user_id = $1
           ORDER BY created_at DESC LIMIT 50""",
        current["user_id"],
    )
    return [
        NotificationOut(
            id=r["id"], type=r["type"], market_id=r["market_id"],
            market_title=r["market_title"], actor_username=r["actor_username"],
            content=r["content"], is_read=r["is_read"],
            created_at=r["created_at"].isoformat(),
        )
        for r in rows
    ]


@app.post("/notifications/read")
async def mark_notifications_read(current: Annotated[dict, Depends(get_current_user)]):
    pool = get_pool()
    await pool.execute(
        "UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE",
        current["user_id"],
    )
    return {"ok": True}


# ── Push subscriptions ────────────────────────────────────────────────────────

@app.get("/push/vapid-public-key")
async def get_vapid_public_key():
    return {"public_key": VAPID_PUBLIC_KEY}


@app.post("/push/subscribe")
async def push_subscribe(body: dict, current: Annotated[dict, Depends(get_current_user)]):
    pool = get_pool()
    endpoint = body.get("endpoint")
    keys     = body.get("keys", {})
    p256dh   = keys.get("p256dh")
    auth     = keys.get("auth")
    if not endpoint or not p256dh or not auth:
        raise HTTPException(status_code=400, detail="Invalid subscription")
    await pool.execute(
        """INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (endpoint) DO UPDATE SET user_id=$1, p256dh=$3, auth=$4""",
        current["user_id"], endpoint, p256dh, auth,
    )
    return {"ok": True}


@app.delete("/push/subscribe")
async def push_unsubscribe(body: dict, current: Annotated[dict, Depends(get_current_user)]):
    pool = get_pool()
    endpoint = body.get("endpoint")
    if endpoint:
        await pool.execute(
            "DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint=$2",
            current["user_id"], endpoint,
        )
    return {"ok": True}


# ── Leaderboard ──────────────────────────────────────────────

@app.get("/leaderboard", response_model=list[LeaderboardEntry])
async def leaderboard(current: Annotated[dict, Depends(get_current_user)]):
    pool = get_pool()
    group_id = current.get("group_id")
    if not group_id and not current["is_admin"]:
        return []

    user_filter = "WHERE u.is_admin = FALSE" if (current["is_admin"] and not group_id) else ""
    group_join  = "JOIN group_memberships gm ON gm.user_id = u.userid AND gm.group_id = $1" if group_id else ""
    args        = (group_id,) if group_id else ()

    rows = await pool.fetch(
        f"""
        SELECT u.userID, u.username, u.token_key, u.points,
               COUNT(DISTINCT t.marketID) FILTER (WHERE t.is_bot = FALSE) AS markets_participated,
               COUNT(DISTINCT CASE
                   WHEN m.status = 'settled' AND m.settled_side IS NOT NULL
                        AND t.side = m.settled_side AND t.is_bot = FALSE
                   THEN m.marketID END) AS markets_won
        FROM users u
        {group_join}
        LEFT JOIN trades t ON t.userID = u.userID
        LEFT JOIN markets m ON m.marketID = t.marketID
        {user_filter}
        GROUP BY u.userID
        """,
        *args,
    )

    # Mark-to-market: compute actual sell value of open positions using LMSR cost_sell
    # (qty × prob is wrong — the pricing curve means selling moves the price)
    pos_rows = await pool.fetch(
        f"""
        SELECT p.userid, p.yespos, p.nopos,
               m.b, m.outstandingyes, m.outstandingno
        FROM positions p
        JOIN markets m ON m.marketid = p.marketid AND m.status = 'open'
        {"JOIN group_memberships gm2 ON gm2.user_id = p.userid AND gm2.group_id = $1" if group_id else ""}
        """,
        *args,
    )

    mtm: dict[int, float] = {}
    for p in pos_rows:
        uid   = p["userid"]
        b     = float(p["b"])
        yes_q = float(p["outstandingyes"])
        no_q  = float(p["outstandingno"])
        yp    = float(p["yespos"])
        np_   = float(p["nopos"])
        val   = 0.0
        if yp > 0:
            val += lmsr.cost_sell(b, yes_q, no_q, yp, True)
        if np_ > 0:
            val += lmsr.cost_sell(b, yes_q, no_q, np_, False)
        mtm[uid] = mtm.get(uid, 0.0) + val

    result = []
    for r in rows:
        uid          = r["userid"]
        points       = float(r["points"])
        live_points  = points + mtm.get(uid, 0.0)
        participated = int(r["markets_participated"] or 0)
        won          = int(r["markets_won"] or 0)
        accuracy     = (won / participated) if participated > 0 else 0.0
        result.append(
            LeaderboardEntry(
                rank=0,  # assigned after sort
                user_id=uid,
                username=r["username"],
                token_key=r["token_key"],
                points=round(live_points, 1),
                markets_participated=participated,
                markets_won=won,
                accuracy=accuracy,
            )
        )

    result.sort(key=lambda e: e.points, reverse=True)
    for i, e in enumerate(result):
        e.rank = i + 1
    return result


# ── Trophies ─────────────────────────────────────────────────

@app.get("/users/{user_id}/market-pnl", response_model=list[MarketPnLOut])
async def user_market_pnl(user_id: int, _: Annotated[dict, Depends(get_current_user)]):
    pool = get_pool()
    rows = await pool.fetch(
        """
        SELECT
            m.marketID AS market_id,
            m.title    AS market_title,
            m.settled_side,
            m.settled_at,
            COALESCE(SUM(CASE WHEN t.side = TRUE  AND t.is_sell = FALSE THEN t.quantity ELSE 0 END)
                   - SUM(CASE WHEN t.side = TRUE  AND t.is_sell = TRUE  THEN t.quantity ELSE 0 END), 0) AS yes_position,
            COALESCE(SUM(CASE WHEN t.side = FALSE AND t.is_sell = FALSE THEN t.quantity ELSE 0 END)
                   - SUM(CASE WHEN t.side = FALSE AND t.is_sell = TRUE  THEN t.quantity ELSE 0 END), 0) AS no_position,
            COALESCE(SUM(CASE WHEN t.is_sell = FALSE THEN t.cost ELSE 0 END), 0) AS total_bought,
            COALESCE(SUM(CASE WHEN t.is_sell = TRUE  THEN t.cost ELSE 0 END), 0) AS total_sold
        FROM markets m
        JOIN trades t ON t.marketID = m.marketID AND t.userID = $1 AND t.is_bot = FALSE
        WHERE m.status = 'settled' AND m.settled_side IS NOT NULL
        GROUP BY m.marketID, m.title, m.settled_side, m.settled_at
        ORDER BY m.settled_at DESC
        """,
        user_id,
    )
    result = []
    for r in rows:
        yes_pos = float(r["yes_position"])
        no_pos  = float(r["no_position"])
        payout  = yes_pos if r["settled_side"] else no_pos
        net_pnl = payout + float(r["total_sold"]) - float(r["total_bought"])
        result.append(
            MarketPnLOut(
                market_id=r["market_id"],
                market_title=r["market_title"],
                settled_side=r["settled_side"],
                yes_position=round(yes_pos, 1),
                no_position=round(no_pos, 1),
                net_pnl=round(net_pnl, 1),
                settled_at=r["settled_at"].isoformat(),
            )
        )
    return result


# ── Admin routes ─────────────────────────────────────────────

@app.post("/admin/markets", response_model=MarketOut)
async def create_market(
    body: MarketCreate,
    current: Annotated[dict, Depends(get_current_user)],
):
    is_group_admin = current.get("group_role") == "admin"
    if not current["is_admin"] and not is_group_admin:
        raise HTTPException(status_code=403, detail="Group admin only")

    group_id = current.get("group_id")
    if not current["is_admin"] and not group_id:
        raise HTTPException(status_code=400, detail="Not in a group")

    # Parse closes_at if provided — frontend sends local ISO string, interpret as UTC
    closes_at_dt: datetime | None = None
    if body.closes_at:
        try:
            closes_at_dt = datetime.fromisoformat(body.closes_at.replace("Z", "+00:00"))
            if closes_at_dt.tzinfo is None:
                closes_at_dt = closes_at_dt.replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid closes_at format")

    pool = get_pool()

    # Validate subject is a member of the same group
    if body.subject_user_id and group_id:
        member = await pool.fetchrow(
            "SELECT 1 FROM group_memberships WHERE user_id = $1 AND group_id = $2",
            body.subject_user_id, group_id,
        )
        if not member:
            raise HTTPException(status_code=400, detail="Subject user is not in your group")

    row = await pool.fetchrow(
        """INSERT INTO markets (title, description, b, status, created_by, group_id, closes_at, subject_user_id)
           VALUES ($1, $2, $3, 'open', $4, $5, $6, $7)
           RETURNING *, (SELECT username FROM users WHERE userid = $7) AS subject_username,
                       (SELECT token_key FROM users WHERE userid = $7) AS subject_token_key""",
        body.title, body.description, body.b, current["user_id"], group_id, closes_at_dt, body.subject_user_id,
    )
    await manager.broadcast(
        WSMarketCreatedEvent(
            market_id=row["marketid"],
            title=row["title"],
            closes_at=row["closes_at"].isoformat() if row["closes_at"] else None,
        ).model_dump()
    )
    return _market_out(row)


@app.post("/admin/markets/{market_id}/approve", response_model=MarketOut)
async def approve_market(
    market_id: int,
    current: Annotated[dict, Depends(get_current_user)],
):
    if not current["is_admin"]:
        raise HTTPException(status_code=403, detail="Admin only")
    pool = get_pool()
    row = await pool.fetchrow(
        "UPDATE markets SET status = 'open' WHERE marketID = $1 AND status = 'pending' RETURNING *",
        market_id,
    )
    if not row:
        raise HTTPException(status_code=400, detail="Market not found or not pending")
    await manager.broadcast({"type": "market_approved", "market_id": market_id})
    return _market_out(row)


@app.post("/admin/markets/{market_id}/settle")
async def settle_market(
    market_id: int,
    body: SettleRequest,
    current: Annotated[dict, Depends(get_current_user)],
):
    is_group_admin = current.get("group_role") == "admin"
    if not current["is_admin"] and not is_group_admin:
        raise HTTPException(status_code=403, detail="Group admin only")

    pool = get_pool()
    async with pool.acquire() as con:
        async with con.transaction():
            market = await con.fetchrow(
                "SELECT * FROM markets WHERE marketID = $1 FOR UPDATE", market_id
            )
            if not market:
                raise HTTPException(status_code=404, detail="Market not found")
            if not current["is_admin"] and market["group_id"] != current.get("group_id"):
                raise HTTPException(status_code=403, detail="Market not in your group")
            if market["status"] == "settled":
                raise HTTPException(status_code=400, detail="Market already settled")
            if market["status"] != "open":
                raise HTTPException(status_code=400, detail="Market is not open")

            # Pay out winning positions
            if body.side:  # YES wins
                await con.execute(
                    """
                    UPDATE users SET points = points +
                        COALESCE((SELECT yesPos FROM positions
                                  WHERE positions.userID = users.userID AND marketID = $1), 0)
                    """,
                    market_id,
                )
            else:  # NO wins
                await con.execute(
                    """
                    UPDATE users SET points = points +
                        COALESCE((SELECT noPos FROM positions
                                  WHERE positions.userID = users.userID AND marketID = $1), 0)
                    """,
                    market_id,
                )

            # Compute profit per user:
            #   profit = settlement_payout + sell_proceeds - buy_costs
            # Sell costs in the trades table are proceeds (positive cash received),
            # so we subtract buys and add sells across all sides.
            profits = await con.fetch(
                """
                SELECT
                    u.userID, u.username, u.token_key,
                    COALESCE(p.yesPos, 0) AS yesPos,
                    COALESCE(p.noPos, 0)  AS noPos,
                    COALESCE(SUM(CASE WHEN t.is_sell = FALSE THEN t.cost ELSE 0 END), 0) AS total_bought,
                    COALESCE(SUM(CASE WHEN t.is_sell = TRUE  THEN t.cost ELSE 0 END), 0) AS total_sold
                FROM users u
                LEFT JOIN positions p ON p.userID = u.userID AND p.marketID = $1
                LEFT JOIN trades   t ON t.userID = u.userID AND t.marketID = $1 AND t.is_bot = FALSE
                WHERE p.marketID = $1
                GROUP BY u.userID, u.username, u.token_key, p.yesPos, p.noPos
                """,
                market_id,
            )

            # Compute net profit per user — only keep those who:
            # 1. Held a winning position at settlement (payout > 0)
            # 2. Made a net profit (profit > 0)
            # This means: bet correctly AND profited — no consolation trophies
            scored = []
            for r in profits:
                payout       = float(r["yespos"]) if body.side else float(r["nopos"])
                total_bought = float(r["total_bought"])
                total_sold   = float(r["total_sold"])
                net = payout + total_sold - total_bought
                if payout <= 0 or net <= 0:
                    continue  # wrong side, or didn't profit
                scored.append({
                    "user_id": r["userid"],
                    "username": r["username"],
                    "token_key": r["token_key"],
                    "profit": net,
                })

            scored.sort(key=lambda x: x["profit"], reverse=True)

            price_rows = await con.fetch(
                "SELECT yes_prob FROM market_prices WHERE marketID = $1 ORDER BY timestamp",
                market_id,
            )
            arc = [float(p["yes_prob"]) for p in price_rows]

            podium = [
                {
                    "rank": rank_idx + 1,
                    "username": player["username"],
                    "token_key": player["token_key"],
                    "profit": player["profit"],
                }
                for rank_idx, player in enumerate(scored[:3])
            ]

            # Capture final probability before zeroing shares
            final_prob = lmsr.current_price(
                float(market["b"]),
                float(market["outstandingyes"]),
                float(market["outstandingno"]),
            )

            # Close out positions
            await con.execute("DELETE FROM positions WHERE marketID = $1", market_id)
            await con.execute(
                """
                UPDATE markets
                SET status = 'settled', settled_side = $1, settled_at = NOW(),
                    outstandingYes = 0, outstandingNo = 0, final_yes_prob = $3
                WHERE marketID = $2
                """,
                body.side, market_id, final_prob,
            )

    # Invalidate cache — market is now settled, no more trades possible
    market_cache.invalidate(market_id)

    # Broadcast settlement event
    winner = podium[0] if podium else None
    await manager.broadcast(
        WSSettlementEvent(
            market_id=market_id,
            market_title=market["title"],
            settled_side=body.side,
            winner_username=winner["username"] if winner else "",
            winner_token_key=winner["token_key"] if winner else "",
            winner_profit=winner["profit"] if winner else 0,
            podium=podium,
            price_arc=arc,
        ).model_dump()
    )

    # Notify all participants about settlement
    side_label = "YES" if body.side else "NO"
    async def _fire_settlement_notifs() -> None:
        rows = await pool.fetch(
            """SELECT DISTINCT userid FROM trades
               WHERE marketid = $1 AND userid IS NOT NULL AND is_bot = FALSE""",
            market_id,
        )
        for r in rows:
            await _push_notification(
                pool, r["userid"], "settlement", market_id, market["title"],
                None, f"Settled {side_label} — {market['title']}",
            )
    asyncio.create_task(_fire_settlement_notifs())

    return {"ok": True, "settled_side": body.side, "podium": podium}


@app.get("/admin/markets/pending", response_model=list[MarketOut])
async def pending_markets(current: Annotated[dict, Depends(get_current_user)]):
    if not current["is_admin"]:
        raise HTTPException(status_code=403, detail="Admin only")
    pool = get_pool()
    rows = await pool.fetch("SELECT * FROM markets WHERE status = 'pending' ORDER BY created_at")
    return [_market_out(r) for r in rows]


@app.post("/admin/invites", response_model=InviteOut)
async def create_invite(current: Annotated[dict, Depends(get_current_user)]):
    if not current["is_admin"]:
        raise HTTPException(status_code=403, detail="Admin only")
    pool = get_pool()
    token = secrets.token_urlsafe(24)
    expires = datetime.now(timezone.utc) + timedelta(hours=24)
    await pool.execute(
        "INSERT INTO invite_tokens (token, created_by, expires_at) VALUES ($1, $2, $3)",
        token, current["user_id"], expires,
    )
    return InviteOut(token=token, expires_at=expires.isoformat())


# ── Points top-up ────────────────────────────────────────────

@app.post("/admin/users/{target_user_id}/topup")
async def topup_user(
    target_user_id: int,
    current: Annotated[dict, Depends(get_current_user)],
    amount: float = 100.0,
):
    is_group_admin = current.get("group_role") == "admin"
    if not current["is_admin"] and not is_group_admin:
        raise HTTPException(status_code=403, detail="Group admin only")

    if amount <= 0 or amount > 10000:
        raise HTTPException(status_code=400, detail="Amount must be between 1 and 10000")

    pool = get_pool()
    # Group admins can only top up members of their own group
    if not current["is_admin"]:
        member = await pool.fetchrow(
            "SELECT 1 FROM group_memberships WHERE user_id = $1 AND group_id = $2",
            target_user_id, current["group_id"],
        )
        if not member:
            raise HTTPException(status_code=403, detail="User not in your group")

    row = await pool.fetchrow(
        "UPDATE users SET points = points + $1 WHERE userid = $2 RETURNING userid, username, points",
        amount, target_user_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user_id": row["userid"], "username": row["username"], "new_balance": float(row["points"])}



# reset-password endpoint removed — no passwords in this system


# ── Market idea routes ────────────────────────────────────────

def _idea_out(row: asyncpg.Record) -> MarketIdeaOut:
    return MarketIdeaOut(
        idea_id=row["idea_id"],
        title=row["title"],
        description=row["description"],
        status=row["status"],
        submitted_by_username=row["submitted_by_username"],
        submitted_by_token_key=row["submitted_by_token_key"],
        admin_note=row["admin_note"],
        market_id=row["market_id"],
        created_at=row["created_at"].isoformat(),
    )

_IDEA_SELECT = """
    SELECT mi.idea_id, mi.submitted_by, mi.title, mi.description, mi.status, mi.admin_note, mi.market_id, mi.created_at,
           u.username AS submitted_by_username, u.token_key AS submitted_by_token_key
    FROM market_ideas mi
    JOIN users u ON u.userid = mi.submitted_by
"""


@app.get("/groups/me/ideas", response_model=list[MarketIdeaOut])
async def list_ideas(current: Annotated[dict, Depends(get_current_user)]):
    group_id = current.get("group_id")
    if not group_id:
        raise HTTPException(status_code=400, detail="Not in a group")
    pool = get_pool()
    rows = await pool.fetch(
        _IDEA_SELECT + "WHERE mi.group_id = $1 ORDER BY mi.created_at DESC LIMIT 100",
        group_id,
    )
    return [_idea_out(r) for r in rows]


@app.get("/groups/me/ideas/pending", response_model=list[MarketIdeaOut])
async def pending_ideas(current: Annotated[dict, Depends(get_current_user)]):
    """Group admin: list pending ideas that need review."""
    if current.get("group_role") != "admin":
        raise HTTPException(status_code=403, detail="Group admin only")
    group_id = current["group_id"]
    pool = get_pool()
    rows = await pool.fetch(
        _IDEA_SELECT + "WHERE mi.group_id = $1 AND mi.status = 'pending' ORDER BY mi.created_at ASC",
        group_id,
    )
    return [_idea_out(r) for r in rows]


@app.post("/groups/me/ideas", response_model=MarketIdeaOut)
async def submit_idea(body: MarketIdeaCreate, current: Annotated[dict, Depends(get_current_user)]):
    """Any group member can submit a market idea."""
    group_id = current.get("group_id")
    if not group_id:
        raise HTTPException(status_code=400, detail="Not in a group")
    pool = get_pool()
    row = await pool.fetchrow(
        """INSERT INTO market_ideas (group_id, submitted_by, title, description)
           VALUES ($1, $2, $3, $4) RETURNING idea_id, title, description, status, admin_note, market_id, created_at""",
        group_id, current["user_id"], body.title, body.description,
    )
    user_row = await pool.fetchrow("SELECT username, token_key FROM users WHERE userid = $1", current["user_id"])
    return MarketIdeaOut(
        idea_id=row["idea_id"],
        title=row["title"],
        description=row["description"],
        status=row["status"],
        submitted_by_username=user_row["username"],
        submitted_by_token_key=user_row["token_key"],
        admin_note=row["admin_note"],
        market_id=row["market_id"],
        created_at=row["created_at"].isoformat(),
    )


@app.post("/admin/ideas/{idea_id}/approve", response_model=MarketIdeaOut)
async def approve_idea(
    idea_id: int,
    body: ApproveIdeaRequest,
    current: Annotated[dict, Depends(get_current_user)],
):
    """Group admin: approve an idea, optionally editing title/description, then create the market."""
    if current.get("group_role") != "admin":
        raise HTTPException(status_code=403, detail="Group admin only")
    group_id = current["group_id"]
    pool = get_pool()

    idea = await pool.fetchrow(
        _IDEA_SELECT + "WHERE mi.idea_id = $1 AND mi.group_id = $2",
        idea_id, group_id,
    )
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    if idea["status"] != "pending":
        raise HTTPException(status_code=400, detail="Idea already reviewed")

    # Use admin's overrides or fall back to the original
    title       = (body.title or idea["title"]).strip()
    description = body.description if body.description is not None else idea["description"]

    closes_at_dt: datetime | None = None
    if body.closes_at:
        try:
            closes_at_dt = datetime.fromisoformat(body.closes_at.replace("Z", "+00:00"))
            if closes_at_dt.tzinfo is None:
                closes_at_dt = closes_at_dt.replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid closes_at format")

    async with pool.acquire() as con:
        async with con.transaction():
            mkt = await con.fetchrow(
                """INSERT INTO markets (title, description, b, status, created_by, group_id, closes_at)
                   VALUES ($1,$2,$3,'open',$4,$5,$6) RETURNING *""",
                title, description, body.b, current["user_id"], group_id, closes_at_dt,
            )
            updated = await con.fetchrow(
                """UPDATE market_ideas
                   SET status='approved', market_id=$1, reviewed_at=NOW(), reviewed_by=$2
                   WHERE idea_id=$3 RETURNING idea_id, title, description, status, admin_note, market_id, created_at""",
                mkt["marketid"], current["user_id"], idea_id,
            )

    market_cache._cache[mkt["marketid"]] = {
        "b": float(mkt["b"]), "yes_qty": 0.0, "no_qty": 0.0,
        "status": "open", "group_id": group_id, "closes_at": closes_at_dt,
    }
    await manager.broadcast(
        WSMarketCreatedEvent(
            market_id=mkt["marketid"],
            title=mkt["title"],
            closes_at=mkt["closes_at"].isoformat() if mkt["closes_at"] else None,
        ).model_dump()
    )
    # Notify the submitter that their idea became a market
    submitter_id = idea["submitted_by"]
    if submitter_id != current["user_id"]:
        asyncio.create_task(
            _push_notification(pool, submitter_id, "market_created", mkt["marketid"],
                               title, "admin",
                               f'Your idea "{title}" is now live!')
        )
    return MarketIdeaOut(
        idea_id=updated["idea_id"],
        title=updated["title"],
        description=updated["description"],
        status=updated["status"],
        submitted_by_username=idea["submitted_by_username"],
        submitted_by_token_key=idea["submitted_by_token_key"],
        admin_note=updated["admin_note"],
        market_id=updated["market_id"],
        created_at=updated["created_at"].isoformat(),
    )


@app.post("/admin/ideas/{idea_id}/reject", response_model=MarketIdeaOut)
async def reject_idea(
    idea_id: int,
    body: RejectIdeaRequest,
    current: Annotated[dict, Depends(get_current_user)],
):
    """Group admin: reject an idea with an optional note."""
    if current.get("group_role") != "admin":
        raise HTTPException(status_code=403, detail="Group admin only")
    pool = get_pool()
    idea = await pool.fetchrow(
        _IDEA_SELECT + "WHERE mi.idea_id = $1 AND mi.group_id = $2",
        idea_id, current["group_id"],
    )
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    if idea["status"] != "pending":
        raise HTTPException(status_code=400, detail="Idea already reviewed")
    updated = await pool.fetchrow(
        """UPDATE market_ideas
           SET status='rejected', admin_note=$1, reviewed_at=NOW(), reviewed_by=$2
           WHERE idea_id=$3 RETURNING idea_id, title, description, status, admin_note, market_id, created_at""",
        body.note, current["user_id"], idea_id,
    )
    # Notify the submitter
    submitter_id = idea["submitted_by"]
    if submitter_id != current["user_id"]:
        note_text = f' Note: {body.note}' if body.note else ''
        asyncio.create_task(
            _push_notification(pool, submitter_id, "chat", None, None,
                               "admin",
                               f'Your idea "{idea["title"]}" was not approved.{note_text}')
        )
    return MarketIdeaOut(
        idea_id=updated["idea_id"],
        title=updated["title"],
        description=updated["description"],
        status=updated["status"],
        submitted_by_username=idea["submitted_by_username"],
        submitted_by_token_key=idea["submitted_by_token_key"],
        admin_note=updated["admin_note"],
        market_id=updated["market_id"],
        created_at=updated["created_at"].isoformat(),
    )


# ── WebSocket ────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            # Keep alive — clients may send pings
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)
