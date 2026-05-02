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
  login: (username: string) =>
    req<User>("/auth/login", { method: "POST", body: JSON.stringify({ username }) }),
  register: (username: string, token_key: string) =>
    req<User>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, token_key }),
    }),
  logout: () => req<{ ok: boolean }>("/auth/logout", { method: "POST" }),

  // Groups
  createGroup: (name: string) =>
    req<Group>("/groups", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  joinGroupByToken: (join_token: string) =>
    req<Group>("/groups/join", {
      method: "POST",
      body: JSON.stringify({ join_token }),
    }),
  previewGroup: (join_token: string) =>
    req<{ group_id: number; group_name: string }>(`/groups/preview/${join_token}`),
  myGroup: () =>
    req<{ group_id: number; name: string; join_token?: string }>("/groups/me"),
  regenerateJoinToken: () =>
    req<{ join_token: string }>("/groups/me/regenerate-join-token", { method: "POST" }),

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

  // Leaderboard + market PnL
  leaderboard: () => req<LeaderboardEntry[]>("/leaderboard"),
  marketPnl: (userId: number) => req<MarketPnL[]>(`/users/${userId}/market-pnl`),

  // Group
  groupMembers: () => req<GroupMember[]>("/groups/members"),

  // Chat
  marketChat: (id: number) => req<ChatMessage[]>(`/markets/${id}/chat`),
  sendMarketChat: (id: number, content: string) =>
    req<ChatMessage>(`/markets/${id}/chat`, { method: "POST", body: JSON.stringify({ content }) }),
  groupChat: () => req<ChatMessage[]>("/groups/me/chat"),
  sendGroupChat: (content: string) =>
    req<ChatMessage>("/groups/me/chat", { method: "POST", body: JSON.stringify({ content }) }),

  // Notifications
  notifications: () => req<Notification[]>("/notifications"),
  markNotificationsRead: () => req<{ ok: boolean }>("/notifications/read", { method: "POST" }),

  // Push
  vapidPublicKey: () => req<{ public_key: string }>("/push/vapid-public-key"),
  subscribePush: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    req<{ ok: boolean }>("/push/subscribe", { method: "POST", body: JSON.stringify(sub) }),
  unsubscribePush: (endpoint: string) =>
    req<{ ok: boolean }>("/push/subscribe", { method: "DELETE", body: JSON.stringify({ endpoint }) }),

  topupUser: (userId: number, amount: number) =>
    req<{ user_id: number; username: string; new_balance: number }>(
      `/admin/users/${userId}/topup?amount=${amount}`,
      { method: "POST" }
    ),
  // Admin markets
  createMarket: (title: string, description: string | null, b: number, closes_at: string | null, subject_user_id: number | null, league_id?: number | null) =>
    req<Market>("/admin/markets", {
      method: "POST",
      body: JSON.stringify({ title, description, b, closes_at, subject_user_id, league_id }),
    }),
  settleMarket: (id: number, side: boolean) =>
    req<SettleResult>(`/admin/markets/${id}/settle`, {
      method: "POST",
      body: JSON.stringify({ side }),
    }),
  pendingMarkets: () => req<Market[]>("/admin/markets/pending"),
  createInvite: () => req<{ token: string; expires_at: string }>("/admin/invites", { method: "POST" }),

  // Leagues
  leagues: () => req<League[]>("/groups/me/leagues"),
  currentLeague: () => req<League | null>("/groups/me/leagues/current"),
  createLeague: (data: { name: string; starts_at: string; ends_at: string; starting_points: number; schedule_frequency?: string | null; schedule_day?: number | null; schedule_time?: string | null }) =>
    req<League>("/groups/me/leagues", { method: "POST", body: JSON.stringify(data) }),
  endLeague: (leagueId: number) =>
    req<{ ok: boolean }>(`/groups/me/leagues/${leagueId}/end`, { method: "POST" }),
  leagueLeaderboard: (leagueId: number) =>
    req<LeagueLeaderboardEntry[]>(`/groups/me/leagues/${leagueId}/leaderboard`),

  // Ideas
  ideas: () => req<MarketIdea[]>("/groups/me/ideas"),
  pendingIdeas: () => req<MarketIdea[]>("/groups/me/ideas/pending"),
  submitIdea: (title: string, description?: string) =>
    req<MarketIdea>("/groups/me/ideas", { method: "POST", body: JSON.stringify({ title, description }) }),
  approveIdea: (ideaId: number, data: { title?: string; description?: string; b?: number; closes_at?: string | null; league_id?: number | null }) =>
    req<MarketIdea>(`/admin/ideas/${ideaId}/approve`, { method: "POST", body: JSON.stringify(data) }),
  rejectIdea: (ideaId: number, note?: string) =>
    req<MarketIdea>(`/admin/ideas/${ideaId}/reject`, { method: "POST", body: JSON.stringify({ note }) }),
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
  subject_user_id: number | null;
  subject_username: string | null;
  subject_token_key: string | null;
  league_id: number | null;
};

export type League = {
  league_id: number;
  group_id: number;
  name: string;
  starts_at: string;
  ends_at: string;
  status: "active" | "ended";
  starting_points: number;
  schedule_frequency: "weekly" | "biweekly" | "custom" | null;
  schedule_day: number | null;  // 0=Mon...6=Sun
  schedule_time: string | null; // 'HH:MM'
  created_at: string;
};

export type LeagueLeaderboardEntry = {
  rank: number;
  user_id: number;
  username: string;
  token_key: string;
  league_pnl: number;
  markets_participated: number;
  markets_won: number;
};

export type MarketIdea = {
  idea_id: number;
  title: string;
  description: string | null;
  status: "pending" | "approved" | "rejected";
  submitted_by_username: string;
  submitted_by_token_key: string;
  admin_note: string | null;
  market_id: number | null;
  created_at: string;
};

export type FeedEntry = {
  trade_id: number;
  is_sell: boolean;
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

export type MarketPnL = {
  market_id: number;
  market_title: string;
  settled_side: boolean;
  yes_position: number;
  no_position: number;
  net_pnl: number;
  settled_at: string;
};

export type SettleResult = {
  ok: boolean;
  settled_side: boolean;
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

export type Notification = {
  id: number;
  type: "trade" | "chat" | "settlement" | "market_created";
  market_id: number | null;
  market_title: string | null;
  actor_username: string | null;
  content: string;
  is_read: boolean;
  created_at: string;
};

export type WSNotificationEvent = {
  type: "notification";
  user_id: number;
  notification: Notification;
};

export type WSEvent = WSTradeEvent | WSSettlementEvent | WSMarketCreatedEvent | WSBalanceUpdateEvent | WSChatEvent | WSNotificationEvent;

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
