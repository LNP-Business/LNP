"""Coût d'une analyse à partir des jetons consommés par palier, que l'exécutant enregistre (crm_ca_jobs.usage.tiers).

PRIX donne les prix en USD par million de jetons indiqués pour claude-haiku-5-5 le 2026-11-03 (tâche du moteur allégé) ;
c'est de la configuration, à vérifier sur la grille de prix du fournisseur avant de se fier au chiffre.
"""
from __future__ import annotations

PRIX = {"input_tokens": 0.10, "output_tokens": 0.50, "cache_read_input_tokens": 0.01,
          "cache_creation_input_tokens": 0.125}


def estimer(conso_paliers: dict, prix_: dict = PRIX) -> float:
    """USD pour tous les paliers (le moteur allégé n'utilise que le palier rapide)."""
    total = 0.0
    for u in (conso_paliers or {}).values():
        for k, p in prix_.items():
            total += (u.get(k) or 0) * p / 1e6
    return round(total, 6)
