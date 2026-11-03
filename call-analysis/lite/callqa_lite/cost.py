"""Cost of a job from the token usage per tier the worker stores (crm_ca_jobs.usage.tiers).

PRICES are the USD prices per million tokens given for claude-haiku-5-5 on 2026-11-03 (task of the lite engine);
they are configuration, to check against the provider's price list before relying on the figure.
"""
from __future__ import annotations

PRICES = {"input_tokens": 0.10, "output_tokens": 0.50, "cache_read_input_tokens": 0.01,
          "cache_creation_input_tokens": 0.125}


def estimate(usage_tiers: dict, prices: dict = PRICES) -> float:
    """USD for all tiers (the lite engine only uses the fast tier)."""
    total = 0.0
    for u in (usage_tiers or {}).values():
        for k, p in prices.items():
            total += (u.get(k) or 0) * p / 1e6
    return round(total, 6)
