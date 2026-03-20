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
    password: str = Field(..., min_length=6)
    token_key: VALID_TOKENS = "rocket"
    invite_token: str


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    user_id: int
    username: str
    points: float
    is_admin: bool
    token_key: str
    access_token: Optional[str] = None


# ── Markets ─────────────────────────────────────────────────

class MarketCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    b: float = Field(default=100.0, ge=10.0, le=10000.0)


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


# ── Trophies ────────────────────────────────────────────────

class TrophyOut(BaseModel):
    trophy_id: int
    market_id: int
    market_title: str
    rank: int
    profit: float
    title: str
    rarity: VALID_RARITY
    created_at: str
    price_arc: list[float]   # list of yes_prob values for the sparkline


# ── Admin ────────────────────────────────────────────────────

class ApproveMarketRequest(BaseModel):
    pass   # no body needed — just the market ID in the URL


class SettleRequest(BaseModel):
    side: bool   # True = YES won, False = NO won


class InviteOut(BaseModel):
    token: str
    expires_at: str


# ── WebSocket broadcast payloads ────────────────────────────

class WSTradeEvent(BaseModel):
    type: Literal["trade"] = "trade"
    market_id: int
    yes_prob: float
    no_prob: float
    yes_odds: float
    no_odds: float
    feed_entry: FeedEntry


class WSSettlementEvent(BaseModel):
    type: Literal["settlement"] = "settlement"
    market_id: int
    market_title: str
    settled_side: bool
    winner_username: str
    winner_token_key: str
    winner_profit: float
    winner_title: str
    podium: list[dict]   # [{rank, username, token_key, profit}]
    price_arc: list[float]
