"""Pose les questions du moteur au modèle par lots parallèles, sans toucher au moteur (analyse-appel/PLAN.md §2).

Le moteur pose ses questions fermées l'une après l'autre (un appel d'une heure : environ 2 000 questions avec les trois
passes), ce qui a pris plus de 5 heures sur le premier vrai appel. Ses boucles sont indépendantes à l'intérieur d'une étape,
mais l'étape suivante dépend des réponses de la précédente. L'exécutant rejoue donc toute la chaîne d'analyse (du code pur,
une seconde environ) par tours :

1. chaque réponse déjà reçue vient d'un cache, indexé par (tâche, unité, passe, palier, empreinte de la consigne) : une
   consigne rejouée (après une citation rejetée) ou une consigne d'arbitrage est une autre clé, donc rien ne reçoit jamais
   deux réponses par erreur ;
2. une question encore sans réponse lève EnAttente dans le client du modèle. Le moteur la traite comme une erreur du modèle
   (l'unité passe à to_review, pour ce tour seulement) et continue : le tour liste ainsi les questions qui lui manquent ;
3. l'exécutant envoie, en parallèle, les questions de la première tâche encore en attente (la plus ancienne ne peut dépendre
   d'aucune réponse manquante), et seulement les arbitrages dont les trois passes sont toutes connues, puis lance le tour
   suivant.

Quand un tour ne trouve aucune réponse manquante, son résultat est exactement celui d'une exécution séquentielle avec les
mêmes réponses : le code décide sur les mêmes entrées, dans le même ordre. Les erreurs du fournisseur sont gardées en cache
comme des erreurs, comme dans une exécution séquentielle.
"""
from __future__ import annotations

import hashlib
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Optional

from lnp_analyse.noyau.modeles import ContexteAppel


class EnAttente(Exception):
    """Une question dont la réponse n'a pas encore été demandée (pour ce tour seulement)."""


class TropLong(Exception):
    """L'analyse a dépassé son budget de temps : arrêtée pour de bon (pas relancée), pour qu'un appel bloqué ne dépense
    jamais deux fois du crédit."""


def _cle(id_tache: str, id_unite: str, palier: str, systeme: str, consigne: str, no_passe: int) -> tuple:
    return (id_tache, id_unite, int(no_passe), palier, hashlib.sha256((systeme + "\n" + consigne).encode()).hexdigest())


class ClientAnticipe:
    """Client du modèle pour le moteur : répond depuis le cache, note ce qui manque."""

    def __init__(self, interne: Any):
        self.interne = interne
        self.cache: dict[tuple, tuple[bool, Any]] = {}   # clé -> (ok, réponse ou exception)
        self.manquant: list[tuple[tuple, tuple]] = []     # (clé, arguments de demander) dans l'ordre où le moteur a demandé
        self.demande: set[tuple] = set()

    def demander(self, id_tache, id_unite, palier, systeme, consigne, no_passe):
        k = _cle(id_tache, id_unite, palier, systeme, consigne, no_passe)
        if k in self.cache:
            ok, v = self.cache[k]
            if ok:
                return v
            raise v
        if k not in self.demande:
            self.demande.add(k)
            self.manquant.append((k, (id_tache, id_unite, palier, systeme, consigne, no_passe)))
        raise EnAttente(f"{id_tache}:{id_unite}:{no_passe}")

    def lot_suivant(self) -> list[tuple[tuple, tuple]]:
        """Les questions de la première tâche en attente ; les arbitrages (passe 0) seulement une fois leurs passes connues."""
        if not self.manquant:
            return []
        premier = self.manquant[0][1][0]
        unites_en_attente = {(k[0], k[1]) for k, a in self.manquant if k[2] >= 1}
        return [(k, a) for k, a in self.manquant
                if a[0] == premier and (k[2] >= 1 or (k[0], k[1]) not in unites_en_attente)] or [self.manquant[0]]

    def recuperer(self, lot: list[tuple[tuple, tuple]], executants: int = 16) -> None:
        """La passe 1 (et les arbitrages) d'abord, puis les passes 2 et 3 : elles envoient la même consigne que la passe 1, que le
        fournisseur a alors en cache (coût, docs/ARCHITECTURE.md §7). Mêmes questions, mêmes réponses gardées : seul l'ordre
        d'envoi change."""
        premier = [it for it in lot if it[0][2] <= 1]
        self._recuperer(premier, executants)
        self._recuperer([it for it in lot if it[0][2] > 1], executants)

    def _recuperer(self, lot: list[tuple[tuple, tuple]], executants: int) -> None:
        if not lot:
            return

        def un(item):
            k, a = item
            try:
                return k, (True, self.interne.demander(*a))
            except Exception as e:  # noqa: BLE001 - gardée comme l'exécution séquentielle la verrait
                return k, (False, e)
        with ThreadPoolExecutor(max_workers=executants) as reserve:
            fait = list(reserve.map(un, lot))
        for k, v in fait:
            # une erreur qui toucherait toutes les questions (mauvaise clé, paramètre refusé) arrête le travail : aucun
            # enregistrement vide n'est stocké
            if not v[0] and getattr(v[1], "final", False):
                raise v[1]
            self.cache[k] = v

    def tour_lot_debut(self) -> None:
        self.manquant, self.demande = [], set()


def analyser_par_tours(construire: Callable[[], ContexteAppel], executer: Callable[[ContexteAppel, ClientAnticipe], None],
                      client: ClientAnticipe, executants: int = 16, tours_max: int = 400,
                      journal: Optional[Callable[[str], None]] = None, budget_s: Optional[float] = None) -> ContexteAppel:
    """construire() fait un ContexteAppel neuf, executer(ctx, client) y lance la chaîne d'analyse ; répété jusqu'à ce que rien
    ne manque."""
    t0 = time.time()
    for n in range(1, tours_max + 1):
        if budget_s is not None and time.time() - t0 > budget_s:
            raise TropLong(f"arrêtée après {round((time.time() - t0) / 60)} min et {n - 1} tours "
                          f"({len(client.cache)} réponses) : plus long que le budget de temps")
        client.tour_lot_debut()
        ctx = construire()
        executer(ctx, client)
        if not client.manquant:
            # le dernier tour n'a lu que des réponses en cache : ce ctx neuf ne garde aucune trace EnAttente des tours
            # précédents
            if journal:
                journal(f"tour {n} : terminé ({len(client.cache)} réponses)")
            return ctx
        lot = client.lot_suivant()
        if journal:
            journal(f"tour {n} : {lot[0][1][0]} × {len(lot)} (manquantes {len(client.manquant)}, en cache {len(client.cache)})")
        client.recuperer(lot, executants)
    raise RuntimeError(f"l'analyse ne s'est pas stabilisée après {tours_max} tours")
