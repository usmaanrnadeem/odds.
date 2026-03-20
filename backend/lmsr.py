"""
Pure LMSR math — no DB, no side effects.
All functions are stateless and safe to call from anywhere.
"""
import math


def current_price(b: float, yes_qty: float, no_qty: float) -> float:
    """Probability that YES wins (0–1)."""
    x, y = yes_qty / b, no_qty / b
    m = max(x, y)
    exp_yes = math.exp(x - m)
    exp_no = math.exp(y - m)
    return exp_yes / (exp_yes + exp_no)


def cost_buy(b: float, yes_qty: float, no_qty: float, purchase_qty: float, side: bool) -> float:
    """
    Cost to buy `purchase_qty` shares on `side` (True=YES, False=NO).
    Returns a positive number — the points deducted from the buyer.
    """
    x, y = yes_qty / b, no_qty / b
    m = max(x, y)
    exp_yes = math.exp(x - m)
    exp_no = math.exp(y - m)

    if side:  # YES
        new_x = (yes_qty + purchase_qty) / b
        new_m = max(new_x, y)
        new_exp_yes = math.exp(new_x - new_m)
        new_exp_no = math.exp(y - new_m)
    else:     # NO
        new_y = (no_qty + purchase_qty) / b
        new_m = max(x, new_y)
        new_exp_yes = math.exp(x - new_m)
        new_exp_no = math.exp(new_y - new_m)

    return b * (
        (new_m + math.log(new_exp_yes + new_exp_no))
        - (m + math.log(exp_yes + exp_no))
    )


def cost_sell(b: float, yes_qty: float, no_qty: float, sale_qty: float, side: bool) -> float:
    """
    Payout for selling `sale_qty` shares on `side`.
    Returns a positive number — the points credited to the seller.
    """
    x, y = yes_qty / b, no_qty / b
    m = max(x, y)
    exp_yes = math.exp(x - m)
    exp_no = math.exp(y - m)

    if side:  # YES
        new_x = (yes_qty - sale_qty) / b
        new_m = max(new_x, y)
        new_exp_yes = math.exp(new_x - new_m)
        new_exp_no = math.exp(y - new_m)
    else:     # NO
        new_y = (no_qty - sale_qty) / b
        new_m = max(x, new_y)
        new_exp_yes = math.exp(x - new_m)
        new_exp_no = math.exp(new_y - new_m)

    # C_before - C_after → positive payout
    return b * (
        (m + math.log(exp_yes + exp_no))
        - (new_m + math.log(new_exp_yes + new_exp_no))
    )


def decimal_odds(prob: float) -> float:
    """Convert probability to decimal odds (e.g. 0.4 → 2.5x)."""
    if prob <= 0:
        return 999.0
    return round(1 / prob, 2)
