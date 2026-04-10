/**
 * Thin API client. All requests go to NEXT_PUBLIC_API_URL.
 * Credentials: "include" so httpOnly cookies are sent automatically.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TOKEN_KEY = "access_token";
export const tokenStore = {
  get: () => (typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = Array.isArray(body.detail)
      ? body.detail.map((e: { msg: string }) => e.msg).join(", ")
      : (body.detail ?? "Unknown error");
    throw new ApiError(res.status, String(detail));
  }
  return res.json();
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ── Auth ─────────────────────────────────────────────────────

export type User = {
  user_id: number;
  username: string;
  points: number;
  is_admin: boolean;
  token_key: string;
  access_token?: string;
  group_id:   number | null;
  group_name: string | null;
  group_role: "admin" | "member" | null;
};

export type Group = {
  group_id: number;
  name: string;
  role: "admin" | "member";
  created_at: string;
  access_token: string;
};

export const api = {
  // Auth
  me: () => req<User>("/auth/me"),
  login: (username: string, password: string) =>
    req<User>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  register: (username: string, password: string, token_key: string) =>
    req<User>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password, token_key }),
    }),
  logout: () => req<{ ok: boolean }>("/auth/logout", { method: "POST" }),

  // Groups
  createGroup: (name: string, password: string, invite_token: string) =>
    req<Group>("/groups", {
      method: "POST",
      body: JSON.stringify({ name, password, invite_token }),
    }),
  joinGroup: (name: string, password: string) =>
    req<Group>("/groups/join", {
      method: "POST",
      body: JSON.stringify({ name, password }),
    }),

  // Markets
  markets: () => req<Market[]>("/markets"),
  market: (id: number) => req<Market>(`/markets/${id}`),
  activity: (id: number) => req<FeedEntry[]>(`/markets/${id}/activity`),
  priceArc: (id: number) => req<number[]>(`/markets/${id}/price_arc`),
  buy: (id: number, side: boolean, quantity: number) =>
    req<TradeOut>(`/markets/${id}/buy`, {
      method: "POST",
      body: JSON.stringify({ side, quantity }),
    }),
  sell: (id: number, side: boolean, quantity: number) =>
    req<TradeOut>(`/markets/${id}/sell`, {
      method: "POST",
      body: JSON.stringify({ side, quantity }),
    }),

  // Positions
  position: (id: number) => req<{ yes: number; no: number }>(`/markets/${id}/position`),
  allPositions: () => req<{ market_id: number; yes: number; no: number }[]>("/users/me/positions"),

  // Leaderboard + trophies
  leaderboard: () => req<LeaderboardEntry[]>("/leaderboard"),
  trophies: (userId: number) => req<Trophy[]>(`/users/${userId}/trophies`),

  // Group
  groupMembers: () => req<GroupMember[]>("/groups/members"),

  // Chat
  marketChat: (id: number) => req<ChatMessage[]>(`/markets/${id}/chat`),
  sendMarketChat: (id: number, content: string) =>
    req<ChatMessage>(`/markets/${id}/chat`, { method: "POST", body: JSON.stringify({ content }) }),
  groupChat: () => req<ChatMessage[]>("/groups/me/chat"),
  sendGroupChat: (content: string) =>
    req<ChatMessage>("/groups/me/chat", { method: "POST", body: JSON.stringify({ content }) }),

  // Admin
  createMarket: (title: string, description: string | null, b: number, closes_at: string | null) =>
    req<Market>("/admin/markets", {
      method: "POST",
      body: JSON.stringify({ title, description, b, closes_at }),
    }),
  settleMarket: (id: number, side: boolean) =>
    req<SettleResult>(`/admin/markets/${id}/settle`, {
      method: "POST",
      body: JSON.stringify({ side }),
    }),
  pendingMarkets: () => req<Market[]>("/admin/markets/pending"),
  createInvite: () => req<{ token: string; expires_at: string }>("/admin/invites", { method: "POST" }),
};

// ── Types ─────────────────────────────────────────────────────

export type Market = {
  market_id: number;
  title: string;
  description: string | null;
  b: number;
  outstanding_yes: number;
  outstanding_no: number;
  status: "pending" | "open" | "settled";
  yes_prob: number;
  no_prob: number;
  yes_odds: number;
  no_odds: number;
  created_at: string;
  settled_at: string | null;
  settled_side: boolean | null;
  closes_at: string | null;
};

export type FeedEntry = {
  trade_id: number;
  username: string;
  token_key: string;
  side: boolean;
  quantity: number;
  cost: number;
  timestamp: string;
};

export type TradeOut = {
  trade_id: number;
  market_id: number;
  side: boolean;
  quantity: number;
  cost: number;
  new_yes_odds: number;
  new_no_odds: number;
  new_yes_prob: number;
  new_balance: number;
};

export type LeaderboardEntry = {
  rank: number;
  user_id: number;
  username: string;
  token_key: string;
  points: number;
  markets_participated: number;
  markets_won: number;
  accuracy: number;
};

export type Trophy = {
  trophy_id: number;
  market_id: number;
  market_title: string;
  rank: number;
  profit: number;
  title: string;
  rarity: "legendary" | "rare" | "common";
  created_at: string;
  price_arc: number[];
};

export type SettleResult = {
  ok: boolean;
  settled_side: boolean;
  rarity: string;
  podium: { rank: number; username: string; token_key: string; profit: number }[];
};

// ── WebSocket ─────────────────────────────────────────────────

export type WSTradeEvent = {
  type: "trade";
  market_id: number;
  yes_prob: number;
  no_prob: number;
  yes_odds: number;
  no_odds: number;
  feed_entry: FeedEntry;
};

export type WSSettlementEvent = {
  type: "settlement";
  market_id: number;
  market_title: string;
  settled_side: boolean;
  winner_username: string;
  winner_token_key: string;
  winner_profit: number;
  winner_title: string;
  podium: { rank: number; username: string; token_key: string; profit: number }[];
  price_arc: number[];
};

export type WSMarketCreatedEvent = {
  type: "market_created";
  market_id: number;
  title: string;
  closes_at: string | null;
};

export type WSBalanceUpdateEvent = {
  type: "balance_update";
  user_id: number;
  new_balance: number;
};

export type WSChatEvent = {
  type: "chat";
  scope: "market" | "group";
  scope_id: number;
  message_id: number;
  user_id: number;
  username: string;
  token_key: string;
  content: string;
  created_at: string;
};

export type WSEvent = WSTradeEvent | WSSettlementEvent | WSMarketCreatedEvent | WSBalanceUpdateEvent | WSChatEvent;

export type ChatMessage = {
  message_id: number;
  user_id: number;
  username: string;
  token_key: string;
  content: string;
  created_at: string;
};

export type GroupMember = {
  user_id: number;
  username: string;
  token_key: string;
  points: number;
  role: "admin" | "member";
};

export function connectWS(onEvent: (e: WSEvent) => void): () => void {
  const url = BASE.replace(/^http/, "ws") + "/ws";
  let ws: WebSocket;
  let dead = false;

  function connect() {
    ws = new WebSocket(url);
    ws.onmessage = (e) => {
      try {
        onEvent(JSON.parse(e.data) as WSEvent);
      } catch {/* ignore malformed frames */}
    };
    ws.onclose = () => {
      if (!dead) setTimeout(connect, 3000); // reconnect
    };
  }

  connect();
  return () => { dead = true; ws?.close(); };
}
