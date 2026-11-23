"""Cost of a job in USD from the token usage per tier the worker stores (crm_ca_jobs.usage.tiers).

PRICES are configuration, never a business fact of the engine: the USD prices per million tokens of the provider's price
list as given on 2026-11-03 (claude-api reference, models and prompt caching pages), to check against the provider's
price list before relying on a figure (docs/OPEN_DECISIONS.md, section H). Cache reads are 0.1 × the input price on
claude-haiku-5-5 and 0.05 × on claude-sonnet-5-5; a 5-minute cache write is 1.25 × the input price. The price of
claude-haiku-5-5 doubles above 100 000 prompt tokens: the steps of the lite engine send about 30 000, the table holds
the price under that threshold.

A usage names its tiers (fast, strong, arbiter), not its models: the model of each tier comes from `crm_ca_config.tiers`
(the worker and the live measure pass it); without it, DEFAULT_TIERS holds the models decided on 2026-11-20
(docs/OPEN_DECISIONS.md, F: fast and strong claude-haiku-5-5, arbiter claude-sonnet-5-5).
"""
from __future__ import annotations

from typing import Optional

PRICES: dict[str, dict[str, float]] = {
    "claude-haiku-5-5": {"input_tokens": 0.10, "output_tokens": 0.50, "cache_read_input_tokens": 0.01,
                         "cache_creation_input_tokens": 0.125},
    "claude-sonnet-5-5": {"input_tokens": 2.0, "output_tokens": 10.0, "cache_read_input_tokens": 0.10,
                          "cache_creation_input_tokens": 2.50},
}
DEFAULT_TIERS = {"fast": "claude-haiku-5-5", "strong": "claude-haiku-5-5", "arbiter": "claude-sonnet-5-5"}
FAMILIES = ("haiku", "sonnet")                      # a model id with a date or a suffix is priced by its family


def price_of(model: Optional[str]) -> Optional[dict[str, float]]:
    """The price row of a model id (exact, else by family: « claude-haiku-5-5-20261001 » is a Haiku); None if unknown."""
    if not model:
        return None
    if model in PRICES:
        return PRICES[model]
    fam = next((f for f in FAMILIES if f in model), None)
    return next((p for k, p in PRICES.items() if fam and fam in k), None)


def breakdown(usage_tiers: dict, tiers: Optional[dict] = None, prices: dict = PRICES) -> dict:
    """USD per tier and in all. A tier whose model has no price row is counted at the price of its default model and
    listed in `unknown_models`: the figure is then a floor, flagged, never silent."""
    models = {**DEFAULT_TIERS, **{k: v for k, v in (tiers or {}).items() if v}}
    per_tier, unknown, total = {}, [], 0.0
    for tier, u in (usage_tiers or {}).items():
        model = models.get(tier) or DEFAULT_TIERS.get(tier)
        row = price_of(model) if prices is PRICES else prices
        if row is None:
            unknown.append(model or tier)
            row = price_of(DEFAULT_TIERS.get(tier, "fast")) or PRICES["claude-haiku-5-5"]
        usd = sum((u.get(k) or 0) * p / 1e6 for k, p in row.items())
        per_tier[tier] = round(usd, 6)
        total += usd
    return {"usd": round(total, 6), "per_tier": per_tier, "models": {t: models.get(t) for t in per_tier},
            "unknown_models": unknown}


def estimate(usage_tiers: dict, tiers: Optional[dict] = None, prices: dict = PRICES) -> float:
    """USD for all tiers of one job (the worker's `crm_ca_jobs.usage.tiers`, or the measure's `qa_usage`)."""
    return breakdown(usage_tiers, tiers, prices)["usd"]
