# Design System — Prediction Market

## Product Context
- **What this is:** A prediction market web app for a close friend group — markets on real social events ("how many drinks will Jamie have?", "who leaves first?")
- **Who it's for:** A tight friend group, 5–20 people, using it on nights out on their phones
- **Space/industry:** Social game / prediction market. Sits in a gap between crypto-VC prediction markets (Kalshi, Polymarket) and loud sports books (DraftKings). Closest analogy: a social game that happens to have live prices.
- **Project type:** Mobile-first web app (Next.js, Vercel-deployed)

## Aesthetic Direction
- **Direction:** Industrial-Minimal × Social Game
- **Decoration level:** Minimal — typography and one accent color carry all the visual weight. No gradients on backgrounds, no shadow stacks, no decorative shapes.
- **Mood:** Sharp and alive. Feels like a real exchange, not a toy. But the one electric accent color makes clear this is a game — something exciting is happening right now.
- **Research references:** Kalshi (dark + neon, useful baseline to diverge from), Polymarket (too serious/financial), DraftKings (too loud/promotional)

## Typography
- **Numbers/Odds (hero):** `Geist Mono` — all odds, points balances, and live prices use monospaced digits. `font-variant-numeric: tabular-nums` so numbers don't jump when animating. Creates a "live terminal" feel without being nerdy.
- **Body/UI:** `Geist Sans` — same type family as Geist Mono, so the system is coherent. Clean, modern, highly legible at small sizes on mobile.
- **UI Labels:** `Geist Mono` in uppercase with letter-spacing — used for status chips (LIVE, PENDING), timestamps, metadata. Feels like data.
- **Code:** N/A (no code-facing UI)
- **Loading:** Google Fonts CDN — `https://fonts.googleapis.com/css2?family=Geist+Mono:wght@300;400;500;600;700&family=Geist:wght@300;400;500;600;700&display=swap`
- **Scale:**
  - `odds-hero`: 48–64px / Geist Mono 700 — the main price display on a market card
  - `heading`: 18–28px / Geist Sans 600 — market titles, page headings
  - `body`: 14–15px / Geist Sans 400 — feed text, descriptions
  - `label`: 11–12px / Geist Mono 500 uppercase — status, metadata, timestamps
  - `micro`: 10–11px / Geist Mono 400 — sub-labels inside cards

## Color
- **Approach:** Restrained — near-monochrome foundation with one electric accent. The accent does 100% of the emotional work.

| Name       | Hex       | Usage |
|------------|-----------|-------|
| Canvas     | `#0A0A0A` | Page background |
| Card       | `#141414` | Market card background |
| Surface    | `#1F1F1F` | Input backgrounds, inner surfaces |
| Border     | `#2A2A2A` | Card borders, dividers |
| Muted text | `#555555` | Timestamps, metadata, sub-labels |
| Secondary  | `#999999` | Feed text, supporting copy |
| Primary    | `#F5F5F5` | Headings, main body text |
| **Accent** | **`#D4FF00`** | **YES buttons, active odds, live indicator, leaderboard #1, accent glow** |
| Danger     | `#FF4444` | Error states, destructive actions |
| Success    | `#22C55E` | Positive balance change, payout received |

**Accent usage rules:**
- The accent (#D4FF00) is used ONLY for: YES bet buttons/labels, the live "●" indicator, #1 position on the leaderboard, active odds value (the big number on market detail), and WebSocket flash animations.
- NO other element uses the accent color. Not headings, not borders, not backgrounds.
- Accent on dark: always readable (contrast ratio ~10:1)
- Accent glow: `rgba(212, 255, 0, 0.12)` for subtle backgrounds (YES block on market detail), `rgba(212, 255, 0, 0.25)` for hover/active glow

**Dark mode:** This is a dark-mode-only application. There is no light mode.

**Semantic colors:**
- `success: #22C55E` — payout received, positive PnL
- `danger: #FF4444` — error states, settle confirmation
- `warning: #FFAA00` — pending market status

## Spacing
- **Base unit:** 8px
- **Density:** Comfortable — generous enough for fingers, tight enough to show multiple markets on screen without scrolling
- **Scale:**
  - `2xs`: 4px
  - `xs`: 8px
  - `sm`: 12px
  - `md`: 16px
  - `lg`: 24px
  - `xl`: 32px
  - `2xl`: 48px

## Layout
- **Approach:** Grid-disciplined — strict card grid, predictable alignment. This is an app, not a marketing site.
- **Mobile-first column:** Max content width 480px, centered on desktop. This is designed for phones on a night out — desktop is secondary.
- **Grid:** Single column on mobile, 2-col on tablet+ for market list
- **Max content width:** 480px (app shell), 1200px (admin/leaderboard views)
- **Border radius:**
  - `sm`: 4px — badges, chips
  - `md`: 6px — buttons, inputs
  - `lg`: 10–12px — market cards
  - `xl`: 16–24px — modal sheets, phone frame
  - `full`: 9999px — avatar circles, points chip
- **Thumb zone:** Action buttons (YES/NO, Quick Bet) are always in the lower 60% of the screen on mobile — reachable with one hand

## Motion
- **Approach:** Intentional — every animation has a purpose. No decorative motion.
- **Framework:** Framer Motion (Next.js)
- **Easing:** `enter: ease-out` / `exit: ease-in` / `move: ease-in-out`
- **Duration scale:**
  - `micro`: 50–100ms — button press feedback
  - `short`: 150–250ms — state transitions (badge, price update flash)
  - `medium`: 250–400ms — card entrance, modal open
  - `long`: 400–700ms — settlement celebration

**Specific animations:**
- **Odds flash:** When WebSocket pushes a price update, the odds value flashes accent → white → accent over 300ms. Signals "something happened."
- **Activity feed:** New feed items slide in from the bottom (translate-y: 20px → 0, opacity: 0 → 1, 200ms ease-out). Feels like a live ticker.
- **Buy/sell confirmation:** Brief scale pulse (1.0 → 1.04 → 1.0, 150ms) on the button after trade fires.
- **Settlement:** Full-screen overlay with podium reveal. The dramatic beat — treat it like the climax of a game, not a database write confirmation.
- **Quick Bet disable:** Button disables and shows a spinner for 1.5s after first tap to prevent double-fires.

## Player Token System

Users select a **pixel art token** at signup. It replaces initials everywhere in the app — activity feed, leaderboard, trophy cards. Tokens are colorful and deliberately contrast with the near-black canvas to pop.

**Art spec:** 16×16 pixel grid, rendered as SVG rects or canvas at multiple sizes. `image-rendering: pixelated` — no anti-aliasing.

**Display sizes:**
- `sm` 32px — activity feed, inline references
- `md` 48px — leaderboard rows
- `lg` 96–112px — trophy card (inside the gold ring)
- `xl` 128px — token selection screen

**The 8 tokens:**

| Key | Name | Primary colors |
|-----|------|----------------|
| `wizard` | The Wizard | Purple `#A855F7` + gold `#8B6914` + white |
| `rocket` | The Rocket | Red `#FF4757` + orange `#FF7F50` + yellow `#FFD93D` |
| `fox` | The Fox | Orange `#FF7F50` + white + black |
| `knight` | The Knight | Silver `#C8D6E5` + blue `#5C7AEA` + black visor |
| `shark` | The Shark | Teal `#4ECDC4` + white teeth + black eyes |
| `bull` | The Bull | Yellow `#FFD93D` + dark gold `#8B6914` |
| `ghost` | The Ghost | White + blue `#5C7AEA` eyes |
| `dragon` | The Dragon | Green `#6BCB77` + yellow `#FFD93D` + red `#FF4757` |

**Storage:** `token_key` column on the `users` table (varchar, one of the 8 keys above). Validated server-side against the allowed set.

**Pixel art color palette** (shared across all tokens):

```
R: #FF4757  O: #FF7F50  Y: #FFD93D  G: #6BCB77
B: #4ECDC4  U: #5C7AEA  V: #A855F7  W: #FFFFFF
K: #111111  S: #C8D6E5  N: #FFB8A0  L: #D4FF00
M: #FF6B9D  D: #8B6914  T: #FF9F43
```

## Settlement System — Two Distinct Artifacts

**1. Settlement Popup** (shown to everyone on market settle)
- Full-screen overlay delivered via WebSocket broadcast to all connected clients
- `YES WINS` / `NO WINS` in 36px Geist Mono accent — hits you in the face
- Price arc as background art (from `market_prices` table)
- `VERIFIED` stamp, `SETTLED` series label, card number
- Winner block: 🥇 + name + "Top Earner · The Oracle" + profit delta
- Podium row: 🥈🥉 + other players
- Dismisses after ~4 seconds or on tap. Has a "Share" button for screenshotting.
- **Everyone sees this** — not just the winner.

**2. Trophy Card** (minted to winner's profile, permanent)
- Collectible card format, lives in `/profile/[id]` trophy collection
- **Winner's pixel token is the hero** — 110px in a spinning metallic ring, centered
- Winner name in metallic gradient, earned title below
- Rarity tier (LEGENDARY / RARE / COMMON) based on market drama:
  - LEGENDARY: large price swing (>30% move) + high volume (>500 total bet)
  - RARE: moderate swing or volume
  - COMMON: low-key market
- Rarity determines visual treatment: lime glow (legendary), indigo (rare), monochrome (common)
- Each card has a serial number (`#007`) from the `trophies` table `id`
- **Earned titles** (computed at settlement, stored in `trophies.title`):
  - ⚡ The Oracle — highest accuracy across all markets
  - 🎯 The Contrarian — bet against the majority and won
  - 🐋 The Whale — largest single bet in this market
  - 🌅 Early Bird — first to bet on the winning side
  - 🎲 The Degenerate — highest volume, still profitable
- Price arc at the card bottom (mini version, 56px tall)

## Component Patterns

### Market Card (list view)
- Title (Geist Sans 500, 14px)
- YES/NO odds pills (Geist Mono, tabular-nums)
- Status badge (LIVE / PENDING / SETTLED)
- Sparkline (SVG, accent color, 60×20px)
- Trader count + volume (Geist Mono, muted)

### Market Detail (trading screen)
- Large odds blocks: YES block has accent background tint, NO block is neutral
- Quick Bet row: 4 buttons (YES 5 / YES 10 / NO 5 / NO 10) in 4-column grid
- Activity feed: avatar initial + feed text + timestamp, slide-in animation
- Price history chart: sparkline expanded

### Trophy Card / Settlement Card (the viral moment)
This is NOT a popup or a modal. It is a **collectible card** — full 2:3 aspect ratio, screenshot-worthy, designed to be sent to the group chat unprompted.

**Structure:**
- **Background art**: The market's actual price arc (sparkline from `market_prices` table) rendered as a large SVG that fills the card — gradient fade, glowing line. Every card looks different because every market has a different arc.
- **Card anatomy** (top to bottom):
  - Top bar: `◆ SETTLED` series label + card number (#024) — rarity framing
  - Mid-card: the price arc (visible through gradient overlay)
  - `VERIFIED` stamp — rotated ~8°, accent border — authentication aesthetic
  - Market name (small, muted)
  - `YES WINS` / `NO WINS` in 36px Geist Mono accent — the result screams at you
  - Result sub-text: "Jamie had 6 drinks · 20 Mar 2026"
  - Winner block: 🥇 + metallic lime name + "Top Earner" label + profit delta
  - Podium row: 🥈🥉 + other players, compact
  - Footer: timestamp + `odds.group` brand
- **Visual treatment:**
  - Background: near-black with the price arc SVG
  - Gradient overlay: dark at top/bottom, transparent in middle so the arc is visible
  - Subtle foil shimmer (CSS animation) — makes it feel like a premium card
  - Hover: slight tilt + lift (translateY + rotateX) — physical card interaction
  - Winner name: metallic gradient (`#D4FF00 → #AACC00 → #D4FF00`) via `-webkit-background-clip: text`
  - Box shadow: glow in accent color on hover
- **Share button:** Below the card, outside the card frame — "Share to group →" in accent
- **Card generation:** Server-side or client-side render, downloadable as PNG for WhatsApp sharing

### Leaderboard Row
- #1 row has accent left-border and subtle accent tint
- Points in Geist Mono tabular-nums
- Accuracy % in Geist Mono muted

### Activity Feed Entry
- Avatar: 28–32px circle, Geist Mono initials
- "Tom bet 50pts on YES" — "YES" in accent Geist Mono, "NO" in muted
- Timestamp in muted Geist Mono

## Decisions Log

| Date       | Decision | Rationale |
|------------|----------|-----------|
| 2026-03-20 | Industrial-Minimal × Social Game aesthetic | Sits in gap between sterile fintech (Polymarket) and loud sports books (DraftKings). Friend-group game needs to feel alive but not overwhelming. |
| 2026-03-20 | Electric Lime #D4FF00 accent | Ownable — nobody in prediction markets uses this tone. Against near-black it's electric. Gen-Z streetwear energy (Supreme, Fragment). One accent color does all emotional work. |
| 2026-03-20 | Geist Mono for all numbers/odds | Tabular-nums means digits don't jump during live animations. Terminal feel without nerdiness. Coherent with Geist Sans body. |
| 2026-03-20 | Dark-mode only | Every serious betting/exchange app is dark. Light mode would feel wrong for a night-out game. Eliminates toggle complexity. |
| 2026-03-20 | 480px max content width | Mobile-first. Phone app used on nights out. Desktop is a secondary surface. |
| 2026-03-20 | Decimal odds not percentages | "2.4x" is more readable than "42%" for betting context. User's explicit preference. |
