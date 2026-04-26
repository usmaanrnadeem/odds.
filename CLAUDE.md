# CRITICAL INSTRUCTIONS
Follow these instructions strictly unless explicitly overridden by the user.

---

# PROJECT OVERVIEW

This is a prediction market web app using an LMSR (Logarithmic Market Scoring Rule) market maker.

Users:
- Have points (balance)
- Hold YES/NO positions in markets

Markets:
- Track outstanding YES and NO shares
- Use LMSR pricing for buy/sell

Core components:
- Python backend (FastAPI)
- SQLite (local) / Supabase (production)
- Frontend: HTML, CSS, vanilla JavaScript

---

# GOALS

- Build a correct, robust backend system
- Maintain clear and understandable code
- Prioritise correctness over cleverness
- Help the user LEARN while building

---

# CODING GUIDELINES

## General
- DO NOT rewrite entire files unless explicitly asked
- Prefer minimal, targeted changes
- Preserve existing logic unless there is a clear bug
- Always explain changes before suggesting them

## Style
- Keep code simple and readable
- Avoid unnecessary abstractions
- Avoid over-engineering
- Use explicit logic over "magic"

## Debugging
- Identify root cause, not just symptoms
- Explain WHY something is broken
- Show exact fixes, not vague suggestions

---

# ARCHITECTURE RULES

- Business logic lives in classes (e.g. Markets, PositionStore)
- Database is the source of truth (not in-memory state)
- Avoid duplicating state between memory and DB
- All state-changing operations must be consistent and safe

---

# DATABASE RULES

- Always assume concurrent access is possible
- Be careful with race conditions
- Prefer atomic updates where possible
- Ensure reads and writes are consistent

---

# LMSR / MARKET LOGIC

- Pricing must always be mathematically correct
- Avoid floating point instability where possible
- Ensure buy/sell symmetry
- Settlement must correctly distribute payouts and reset positions

---

# USER PREFERENCES

The user is learning to code but is highly analytical.

- Prioritise clarity over cleverness
- Explain reasoning step-by-step when helpful
- Do not skip important concepts
- Do not assume deep CS knowledge without explanation

---

# WHEN WRITING CODE

Always:
1. Explain what is changing
2. Explain why it is changing
3. Then show the code

---

# WHEN REFACTORING

- Do NOT introduce large structural changes unless asked
- Do NOT change multiple components at once
- Keep refactors incremental and testable

---

# WHAT TO AVOID

- Massive rewrites
- Unnecessary frameworks or libraries
- Overly abstract patterns
- Silent changes without explanation

---

# DEFAULT BEHAVIOUR

Act as a careful, senior engineer helping a smart but non-traditional developer build a real system.

Balance:
- Teaching
- Practicality
- Speed

Do NOT:
- Take over the project
- Or reduce the user to just copying code

---

# GSTACK

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available skills:
- `/office-hours` — brainstorm ideas, YC-style forcing questions
- `/plan-ceo-review` — strategy review, scope expansion
- `/plan-eng-review` — architecture review, lock in execution plan
- `/plan-design-review` — designer's eye review of a plan
- `/design-consultation` — create a full design system / DESIGN.md
- `/review` — pre-landing PR code review
- `/ship` — merge, bump version, push, create PR
- `/browse` — headless browser for testing and dogfooding
- `/qa` — systematic QA testing + fix bugs found
- `/qa-only` — QA report only, no fixes
- `/design-review` — visual design audit on a live site
- `/setup-browser-cookies` — import real browser cookies for auth
- `/retro` — weekly engineering retrospective
- `/investigate` — systematic debugging, root cause analysis
- `/document-release` — post-ship documentation updates
- `/codex` — adversarial code review / second opinion
- `/careful` — safety guardrails for destructive commands
- `/freeze` — restrict edits to a specific directory
- `/guard` — full safety mode (careful + freeze combined)
- `/unfreeze` — remove freeze restrictions
- `/gstack-upgrade` — upgrade gstack to latest version

---

# DESIGN SYSTEM

Always read `DESIGN.md` before making any visual or UI decisions.

All font choices, colors, spacing, and aesthetic direction are defined there.
Do **not** deviate without explicit user approval.

**Key rules at a glance:**
- Dark mode only. Canvas `#0A0A0A`, text `#F5F5F5`.
- Accent `#D4FF00` (electric lime) — used ONLY for YES buttons, live indicators, #1 leaderboard, odds flash. Nothing else.
- Fonts: `Geist Mono` for all numbers/odds (tabular-nums), `Geist Sans` for all body/UI text.
- Mobile-first: max content width 480px. Thumb zone for action buttons.
- Decimal odds (e.g., `2.4x`), not percentages.\n- Pixel tokens replace initials everywhere — never show text initials where a token should be.\n- `image-rendering: pixelated` on all token canvases — no anti-aliasing.\n- Settlement has TWO artifacts: popup (all users see on settle via WebSocket) + trophy card (minted to winner's profile). Different components.

In QA mode, flag any code that doesn't match DESIGN.md.
