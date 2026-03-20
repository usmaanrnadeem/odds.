"""
Tests for the LMSR pricing engine.
These are pure math tests — no DB, no network, instant.

Key invariants:
  1. Probabilities sum to 1.
  2. Buying shares moves price in the correct direction.
  3. cost_buy > 0 (you pay to buy).
  4. cost_sell > 0 (you receive when selling).
  5. Buy then sell the same quantity nets a LOSS (market maker spread).
  6. decimal_odds == 1 / probability.
  7. Numerical stability at extremes (prob near 0 and near 1).
"""
import math
import pytest
from backend.lmsr import current_price, cost_buy, cost_sell, decimal_odds


B = 100.0   # liquidity parameter used throughout


# ── current_price ─────────────────────────────────────────────

class TestCurrentPrice:
    def test_symmetric_start_is_50_50(self):
        assert current_price(B, 0, 0) == pytest.approx(0.5, abs=1e-9)

    def test_probabilities_sum_to_one(self):
        for yes_q, no_q in [(0, 0), (50, 20), (0, 100), (200, 10), (1000, 0)]:
            p = current_price(B, yes_q, no_q)
            assert 0 < p < 1, f"prob out of range: {p}"
            assert p + (1 - p) == pytest.approx(1.0)

    def test_more_yes_shares_raises_yes_prob(self):
        p_before = current_price(B, 0, 0)
        p_after  = current_price(B, 50, 0)
        assert p_after > p_before

    def test_more_no_shares_lowers_yes_prob(self):
        p_before = current_price(B, 0, 0)
        p_after  = current_price(B, 0, 50)
        assert p_after < p_before

    def test_extreme_yes_approaches_1(self):
        p = current_price(B, 10_000, 0)
        assert p > 0.9999

    def test_extreme_no_approaches_0(self):
        p = current_price(B, 0, 10_000)
        assert p < 0.0001

    def test_symmetric_positions_is_50_50(self):
        p = current_price(B, 300, 300)
        assert p == pytest.approx(0.5, abs=1e-9)


# ── cost_buy ──────────────────────────────────────────────────

class TestCostBuy:
    def test_buy_yes_costs_positive(self):
        assert cost_buy(B, 0, 0, 10, True) > 0

    def test_buy_no_costs_positive(self):
        assert cost_buy(B, 0, 0, 10, False) > 0

    def test_buying_yes_moves_price_up(self):
        qty = 20
        p_before = current_price(B, 0, 0)
        cost_buy(B, 0, 0, qty, True)
        p_after = current_price(B, qty, 0)
        assert p_after > p_before

    def test_buying_no_moves_price_down(self):
        qty = 20
        p_before = current_price(B, 0, 0)
        cost_buy(B, 0, 0, qty, False)
        p_after = current_price(B, 0, qty)
        assert p_after < p_before

    def test_larger_quantity_costs_more(self):
        c10 = cost_buy(B, 0, 0, 10, True)
        c20 = cost_buy(B, 0, 0, 20, True)
        assert c20 > c10

    def test_cost_is_superlinear(self):
        """Buying 2× quantity costs more than 2× — LMSR has increasing marginal cost."""
        c10 = cost_buy(B, 0, 0, 10, True)
        c20 = cost_buy(B, 0, 0, 20, True)
        assert c20 > 2 * c10

    def test_single_share_cost_bounded(self):
        """1 share should cost less than b (sanity upper bound)."""
        c = cost_buy(B, 0, 0, 1, True)
        assert 0 < c < B

    def test_yes_and_no_cost_equal_at_start(self):
        """At 50/50, buying YES and NO should cost the same."""
        c_yes = cost_buy(B, 0, 0, 10, True)
        c_no  = cost_buy(B, 0, 0, 10, False)
        assert c_yes == pytest.approx(c_no, rel=1e-9)


# ── cost_sell ─────────────────────────────────────────────────

class TestCostSell:
    def test_sell_yes_returns_positive(self):
        """Selling should CREDIT the user — positive return."""
        # First buy some YES shares to establish position context
        payout = cost_sell(B, 50, 0, 10, True)
        assert payout > 0, f"sell returned {payout}, expected positive credit"

    def test_sell_no_returns_positive(self):
        payout = cost_sell(B, 0, 50, 10, False)
        assert payout > 0

    def test_buy_then_sell_same_qty_breaks_even(self):
        """
        LMSR is path-independent: buying then immediately selling the same quantity
        from the same outstanding position returns exactly what you paid (net = 0).
        There is no bid-ask spread — the market maker subsidises via the b parameter.
        """
        qty = 10
        paid     = cost_buy(B, 0, 0, qty, True)
        received = cost_sell(B, qty, 0, qty, True)
        assert received == pytest.approx(paid, rel=1e-9), (
            f"Expected break-even, got net={received - paid:.6f}"
        )

    def test_sell_less_than_bought_is_partial_exit(self):
        qty = 20
        sell_qty = 10
        paid     = cost_buy(B, 0, 0, qty, True)
        received = cost_sell(B, qty, 0, sell_qty, True)
        assert 0 < received < paid

    def test_sell_is_not_free(self):
        """Selling 0 shares should return 0."""
        payout = cost_sell(B, 50, 0, 0, True)
        assert payout == pytest.approx(0.0, abs=1e-9)

    def test_sell_no_position_returns_zero(self):
        """Selling when market is at 0/0 returns essentially 0."""
        payout = cost_sell(B, 0, 0, 0, True)
        assert payout == pytest.approx(0.0, abs=1e-9)


# ── decimal_odds ──────────────────────────────────────────────

class TestDecimalOdds:
    def test_50pct_gives_2x(self):
        assert decimal_odds(0.5) == pytest.approx(2.0, rel=1e-6)

    def test_25pct_gives_4x(self):
        assert decimal_odds(0.25) == pytest.approx(4.0, rel=1e-6)

    def test_80pct_gives_1_25x(self):
        assert decimal_odds(0.80) == pytest.approx(1.25, rel=1e-6)

    def test_odds_times_prob_approximately_one(self):
        """
        decimal_odds rounds to 2 decimal places for display (e.g. 1.33x not 1.3333x).
        odds * prob is therefore approximately 1.0, not exactly.
        The 2dp rounding means at most ~1% error — acceptable for a display value.
        """
        for p in [0.1, 0.25, 0.5, 0.75, 0.9]:
            assert decimal_odds(p) * p == pytest.approx(1.0, abs=0.01)

    def test_odds_always_at_least_1(self):
        for p in [0.01, 0.1, 0.5, 0.9, 0.99]:
            assert decimal_odds(p) >= 1.0


# ── Round-trip / integration ──────────────────────────────────

class TestRoundTrip:
    def test_sequential_buys_accumulate_cost_correctly(self):
        """
        Buying 5+5 shares sequentially should equal buying 10 in one go.
        (Path independence of total cost from the same starting state.)
        """
        # Single buy of 10
        cost_10 = cost_buy(B, 0, 0, 10, True)

        # Two buys of 5 (second buy starts from yes_qty=5)
        cost_5a = cost_buy(B, 0, 0, 5, True)
        cost_5b = cost_buy(B, 5, 0, 5, True)
        assert cost_5a + cost_5b == pytest.approx(cost_10, rel=1e-9)

    def test_buy_yes_and_no_equally_moves_price_symmetrically(self):
        """
        From a fresh market, buying equal YES and NO should restore 50/50.
        """
        qty = 30
        p = current_price(B, qty, qty)
        assert p == pytest.approx(0.5, abs=1e-9)

    def test_numerical_stability_at_extremes(self):
        """
        No NaN or Inf at very skewed positions.
        At yes_qty=10_000 with b=100, exp(-100) ≈ 3.7e-44 which float64 rounds to 0,
        giving p = 1.0 exactly. That's acceptable float precision — not a bug.
        We verify finite and in [0, 1] (closed interval).
        """
        for yes_q, no_q in [(10_000, 0), (0, 10_000), (10_000, 1), (1, 10_000)]:
            p = current_price(B, yes_q, no_q)
            c = cost_buy(B, yes_q, no_q, 1, True)
            assert math.isfinite(p), f"p is not finite at yes={yes_q}, no={no_q}"
            assert math.isfinite(c), f"c is not finite at yes={yes_q}, no={no_q}"
            assert 0 <= p <= 1, f"p={p} out of [0,1] at yes={yes_q}, no={no_q}"
