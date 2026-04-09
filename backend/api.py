"""
FastAPI application — all routes.
"""
import asyncio
import logging
import os
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Annotated

import asyncpg
from fastapi import Depends, FastAPI, HTTPException, Response, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware

from . import lmsr
from .auth import (
    create_token,
    get_current_user,
    hash_password,
    verify_password,
)
from .bots import start_bots, stop_bots
from .db import close_pool, get_pool, init_pool
from . import market_cache
from .models import (
    BuyRequest,
    FeedEntry,
    InviteOut,
    LeaderboardEntry,
    LoginRequest,
    MarketCreate,
    MarketOut,
    RegisterRequest,
    SellRequest,
    SettleRequest,
    TrophyOut,
    TradeOut,
    UserOut,
    WSSettlementEvent,
    WSTradeEvent,
)
from .ws import manager

logger = logging.getLogger(__name__)


# ── Lifespan ─────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool()
    await start_bots()
    yield
    await stop_bots()
    await close_pool()


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

    # Validate invite token
    async with pool.acquire() as con:
        invite = await con.fetchrow(
            "SELECT * FROM invite_tokens WHERE token = $1", body.invite_token
        )
        if not invite:
            raise HTTPException(status_code=400, detail="Invalid invite token")
        if invite["used_at"] is not None:
            raise HTTPException(status_code=400, detail="Invite token already used")
        if invite["expires_at"] < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Invite token expired")

        # Check username
        existing = await con.fetchrow("SELECT 1 FROM users WHERE username = $1", body.username)
        if existing:
            raise HTTPException(status_code=409, detail="Username already taken")

        # Create user
        user = await con.fetchrow(
            """
            INSERT INTO users (username, password_hash, token_key)
            VALUES ($1, $2, $3)
            RETURNING userID, username, points, is_admin, token_key
            """,
            body.username,
            hash_password(body.password),
            body.token_key,
        )

        # Mark invite as used
        await con.execute(
            "UPDATE invite_tokens SET used_at = NOW(), used_by = $1 WHERE token = $2",
            user["userid"],
            body.invite_token,
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
    user = await pool.fetchrow("SELECT * FROM users WHERE username = $1", body.username)
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

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


@app.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", samesite="none", secure=True)
    return {"ok": True}


@app.get("/auth/me", response_model=UserOut)
async def me(current: Annotated[dict, Depends(get_current_user)]):
    pool = get_pool()
    user = await pool.fetchrow("SELECT * FROM users WHERE userID = $1", current["user_id"])
    return UserOut(
        user_id=user["userid"],
        username=user["username"],
        points=float(user["points"]),
        is_admin=user["is_admin"],
        token_key=user["token_key"],
    )


# ── Market routes ────────────────────────────────────────────

@app.get("/markets", response_model=list[MarketOut])
async def list_markets(_: Annotated[dict, Depends(get_current_user)]):
    pool = get_pool()
    rows = await pool.fetch(
        "SELECT * FROM markets WHERE status IN ('open', 'settled') ORDER BY created_at DESC"
    )
    return [_market_out(r) for r in rows]


@app.get("/markets/{market_id}", response_model=MarketOut)
async def get_market(market_id: int, _: Annotated[dict, Depends(get_current_user)]):
    pool = get_pool()
    row = await _require_market(pool, market_id)
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
        SELECT t.tradeID, u.username, u.token_key, t.side, t.quantity, t.cost, t.timestamp
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
                    INSERT INTO trades (marketID, userID, side, quantity, cost, is_bot)
                    SELECT $3, $2, TRUE, $1, $4, FALSE FROM pos
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
                    INSERT INTO trades (marketID, userID, side, quantity, cost, is_bot)
                    SELECT $3, $2, FALSE, $1, $4, FALSE FROM pos
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


# ── Leaderboard ──────────────────────────────────────────────

@app.get("/leaderboard", response_model=list[LeaderboardEntry])
async def leaderboard(_: Annotated[dict, Depends(get_current_user)]):
    pool = get_pool()
    rows = await pool.fetch(
        """
        SELECT
            u.userID,
            u.username,
            u.token_key,
            u.points,
            COUNT(DISTINCT t.marketID) FILTER (WHERE t.is_bot = FALSE)    AS markets_participated,
            COUNT(DISTINCT th.marketID)                                     AS markets_won
        FROM users u
        LEFT JOIN trades t  ON t.userID = u.userID
        LEFT JOIN trophies th ON th.userID = u.userID AND th.rank = 1
        WHERE u.is_admin = FALSE
        GROUP BY u.userID
        ORDER BY u.points DESC
        """
    )
    result = []
    for i, r in enumerate(rows):
        participated = int(r["markets_participated"] or 0)
        won = int(r["markets_won"] or 0)
        accuracy = (won / participated) if participated > 0 else 0.0
        result.append(
            LeaderboardEntry(
                rank=i + 1,
                user_id=r["userid"],
                username=r["username"],
                token_key=r["token_key"],
                points=float(r["points"]),
                markets_participated=participated,
                markets_won=won,
                accuracy=accuracy,
            )
        )
    return result


# ── Trophies ─────────────────────────────────────────────────

@app.get("/users/{user_id}/trophies", response_model=list[TrophyOut])
async def user_trophies(user_id: int, _: Annotated[dict, Depends(get_current_user)]):
    pool = get_pool()
    rows = await pool.fetch(
        """
        SELECT th.*, m.title AS market_title
        FROM trophies th
        JOIN markets m ON m.marketID = th.marketID
        WHERE th.userID = $1
        ORDER BY th.created_at DESC
        """,
        user_id,
    )
    result = []
    for r in rows:
        # Fetch price arc for the card
        arc_rows = await pool.fetch(
            "SELECT yes_prob FROM market_prices WHERE marketID = $1 ORDER BY timestamp ASC",
            r["marketid"],
        )
        arc = [float(a["yes_prob"]) for a in arc_rows]
        result.append(
            TrophyOut(
                trophy_id=r["id"],
                market_id=r["marketid"],
                market_title=r["market_title"],
                rank=r["rank"],
                profit=float(r["profit"]),
                title=r["title"],
                rarity=r["rarity"],
                created_at=r["created_at"].isoformat(),
                price_arc=arc,
            )
        )
    return result


# ── Admin routes ─────────────────────────────────────────────

@app.post("/admin/markets", response_model=MarketOut)
async def create_market(
    body: MarketCreate,
    current: Annotated[dict, Depends(get_current_user)],
):
    if not current["is_admin"]:
        raise HTTPException(status_code=403, detail="Admin only")
    pool = get_pool()
    row = await pool.fetchrow(
        """
        INSERT INTO markets (title, description, b, status, created_by)
        VALUES ($1, $2, $3, 'open', $4)
        RETURNING *
        """,
        body.title, body.description, body.b, current["user_id"],
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
    if not current["is_admin"]:
        raise HTTPException(status_code=403, detail="Admin only")

    pool = get_pool()
    async with pool.acquire() as con:
        async with con.transaction():
            market = await con.fetchrow(
                "SELECT * FROM markets WHERE marketID = $1 FOR UPDATE", market_id
            )
            if not market:
                raise HTTPException(status_code=404, detail="Market not found")
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

            # Compute profit per user (payout - cost)
            profits = await con.fetch(
                """
                SELECT
                    u.userID, u.username, u.token_key,
                    COALESCE(p.yesPos, 0) AS yesPos,
                    COALESCE(p.noPos, 0)  AS noPos,
                    COALESCE(SUM(CASE WHEN t.side = $2 THEN t.cost ELSE 0 END), 0) AS spent,
                    COALESCE(SUM(CASE WHEN t.side != $2 THEN t.cost ELSE 0 END), 0) AS spent_other
                FROM users u
                LEFT JOIN positions p ON p.userID = u.userID AND p.marketID = $1
                LEFT JOIN trades   t ON t.userID = u.userID AND t.marketID = $1 AND t.is_bot = FALSE
                WHERE p.marketID = $1
                GROUP BY u.userID, u.username, u.token_key, p.yesPos, p.noPos
                """,
                market_id, body.side,
            )

            # Compute net profit per user
            scored = []
            for r in profits:
                payout = float(r["yespos"]) if body.side else float(r["nopos"])
                cost = float(r["spent"])
                net = payout - cost
                scored.append({
                    "user_id": r["userid"],
                    "username": r["username"],
                    "token_key": r["token_key"],
                    "profit": net,
                })

            scored.sort(key=lambda x: x["profit"], reverse=True)

            # Determine rarity from market drama
            price_rows = await con.fetch(
                "SELECT yes_prob FROM market_prices WHERE marketID = $1 ORDER BY timestamp",
                market_id,
            )
            arc = [float(p["yes_prob"]) for p in price_rows]
            swing = (max(arc) - min(arc)) if arc else 0
            volume = await con.fetchval(
                "SELECT COALESCE(SUM(quantity), 0) FROM trades WHERE marketID = $1 AND is_bot = FALSE",
                market_id,
            )
            if swing > 0.30 and float(volume) > 500:
                rarity = "legendary"
            elif swing > 0.15 or float(volume) > 200:
                rarity = "rare"
            else:
                rarity = "common"

            TITLES = ["The Oracle", "The Contrarian", "The Degenerate"]

            podium = []
            for rank_idx, player in enumerate(scored[:3]):
                title = TITLES[rank_idx]
                await con.execute(
                    """
                    INSERT INTO trophies (userID, marketID, rank, profit, title, rarity)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (userID, marketID) DO NOTHING
                    """,
                    player["user_id"], market_id, rank_idx + 1,
                    player["profit"], title, rarity,
                )
                podium.append({
                    "rank": rank_idx + 1,
                    "username": player["username"],
                    "token_key": player["token_key"],
                    "profit": player["profit"],
                })

            # Close out positions
            await con.execute("DELETE FROM positions WHERE marketID = $1", market_id)
            await con.execute(
                """
                UPDATE markets
                SET status = 'settled', settled_side = $1, settled_at = NOW(),
                    outstandingYes = 0, outstandingNo = 0
                WHERE marketID = $2
                """,
                body.side, market_id,
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
            winner_title=TITLES[0],
            podium=podium,
            price_arc=arc,
        ).model_dump()
    )

    return {"ok": True, "settled_side": body.side, "rarity": rarity, "podium": podium}


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
