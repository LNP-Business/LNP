"""Analyse d'appel LNP, moteur allégé (2026-11-03) : cinq étapes du modèle sur la transcription entière, le code décide.

S0 carte des phases, S1 questions de découverte (lettre SPIN, registre, atomes des réponses), S2 écart restitué,
S3 présentation de l'offre, S4 objections après le premier prix (chacune une seule fois, avec A · I · E · M) et prévention.
Chaque citation est vérifiée par le code ; chaque niveau d'item, chaque verdict et chaque note sont calculés par les
fonctions de décision du moteur de référence (analyse-appel/moteur). Voir README.md.
Bibliothèque standard seulement ; le moteur de référence est importé depuis ../moteur.
"""
from __future__ import annotations

import sys
from pathlib import Path

VERSION_ALLEGEE = "callqa-lite-1.0"

_MOTEUR = Path(__file__).resolve().parents[2] / "moteur"
if str(_MOTEUR) not in sys.path:
    sys.path.insert(0, str(_MOTEUR))
