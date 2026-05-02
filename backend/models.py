"""
Pydantic request/response schemas.
"""
from typing import Literal, Optional
from pydantic import BaseModel, Field


VALID_TOKENS = Literal["wizard", "rocket", "fox", "knight", "shark", "bull", "ghost", "dragon"]
VALID_RARITY = Literal["legendary", "rare", "common"]


# ── Auth ────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=30, pattern=r"^[a-zA-Z0-9_]+$")
    token_key: VALID_TOKENS = "rocket"


class GroupCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)


class GroupJoin(BaseModel):
    join_token: Optional[str] = None


class GroupOut(BaseModel):
    group_id: int
    name: str
    role: str        # 'admin' | 'member'
    created_at: str
    access_token: str  # new JWT with group_id embedded — client must store this
    join_token: Optional[str] = None  # returned to group creator only


class LoginRequest(BaseModel):
    username: str


class UserOut(BaseModel):
    user_id: int
    username: str
    points: float
    is_admin: bool
    token_key: str
    access_token: Optional[str] = None
    group_id:   Optional[int] = None
    group_name: Optional[str] = None
    group_role: Optional[str] = None   # 'admin' | 'member' | None


# ── Markets ─────────────────────────────────────────────────

class MarketCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    b: float = Field(default=30.0, ge=10.0, le=10000.0)
    closes_at: Optional[str] = None
    subject_user_id: Optional[int] = None
    league_id: Optional[int] = None


class MarketOut(BaseModel):
    market_id: int
    title: str
    description: Optional[str]
    b: float
    outstanding_yes: float
    outstanding_no: float
    status: str
    yes_prob: float
    no_prob: float
    yes_odds: float
    no_odds: float
    created_at: str
    settled_at: Optional[str]
    settled_side: Optional[bool]
    closes_at: Optional[str]
    subject_user_id: Optional[int] = None
    subject_username: Optional[str] = None
    subject_token_key: Optional[str] = None
    league_id: Optional[int] = None


# ── Trading ─────────────────────────────────────────────────

class BuyRequest(BaseModel):
    quantity: int = Field(..., ge=1, le=10000)
    side: bool   # True = YES, False = NO


class SellRequest(BaseModel):
    quantity: int = Field(..., ge=1, le=10000)
    side: bool


class TradeOut(BaseModel):
    trade_id: int
    market_id: int
    side: bool
    quantity: int
    cost: float
    new_yes_odds: float
    new_no_odds: float
    new_yes_prob: float
    new_balance: float


# ── Activity feed ────────────────────────────────────────────

class FeedEntry(BaseModel):
    trade_id: int
    is_sell: bool = False
    username: str
    token_key: str
    side: bool
    quantity: int
    cost: float
    timestamp: str


# ── Leaderboard ─────────────────────────────────────────────

class LeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    username: str
    token_key: str
    points: float
    markets_participated: int
    markets_won: int
    accuracy: float   # 0.0–1.0


# ── Market PnL (settled markets) ────────────────────────────

class MarketPnLOut(BaseModel):
    market_id: int
    market_title: str
    settled_side: bool
    yes_position: float
    no_position: float
    net_pnl: float
    settled_at: str


# ── Admin ────────────────────────────────────────────────────

class ApproveMarketRequest(BaseModel):
    pass   # no body needed — just the market ID in the URL


class SettleRequest(BaseModel):
    side: bool   # True = YES won, False = NO won


class InviteOut(BaseModel):
    token: str
    expires_at: str


# ── WebSocket broadcast payloads ────────────────────────────

class WSMarketCreatedEvent(BaseModel):
    type: Literal["market_created"] = "market_created"
    market_id: int
    title: str
    closes_at: Optional[str]


class WSBalanceUpdateEvent(BaseModel):
    type: Literal["balance_update"] = "balance_update"
    user_id: int
    new_balance: float


class MessageOut(BaseModel):
    message_id: int
    user_id: int
    username: str
    token_key: str
    content: str
    created_at: str


class MessageIn(BaseModel):
    content: str = Field(..., min_length=1, max_length=280)


class WSChatEvent(BaseModel):
    type: Literal["chat"] = "chat"
    scope: str    # "market" or "group"
    scope_id: int
    message_id: int
    user_id: int
    username: str
    token_key: str
    content: str
    created_at: str


class WSTradeEvent(BaseModel):
    type: Literal["trade"] = "trade"
    market_id: int
    yes_prob: float
    no_prob: float
    yes_odds: float
    no_odds: float
    feed_entry: FeedEntry


class NotificationOut(BaseModel):
    id: int
    type: str          # 'trade' | 'chat' | 'settlement'
    market_id: Optional[int]
    market_title: Optional[str]
    actor_username: Optional[str]
    content: str
    is_read: bool
    created_at: str


class WSNotificationEvent(BaseModel):
    type: Literal["notification"] = "notification"
    user_id: int
    notification: dict   # NotificationOut as dict


class WSSettlementEvent(BaseModel):
    type: Literal["settlement"] = "settlement"
    market_id: int
    market_title: str
    settled_side: bool
    winner_username: str
    winner_token_key: str
    winner_profit: float
    podium: list[dict]   # [{rank, username, token_key, profit}]
    price_arc: list[float]


# ── Leagues ──────────────────────────────────────────────────

class LeagueCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    starts_at: str  # ISO string
    ends_at: str    # ISO string
    starting_points: float = Field(default=1000.0, ge=100.0, le=100000.0)
    schedule_frequency: Optional[Literal["weekly", "biweekly", "custom"]] = None
    schedule_day: Optional[int] = Field(default=None, ge=0, le=6)  # 0=Mon...6=Sun
    schedule_time: Optional[str] = None  # 'HH:MM'


class LeagueOut(BaseModel):
    league_id: int
    group_id: int
    name: str
    starts_at: str
    ends_at: str
    status: str   # 'active' | 'ended'
    starting_points: float
    schedule_frequency: Optional[str]
    schedule_day: Optional[int]
    schedule_time: Optional[str]
    created_at: str


class LeagueLeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    username: str
    token_key: str
    league_pnl: float          # net P&L on league markets (realized + MTM)
    markets_participated: int
    markets_won: int


# ── Market ideas ─────────────────────────────────────────────

class MarketIdeaCreate(BaseModel):
    title: str = Field(..., min_length=5, max_length=200)
    description: Optional[str] = None


class MarketIdeaOut(BaseModel):
    idea_id: int
    title: str
    description: Optional[str]
    status: str   # 'pending' | 'approved' | 'rejected'
    submitted_by_username: str
    submitted_by_token_key: str
    admin_note: Optional[str]
    market_id: Optional[int]
    created_at: str


class ApproveIdeaRequest(BaseModel):
    title: Optional[str] = None   # override title; if omitted, keep original
    description: Optional[str] = None
    b: float = Field(default=30.0, ge=10.0, le=10000.0)
    closes_at: Optional[str] = None
    league_id: Optional[int] = None


class RejectIdeaRequest(BaseModel):
    note: Optional[str] = None
