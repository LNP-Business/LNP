"""Tests of the SPIN discovery module (SPIN-1.1).

Part 1: pure decision tests on synthetic inputs (letters, atoms, follow-up, chains, items, applicability).
Part 2: full module runs with MockClient on synthetic calls.
Part 3: Annex B calibration cases on real transcripts (tests/fixtures/transcripts/NNN/transcript_compact.txt).
"""
from __future__ import annotations
import os

import re
from pathlib import Path

import pytest

from lnp_analyse.competences import spin as S
from lnp_analyse.noyau.client_modele import ClientSimule
from lnp_analyse.noyau.modeles import PROSPECT, COMMERCIAL, Atome, ContexteAppel, Preuve, Tour
from lnp_analyse.noyau.executeur import Executeur

EXECUTIONS = Path(os.environ.get("CALLQA_CORPUS", str(Path(__file__).parent / "fixtures" / "transcripts")))
LIGNE = re.compile(r"^\[(T\d+[a-z]?) ([\d:]+)\] (SALES|PROSPECT|OTHER): ?(.*)$")


# =============================================================================================== helpers
def porte(texte: str, lettre: str, raison: str | None = None, citation: str | None = None, **surcharge) -> dict:
    """A gate answer that makes the code decide `letter` (quotes are the first words of the solicitation)."""
    q = citation or " ".join(texte.split()[:3])
    g = {"is_solicitation": True, "attribution_doubtful": False, "routing": None,
         "g1": {"reason": None, "quote": None},
         "g2": {"neutral_fact": False, "exclusion": None, "quote": None},
         "g3": {"state_or_value": False, "antecedent": "none", "content_supplied": False, "load_named": False,
                "about_offer": False, "action_plan": False, "quote": None},
         "g4": {"consequence": False, "problem_domain": None, "named_domain": None, "same_domain": False,
                "antecedent_solution": False, "quote": None},
         "g5": {"difficulty": False, "sales_named": False, "anchored": False, "quote": None},
         "objection_clarification": False, "tags": [], "split": None, "sub": None}
    if lettre == "OUT":
        g["g1"] = {"reason": raison or "nothing", "quote": q}
    elif lettre == "S":
        g["g2"].update(neutral_fact=True, quote=q)
    elif lettre == "N":
        g["g3"].update(state_or_value=True, antecedent="resolution", quote=q)
    elif lettre == "I":
        g["g4"].update(consequence=True, problem_domain="clients", named_domain="money", quote=q)
    elif lettre == "P":
        g["g5"].update(difficulty=True, quote=q)
    for k, v in surcharge.items():
        if isinstance(v, dict):
            g[k].update(v)
        else:
            g[k] = v
    return g


def atome(type_, tour, citation, **kw) -> dict:
    d = {"type": type_, "turn": tour, "quote": citation, "quantified": False, "domain": None, "problem_domain": None,
         "prompted_by_sales": False, "object": kw.pop("object", "the problem"), "dimension": None}
    d.update(kw)
    return d


def _consigne_sollicitation(consigne: str) -> str:
    m = re.search(r"^SOLICITATION: (.*)$", consigne, re.M)
    return m.group(1) if m else "x"


def repli(id_tache, id_unite, consigne, no_passe):
    """Default model readings: OUT `nothing`, no atom, no link, no reopening end."""
    if id_tache == "spin.gates":
        return porte(_consigne_sollicitation(consigne), "OUT", "nothing")
    if id_tache == "spin.atoms":
        return {"atoms": []}
    if id_tache == "spin.link":
        return {"same_object": False, "quote": None}
    if id_tache == "spin.reopen_end":
        return {"end_turn": None, "quote": None}
    if id_tache == "spin.register":
        # SB-35: an answered question is read in its answer (Other, quoting its first words), else nothing named
        m = re.search(r"PROSPECT'S ANSWER TO IT:\n\[(\S+) [^\]]*\] \w+: (\S+(?: \S+){0,3})", consigne)
        if m:
            return {"asked_domain": "other", "basis": "answer", "quote": m.group(2), "reference_turn": m.group(1)}
        return {"asked_domain": "none", "basis": "none", "quote": None, "reference_turn": None}
    raise KeyError(id_tache)


def executer_spin(ctx: ContexteAppel, reponses: dict):
    """Gate answers may be given as a letter spec ("P", ("OUT", "agreement"), (letter, reason, overrides)) keyed by
    solicitation id; they are converted with the unit text found by the inventory."""
    textes = {u.sol.id: u.sol.texte for u in S.inventaire(ctx)}
    simule = {}
    for (tache, uid), a in reponses.items():
        if tache == "spin.gates" and isinstance(a, (str, tuple)):
            spec = (a,) if isinstance(a, str) else a
            sid = uid.split(":", 1)[1]
            surcharge = spec[2] if len(spec) > 2 else {}
            a = porte(textes[sid], spec[0], spec[1] if len(spec) > 1 else None, **surcharge)
        simule[(tache, uid)] = a
    client = ClientSimule(simule, repli=repli)
    res = S.CompetenceSpin().executer(ctx, Executeur(client))
    return res, client


def mk(lignes: list[tuple[str, str]], **phases) -> ContexteAppel:
    tours = [Tour(f"T{i:03d}", i, f"00:{i:02d}", r, {"S": COMMERCIAL, "P": PROSPECT}[r], t)
             for i, (r, t) in enumerate(lignes, 1)]
    ctx = ContexteAppel("c", "v", "2026-10-01T10:00:00Z", "UTC", tours)
    for k, v in phases.items():
        setattr(ctx.phases, k, v)
    return ctx


def charger_reel(appel_: str, **phases) -> ContexteAppel:
    tours = []
    for ligne in (EXECUTIONS / appel_ / "transcript_compact.txt").read_text(encoding="utf-8").splitlines():
        m = LIGNE.match(ligne)
        if m:
            tours.append(Tour(m[1], int(re.sub(r"\D", "", m[1])), m[2], m[3], m[3], m[4]))
    ctx = ContexteAppel(appel_, "valentino", "2026-10-01T10:00:00Z", "UTC", tours)
    for k, v in phases.items():
        setattr(ctx.phases, k, v)
    return ctx


def sol(res_ou_ctx, sid):
    return next(s for s in res_ou_ctx.sollicitations if s.id == sid)


def niv(res, iid):
    return next(i.niveau for i in res.items if i.id == iid)


def A(type_, tour, citation, sid="Q1", **kw) -> Atome:
    return Atome(kw.pop("id", f"A{tour}{type_}{len(citation)}"), type_, Preuve(citation, tour, PROSPECT), sid, None, **kw)


# =============================================================================================== 1. letters (§3)
class TestLettres:
    T = "How much is that costing you every month?"

    def d(self, g, **attrs):
        return S.decider_lettre(g, {"validation_tail": False, "system": False, **attrs}, self.T)

    def test_le_premier_oui_gagne_dans_l_ordre_fixe(self):
        g = porte(self.T, "S")
        g["g4"].update(consequence=True, quote="costing you")
        assert self.d(g).lettre == "S"                       # gate 2 before gate 4

    def test_queue_de_validation_est_un_accord(self):              # hard rule, SEG-4
        g = porte(self.T, "S")
        assert (self.d(g, validation_tail=True).lettre, self.d(g, validation_tail=True).raison) == ("OUT", "agreement")

    def test_besoin_ferme(self):                        # hard rule: desired state inside the question
        g = porte(self.T, "N", g3={"content_supplied": True})
        d = self.d(g)
        assert (d.lettre, d.raison, "closed_need_payoff" in d.etiquettes) == ("OUT", "agreement", True)

    def test_valeur_sur_l_offre_est_info_offre(self):
        d = self.d(porte(self.T, "N", g3={"about_offer": True}))
        assert (d.lettre, d.raison) == ("OUT", "offer_info")

    def test_charge_d_une_solution(self):
        d = self.d(porte(self.T, "N", g3={"load_named": True, "antecedent": "solution"}))
        assert (d.lettre, d.raison) == ("OUT", "solution_load")

    def test_priorite_raison_hors(self):
        d = self.d(porte(self.T, "OUT", "nothing"), validation_tail=True)
        assert d.raison == "nothing"                           # nothing > ... > agreement

    def test_s_exclusion_passe_a_la_suivante(self):
        g = porte(self.T, "I")
        g["g2"].update(neutral_fact=True, exclusion="consequence", quote="How much")
        assert self.d(g).lettre == "I"

    def test_n_avec_antecedent_probleme_n_est_pas_n(self):
        g = porte(self.T, "N", g3={"antecedent": "problem"})
        g["g4"].update(consequence=True, problem_domain="clients", named_domain="open", quote="costing you")
        assert self.d(g).lettre == "I"

    def test_i_meme_domaine_n_est_pas_i(self):
        g = porte(self.T, "I", g4={"same_domain": True})
        g["g5"].update(difficulty=True, quote="How much")
        assert self.d(g).lettre == "P"

    def test_p_nomme_par_le_commercial_sauf_ancre(self):
        g = porte(self.T, "P", g5={"sales_named": True})
        assert (self.d(g).lettre, self.d(g).raison) == ("OUT", "absent")
        g["g5"]["anchored"] = True
        assert self.d(g).lettre == "P"

    def test_citation_invalide_echoue_a_la_porte(self):
        d = self.d(porte(self.T, "S", citation="not in the text"))
        assert d.lettre == "OUT" and d.raison == "absent" and d.preuve_invalide

    def test_aiguillage_et_non_sollicitation(self):
        assert self.d(porte(self.T, "S", routing="DECISION_REQUEST")).lettre == "DECISION_REQUEST"
        assert self.d(porte(self.T, "S", is_solicitation=False)).lettre == "NOT_SOLICITATION"

    def test_la_coupe_garde_la_queue_sur_la_derniere_partie(self):        # SEG-2 + SEG-4
        t = "How much is it stuck at, and since when, right?"
        g = porte(t, "S", split=["How much is it stuck at", "and since when, right?"],
                 sub=[porte("How much is it stuck at", "S"), porte("and since when, right?", "S")])
        parties = S.decider_portes(g, {"validation_tail": True}, t)
        assert [p[1].lettre for p in parties] == ["S", "OUT"]

    def test_la_lettre_ne_donne_jamais_de_points(self):              # X8: same atoms, different letters -> same score
        atomes = [A("IMPACT", "T2", "I can't pay my rent", domaine="money")]
        a, _ = S.noter_items(atomes, [])
        atomes[0].lettre = "S"
        b, _ = S.noter_items(atomes, [])
        assert [i.niveau for i in a] == [i.niveau for i in b]


# =============================================================================================== 2. atoms (A3)
class TestAtomes:
    def d(self, **kw):
        base = atome(kw.pop("type", "IMPACT"), "T2", kw.pop("quote", "so I can't pay my rent"))
        base.update(kw)
        return S.decider_atome(base, apres_presentation=kw.pop("_after", False))

    def test_sb10_impact_meme_domaine_est_douleur(self):           # pair 1c
        assert self.d(domain="clients", problem_domain="clients").type == "PAIN"
        assert self.d(domain="money", problem_domain="clients").type == "IMPACT"    # pair 1b

    def test_sb11_revenu_actuel_est_situation(self):          # pair 2a, B2 case 5
        r = self.d(quote="to be around 4,000", figure_kind="present", quantified=True, domain="money",
                   problem_domain="clients")
        assert (r.type, r.quantifie) == ("SITUATION", True)

    def test_sb22_baisse_revenu_est_impact_chiffre(self):
        r = self.d(quote="I went from 175K to 58K", figure_kind="present", income_drop_attributed=True,
                   domain="money", problem_domain="self_belief")
        assert (r.type, r.quantifie) == ("IMPACT", True)

    def test_sb12_desir_apres_presentation(self):                   # pair 5b
        base = atome("DESIRE", "T9", "I'd love to have that community")
        assert not S.decider_atome(base, apres_presentation=True).garder
        assert S.decider_atome(base, apres_presentation=False).garder

    def test_sb14_suggere_et_approbation(self):                # pairs 4a / X3
        assert not self.d(prompted_by_sales=True).garder
        assert self.d(quote="Yes, exactly.").type is None
        assert self.d(quote="Everything.").type is None        # SB-9 two-word minimum (B2 case 12)

    def test_sb23_discours_rapporte(self):
        assert self.d(reported_speech=True, owned=False).type is None
        assert self.d(reported_speech=True, owned=True, domain="money", problem_domain="clients").garder

    @pytest.mark.parametrize("q,att", [("two years", True), ("about 3K a month", True), ("15 hours a week", True),
                                       ("three clients", True), ("every month", False), ("a lot of wasted time", False),
                                       ("Forever.", False), ("all the time", False)])
    def test_sb24_chiffre(self, q, att):
        assert S.a_quantite(q) is att

    def test_chiffre_exige_modele_et_code(self):
        assert not self.d(quote="a lot of wasted time", quantified=True, domain="time",
                          problem_domain="self_belief").quantifie


# =============================================================================================== 3. follow-up (SB-17, SB-19)
class TestApprofondissement:
    def test_reprise_mots_contenu(self):
        assert S.approfondit("I don't have any clients at all", "And without clients, what happens?")

    def test_mots_courts_et_mots_vides_ne_comptent_pas(self):
        assert not S.approfondit("It's a big mess", "What is your goal?")

    def test_reprise_nombre(self):
        assert S.approfondit("I make about 3K", "And is 3K enough for the family?")

    @pytest.mark.parametrize("q", ["How so?", "Tell me more.", "What else?", "Meaning?", "A lot?"])
    def test_echo(self, q):
        assert S.approfondit("A lot.", q)

    def test_le_preambule_compte_pour_l_ancrage(self):            # SEG-5
        assert S.approfondit("my marketing is a mess", "What does that do?", preambule="So the marketing.")


# =============================================================================================== 4. chains (SB-16..SB-20)
def etape(sid, lettre, atomes=(), suit=True, raison=None, sans_reponse=False):
    return S.MaillonChaine(sid, lettre, raison, [A(t, f"T{sid}", q, sid, objet="clients") for t, q in atomes],
                       suit, sans_reponse)


MEME = lambda op, chaine, c: True          # noqa: E731


class TestChaines:
    P = etape("1", "P", [("PAIN", "I have no clients")])
    I1 = etape("2", "I", [("IMPACT", "I can't pay rent")])
    I2 = etape("3", "I", [("IMPACT", "my wife is worried")])
    N = etape("4", "N", [("VALUE", "I could breathe again")])

    def profond(self, etapes, meme=MEME):
        return [c for c in S.trouver_chaines(etapes, meme) if c.get("deep")]

    def test_p_i_i_est_profond(self):
        assert len(self.profond([self.P, self.I1, self.I2])) == 1

    def test_p_i_n_est_profond(self):
        assert len(self.profond([self.P, self.I1, self.N])) == 1

    def test_p_i_seul_n_est_pas_profond(self):
        assert self.profond([self.P, self.I1]) == []

    def test_hors_rien_est_transparent_accord_rompt(self):       # SB-20
        assert len(self.profond([self.P, self.I1, etape("x", "OUT", raison="nothing"), self.N])) == 1
        assert self.profond([self.P, self.I1, etape("x", "OUT", raison="agreement"), self.N]) == []
        assert self.profond([self.P, self.I1, etape("x", "OUT", raison="sales_list"), self.N]) == []

    def test_unite_empilee_sans_reponse_transparente(self):           # SB-6 unit gets no answer
        assert len(self.profond([self.P, etape("x", "OUT", raison="agreement", sans_reponse=True), self.I1, self.N])) == 1

    def test_s_sur_meme_objet_n_est_pas_un_lien_et_ne_rompt_pas(self):
        assert len(self.profond([self.P, etape("s", "S", [("SITUATION", "lost three clients")]), self.I1, self.N])) == 1

    def test_autre_objet_rompt(self):
        autre = lambda op, ch, c: c.id_sol != "s"      # noqa: E731
        chaines = S.trouver_chaines([self.P, self.I1, etape("s", "S"), self.N], autre)
        assert not any(c.get("deep") for c in chaines) and chaines[0]["broken_at"] == "s:other_object"

    def test_non_approfondi_rompt(self):                            # SB-17, B4 case 4
        assert self.profond([self.P, self.I1, etape("3", "I", [("IMPACT", "my wife is worried")], suit=False)]) == []

    def test_p_sans_douleur_n_ouvre_pas(self):
        assert self.profond([etape("1", "P", []), self.I1, self.I2]) == []

    def test_deux_chaines_sur_des_objets_differents(self):
        p2 = S.MaillonChaine("5", "P", None, [A("BLOCKER", "T5", "I fear selling", "5", objet="fear of selling")], True)
        i3 = S.MaillonChaine("6", "I", None, [A("IMPACT", "T6", "it costs me sleep", "6", objet="fear of selling")], True)
        n2 = S.MaillonChaine("7", "N", None, [A("DESIRE", "T7", "I want to sell calmly", "7", objet="x")], True)
        profond = S.objets_distincts(S.trouver_chaines([self.P, self.I1, self.N, p2, i3, n2], MEME))
        assert len(profond) == 2


# =============================================================================================== 5. items (§6)
class TestItems:
    def niveaux(self, atomes, chaines=(), meta=None):
        items, _ = S.noter_items(atomes, list(chaines), meta)
        return {i.id: i.niveau for i in items}

    def test_d1_lie_a_l_objectif(self):
        sit = [A("SITUATION", "T2", "about 3K a month", id="s1", quantifie=True),
               A("SITUATION", "T4", "15 hours a week", id="s2", quantifie=True)]
        des = [A("DESIRE", "T6", "I want 10K a month", id="d1", quantifie=True)]
        meta = {"s1": {"dimension": "revenue"}, "s2": {"dimension": "time"}, "d1": {"dimension": "revenue"}}
        assert self.niveaux(sit + des, meta=meta)["D1"] == 1      # only the revenue figure is related
        meta["s2"]["dimension"] = "revenue"
        assert self.niveaux(sit + des, meta=meta)["D1"] == 2
        assert self.niveaux(sit)["D1"] == 2                        # no DESIRE: any quantified SITUATION

    def test_d1_sans_desir_situation_non_chiffree_ne_compte_pas(self):
        assert self.niveaux([A("SITUATION", "T2", "I work at a firm")])["D1"] == 0

    def test_d2_deux_distincts_ou_cause(self):
        p = A("PAIN", "T2", "I don't have clients", id="p1")
        assert self.niveaux([p])["D2"] == 1
        assert self.niveaux([p, A("BLOCKER", "T3", "I fear selling")])["D2"] == 2
        assert self.niveaux([p, A("PAIN", "T2", "don't have clients")])["D2"] == 1      # overlapping quotes
        cause = {"p1": {"cause": Preuve("because I never post anything", "T2", PROSPECT)}}
        assert self.niveaux([p], meta=cause)["D2"] == 2

    def test_d3_domaines_distincts_et_un_chiffre(self):
        a = A("IMPACT", "T2", "it cost me three years", domaine="time", quantifie=True)
        b = A("IMPACT", "T3", "my kids barely see me", domaine="family")
        c = A("IMPACT", "T4", "I am exhausted every day", domaine="family")
        assert self.niveaux([a])["D3"] == 1
        assert self.niveaux([a, b])["D3"] == 2
        assert self.niveaux([b, c])["D3"] == 1                     # same domain, none quantified

    def test_d4(self):
        d = A("DESIRE", "T2", "I want 5K a month")
        v = A("VALUE", "T3", "so I can be home for the kids")
        assert (self.niveaux([d])["D4"], self.niveaux([d, v])["D4"], self.niveaux([v])["D4"]) == (1, 2, 0)

    def test_suggere_ne_compte_jamais_spontane_compte_d1_d4(self):
        d = A("DESIRE", "T2", "I want 5K a month", suggere_par_commercial=True)
        assert self.niveaux([d])["D4"] == 0
        v = A("DESIRE", "T2", "I want 5K a month", spontane=True)
        assert self.niveaux([v])["D4"] == 1

    def test_d5_et_regle_des_deux_citations(self):
        ev = [Preuve("I have no clients", "T2", PROSPECT), Preuve("I can't pay rent", "T3", PROSPECT)]
        un = {"deep": True, "opening": "Q2", "object": "clients", "evidence": ev}
        deux = {"deep": True, "opening": "Q9", "object": "fear", "evidence": ev}
        assert self.niveaux([], [un])["D5"] == 1
        assert self.niveaux([], [un, deux])["D5"] == 2
        assert self.niveaux([], [un, dict(un, opening="Q5")])["D5"] == 1     # same object

    def test_plafond_deux_citations(self):
        a = A("IMPACT", "T2", "it cost me three years", domaine="time", quantifie=True)
        b = A("IMPACT", "T2", "it cost me three years", domaine="family")
        assert self.niveaux([a, b])["D3"] == 1                     # one distinct quote only


# =============================================================================================== 6. spans, perimeter
def test_plages_reponse_relance_spontane_empile():
    ctx = mk([("S", "Hi. What is going on? And how long has it been?"),        # T1 stacked
              ("P", "My clients left two years ago."),                          # T2
              ("S", "Wow."),                                                    # T3 backchannel <= 5 words
              ("P", "Yeah, it hurts."),                                         # T4 still the answer (SB-5)
              ("S", "I really appreciate you sharing that with me, honestly."),  # T5 acknowledgement
              ("P", "And my wife is worried too."),                             # T6 volunteered (SB-8)
              ("S", "What else is going on?"),                                  # T7 next solicitation
              ("P", "Nothing else.")])
    unites = S.inventaire(ctx)
    for u in unites:
        u.fin_fenetre = None
    S.plages_reponse(ctx, unites, {u.tour.id for u in unites})
    q1, q2, q7 = unites
    assert q1.sans_reponse and not q2.sans_reponse                                  # SB-6: last stacked one
    assert q2.sol.tours_reponse == ["T002", "T004"] and q2.tours_spontanes == ["T006"]


def test_plages_reponse_exception_empilee():
    ctx = mk([("S", "How many clients do you have? And what is your dream?"), ("P", "Three clients, no more.")])
    unites = S.inventaire(ctx)
    S.plages_reponse(ctx, unites, {"T001"})
    assert unites[0].sol.tours_reponse == ["T002"] and unites[1].sans_reponse          # SB-6 explicit answer


SYN = [("S", "Can you hear me okay?"), ("P", "Yes I can."),                                         # T1-2 social
       ("S", "What made you book this call?"), ("P", "I have no clients and it is killing my income."),  # T3-4 P
       ("S", "And without clients, what does that do to your money?"),
       ("P", "I lost about 2K a month, I can't pay my rent."),                                           # T5-6 I
       ("S", "And with rent unpaid, how is your family taking it?"),
       ("P", "My wife is stressed and the kids feel it."),                                               # T7-8 I
       ("S", "How much do you make today?"), ("P", "About 3K a month right now."),                       # T9-10 S
       ("S", "Where do you want to be?"), ("P", "I want 10K a month, so I can be home for my kids."),    # T11-12 N
       ("S", "Let me show you the program now. It has three pillars."), ("P", "Okay."),                 # T13 pitch
       ("S", "How many hours a week could you put in?"), ("P", "Maybe 20 hours."),                      # T15 logistic
       ("S", "Do you have savings you could use for this?"), ("P", "A little.")]                        # T17 financing


def reponses_syn():
    return {("spin.gates", "gates:Q003.1"): "P", ("spin.gates", "gates:Q005.1"): "I",
            ("spin.gates", "gates:Q007.1"): ("I", None, {"g4": {"problem_domain": "money", "named_domain": "family"}}),
            ("spin.gates", "gates:Q009.1"): "S", ("spin.gates", "gates:Q011.1"): "N",
            ("spin.gates", "gates:Q017.1"): ("OUT", "solution_load"),
            ("spin.atoms", "atoms:Q003.1"): {"atoms": [atome("PAIN", "T004", "I have no clients", object="no clients")]},
            ("spin.atoms", "atoms:Q005.1"): {"atoms": [
                atome("IMPACT", "T006", "I lost about 2K a month", domain="money", problem_domain="clients",
                     quantified=True, figure_kind="loss"),
                atome("IMPACT", "T006", "I can't pay my rent", domain="money", problem_domain="clients")]},
            ("spin.atoms", "atoms:Q007.1"): {"atoms": [atome("IMPACT", "T008", "My wife is stressed", domain="family",
                                                            problem_domain="money")]},
            ("spin.atoms", "atoms:Q009.1"): {"atoms": [atome("SITUATION", "T010", "About 3K a month right now",
                                                            quantified=True, figure_kind="present",
                                                            dimension="revenue")]},
            ("spin.atoms", "atoms:Q011.1"): {"atoms": [
                atome("DESIRE", "T012", "I want 10K a month", quantified=True, dimension="revenue"),
                atome("VALUE", "T012", "so I can be home for my kids")]},
            ("spin.link", "link:Q003.1>Q005.1"): {"same_object": True, "quote": "without clients"},
            ("spin.link", "link:Q003.1>Q007.1"): {"same_object": True, "quote": "rent unpaid"},
            }


def test_execution_complete_appel_synthetique():
    ctx = mk(SYN, debut_presentation="T013")
    res, client = executer_spin(ctx, reponses_syn())
    assert (ctx.phases.debut_decouverte, ctx.phases.fin_decouverte) == ("T003", "T013")     # SB-1, SB-2
    assert res.statut == "scored"
    lv = {i.id: i.niveau for i in res.items}
    # D1: one related quantified SITUATION -> 1; D2: one PAIN -> 1; D3: money (quantified) + family -> 2;
    # D4: DESIRE + VALUE -> 2; D5: P -> I -> I on "clients", followed up -> 1 deep chain
    assert lv == {"D1": 1, "D2": 1, "D3": 2, "D4": 2, "D5": 1}
    assert res.note == round(100 * (15 * .5 + 20 * .5 + 30 + 20 + 15 * .5) / 100)
    # shared state
    assert sol(ctx, "Q001.1").lettre is None and "pre_perimeter" in sol(ctx, "Q001.1").etiquettes
    assert sol(ctx, "Q005.1").lettre == "I" and sol(ctx, "Q005.1").tours_reponse == ["T006"]
    assert sol(ctx, "Q003.1").approfondi
    assert {a.type for a in ctx.atomes} == {"PAIN", "IMPACT", "SITUATION", "DESIRE", "VALUE"}
    assert all(a.lettre and a.id_sollicitation and a.preuve.role == PROSPECT for a in ctx.atomes)
    # SB-25 financing and logistics after the end: never a reopening
    assert res.details["perimeter"]["reopenings"] == []
    assert not sol(ctx, "Q017.1").approfondi and "post_discovery" in sol(ctx, "Q017.1").etiquettes
    d = res.details["diagnostics"]
    assert d["letters"] == {"S": 1, "P": 1, "I": 2, "N": 1} and d["p_followed_by_i"] == 1.0
    assert res.details["items_evidence"]["D3"]["evidence"][0]["question_id"] == "Q005.1"
    assert [c for c in res.details["chains"] if c["deep"]][0]["links"] == ["Q003.1", "Q005.1", "Q007.1"]


def test_applicabilite_et_sante():
    ctx = mk(SYN[:8] + [("S", "Let me show you the program now."), ("P", "Okay.")], debut_presentation="T009")
    rep = {k: v for k, v in reponses_syn().items() if k[1].split(":")[1].split(">")[0] < "Q009"}
    res, _ = executer_spin(ctx, rep)                                          # 3 coded solicitations < 5 (§5)
    assert res.statut == "not_applicable" and res.items == [] and res.note is None
    assert res.raisons == ["fewer_than_5_coded_solicitations"]
    ctx = mk(SYN, debut_presentation="T013")
    rep = reponses_syn()
    rep[("spin.gates", "gates:Q009.1")] = porte("How much do you make today?", "P", g5={"sales_named": True})
    res, _ = executer_spin(ctx, rep)                                          # 1 absent out of 5 coded = 20 % > 5 %
    assert res.statut == "excluded" and res.raisons == ["health_absent_share"]
    res, _ = executer_spin(mk(SYN[:2], debut_presentation=None), {})
    assert res.statut == "not_applicable" and res.raisons == ["no_discovery"]


def test_unite_a_revoir_exclue():
    ctx = mk(SYN, debut_presentation="T013")
    rep = reponses_syn()
    rep[("spin.gates", "gates:Q009.1")] = porte("How much do you make today?", "S", citation="not a quote")
    res, _ = executer_spin(ctx, rep)
    assert sol(ctx, "Q009.1").statut == "to_review" and "units_to_review" in res.signaux


def test_trois_passes_en_desaccord_vont_a_l_arbitre():
    ctx = mk(SYN, debut_presentation="T013")
    rep = reponses_syn()
    t = "How much do you make today?"
    rep[("spin.gates", "gates:Q009.1")] = [porte(t, "S"), porte(t, "S"), porte(t, "P"),
                                            dict(porte(t, "S"), justification="counts revenue",
                                                 case_label="application_error")]
    executer_spin(ctx, rep)
    assert sol(ctx, "Q009.1").statut == "arbitrated" and sol(ctx, "Q009.1").lettre == "S"


def test_sb21_plan_d_action_sans_etat_futur():
    ctx = mk(SYN, debut_presentation="T013")
    rep = reponses_syn()
    rep[("spin.gates", "gates:Q011.1")] = ("N", None, {"g3": {"action_plan": True}})
    rep[("spin.atoms", "atoms:Q011.1")] = {"atoms": []}
    executer_spin(ctx, rep)
    assert (sol(ctx, "Q011.1").lettre, sol(ctx, "Q011.1").raison_hors) == ("OUT", "solution_load")


def test_sb34_spin_s_arrete_a_la_presentation():
    """SB-34 replaces SB-3 / SB-4: a diagnostic question inside the pitch is not read, not coded, has no register."""
    lignes = SYN[:12] + [("S", "Let me show you the program now. It has three pillars."), ("P", "Okay."),   # T13
                        ("S", "Is your eye ahead of your process?"), ("P", "Ahead."),                     # T15 check-in
                        ("S", "The second pillar is the portfolio, it is a big part."), ("P", "Nice."),     # T17
                        ("S", "What part of a project scares you?"), ("P", "Quoting the client."),        # T19
                        ("S", "And what happens when you quote?"), ("P", "I undercharge every time."),    # T21
                        ("S", "Now the next point of the program is the business."), ("P", "Okay.")]      # T23
    ctx = mk(lignes, debut_presentation="T013")
    rep = reponses_syn()
    del rep[("spin.gates", "gates:Q017.1")]
    rep.update({("spin.gates", "gates:Q015.1"): "S", ("spin.gates", "gates:Q019.1"): "P",
                ("spin.gates", "gates:Q021.1"): "P"})
    res, client = executer_spin(ctx, rep)
    assert res.details["perimeter"]["reopenings"] == []
    for sid in ("Q015.1", "Q019.1", "Q021.1"):
        s_ = sol(ctx, sid)
        assert s_.lettre is None and "post_discovery" in s_.etiquettes
        ligne_ = next(r for r in res.details["solicitations"] if r["id"] == sid)
        assert not ligne_["in_perimeter"] and ligne_["register"] is None
    demande = {u for t, u, _ in client.appels}
    assert not {"gates:Q015.1", "gates:Q019.1", "gates:Q021.1", "reopen:Q015.1", "reopen:Q019.1"} & demande   # not even read


# =============================================================================================== 7. Annex B, real transcripts
reel = pytest.mark.skipif(not EXECUTIONS.exists(), reason="real transcripts not available")


@reel
def test_annexeB_appel001_besoin_ferme_empile_valeur_financement():
    """B1 case 3, B2 cases 6 and 7, B3 case 4 (call 001)."""
    ctx = charger_reel("001", debut_presentation="T089", premier_prix="T113", fin_presentation="T113")
    g = {"gates:Q017.1": "P", "gates:Q029.1": "N", "gates:Q029.2": "N", "gates:Q033.1": "N", "gates:Q035.1": "S",
         "gates:Q045.1": ("N", None, {"g3": {"content_supplied": True}}),       # 5K supplied by the sales
         "gates:Q045.2": "N", "gates:Q047.1": "S", "gates:Q049.1": "S",
         "gates:Q133.1": ("OUT", "solution_load")}                               # SB-25 financing after the price
    rep = {("spin.gates", k): v for k, v in g.items()}
    rep[("spin.atoms", "atoms:Q033.1")] = {"atoms": [atome("DESIRE", "T034", "I would say minimum $5,000",
                                                          quantified=True, value=5000, unit="usd",
                                                          dimension="revenue")]}
    rep[("spin.atoms", "atoms:Q035.1")] = {"atoms": [atome("SITUATION", "T036", "it's like $23 an hour",
                                                          quantified=True, dimension="revenue"),
                                                     atome("SITUATION", "T036", "I only put in about 15 hours a week",
                                                          quantified=True, dimension="time")]}
    rep[("spin.atoms", "atoms:Q045.2")] = {"atoms": [
        atome("VALUE", "T046", "I could actually spend time with my kids after school"),
        atome("VALUE", "T046", "trying to climb out of the debt")]}
    res, _ = executer_spin(ctx, rep)
    assert (ctx.phases.debut_decouverte, ctx.phases.fin_decouverte) == ("T017", "T089")
    q1, q2 = sol(ctx, "Q045.1"), sol(ctx, "Q045.2")
    assert (q1.lettre, q1.raison_hors) == ("OUT", "agreement") and "closed_need_payoff" in q1.etiquettes
    assert "unanswered" in q1.etiquettes and q2.lettre == "N" and q2.tours_reponse == ["T046"]       # SB-6
    valeurs = [a for a in ctx.atomes if a.type == "VALUE"]
    assert len(valeurs) == 2 and {a.id_sollicitation for a in valeurs} == {"Q045.2"}           # B2 case 7
    desir = next(a for a in ctx.atomes if a.type == "DESIRE")
    assert desir.quantifie and desir.valeur == 5000                                       # B2 case 6
    assert niv(res, "D4") == 2 and niv(res, "D1") == 1         # one SITUATION shares the goal's dimension
    q133 = sol(ctx, "Q133.1")
    ligne_ = next(r for r in res.details["solicitations"] if r["id"] == "Q133.1")
    assert q133.lettre is None and "post_discovery" in q133.etiquettes and not ligne_["in_perimeter"]   # B3 case 4: not coded
    assert ligne_["gate_letter"] is None                                     # SB-34: after the price, not even read
    assert res.details["perimeter"]["reopenings"] == []
    assert res.details["diagnostics"]["closed_need_payoff"] == 1


@reel
def test_annexeB_appel028_debut_situation_et_pas_de_chaine_profonde():
    """B3 case 2, B1 case 1, B4 case 2 (call 028)."""
    ctx = charger_reel("028", debut_presentation="T103")
    g = {"gates:Q027.1": "P", "gates:Q029.1": "P", "gates:Q031.1": "P", "gates:Q037.1": "P", "gates:Q039.1": "S",
         "gates:Q041.1": "S", "gates:Q041.2": "S", "gates:Q043.1": ("OUT", "agreement"),
         "gates:Q045.1": ("I", None, {"g4": {"problem_domain": "work stress", "named_domain": "open"}}),
         "gates:Q049.1": "I", "gates:Q051.1": "I", "gates:Q057.1": "P"}
    rep = {("spin.gates", k): v for k, v in g.items()}
    rep[("spin.atoms", "atoms:Q037.1")] = {"atoms": [atome("PAIN", "T038", "it's going to be exactly the same issues",
                                                          object="consulting own business")]}
    rep[("spin.atoms", "atoms:Q041.2")] = {"atoms": [atome("SITUATION", "T042", "More than ten years.",
                                                          quantified=True, dimension="time")]}
    rep[("spin.atoms", "atoms:Q045.1")] = {"atoms": [atome("IMPACT", "T046", "It has taken a toll on my health",
                                                          domain="health", problem_domain="other",
                                                          object="stressful work")]}
    rep[("spin.atoms", "atoms:Q051.1")] = {"atoms": [atome("IMPACT", "T052", "I have gone through periods of anxiety",
                                                          domain="health", problem_domain="other",
                                                          object="stressful work")]}
    for c in ("Q039.1", "Q041.1", "Q041.2", "Q045.1"):            # even if every link said "same object"
        rep[("spin.link", f"link:Q037.1>{c}")] = {"same_object": True, "quote": " ".join(
            next(u.sol.texte for u in S.inventaire(ctx) if u.sol.id == c).split()[:2])}
    res, _ = executer_spin(ctx, rep)
    assert ctx.phases.debut_decouverte == "T027"                                             # B3 case 2
    assert sol(ctx, "Q039.1").lettre == "S"                                                 # B1 case 1
    sit = next(a for a in ctx.atomes if a.preuve.tour == "T042")
    assert sit.type == "SITUATION" and sit.quantifie and sit.id_sollicitation == "Q041.2"
    assert not any(c["deep"] for c in res.details["chains"])                                # B4 case 2
    assert niv(res, "D5") == 0 and niv(res, "D3") == 1          # two health quotes = one domain
    assert res.statut == "scored"


@reel
def test_annexeB_appel027_chaine_rompue_par_liste_du_commercial():
    """B4 case 3 (call 027): P T056 -> I T058 (IMPACT time, last stacked unit) -> OUT sales_list T060 breaks."""
    ctx = charger_reel("027", debut_presentation="T096")
    g = {"gates:Q016.1": "N", "gates:Q052.1": "P", "gates:Q054.1": "P", "gates:Q056.1": "P",
         "gates:Q058.1": ("OUT", "agreement"), "gates:Q058.3": "I", "gates:Q060.1": ("OUT", "sales_list"),
         "gates:Q062.1": ("N", None, {"g3": {"action_plan": True}})}
    rep = {("spin.gates", k): v for k, v in g.items()}
    rep[("spin.atoms", "atoms:Q056.1")] = {"atoms": [atome("PAIN", "T057", "falling into other people's expectations of me",
                                                          object="other people's expectations")]}
    rep[("spin.atoms", "atoms:Q058.3")] = {"atoms": [atome("IMPACT", "T059", "It's cost me literally three years",
                                                          domain="time", problem_domain="self_belief",
                                                          quantified=True)]}
    rep[("spin.atoms", "atoms:Q062.1")] = {"atoms": [atome("DESIRE", "T063", "Believing in myself and not taking other people's")]}
    rep[("spin.link", "link:Q056.1>Q058.3")] = {"same_object": True, "quote": "what has that actually cost you"}
    rep[("spin.link", "link:Q056.1>Q062.1")] = {"same_object": True, "quote": "Believing in myself"}
    res, _ = executer_spin(ctx, rep)
    assert sol(ctx, "Q058.3").tours_reponse == ["T059"] and "unanswered" in sol(ctx, "Q058.1").etiquettes   # SB-6
    chaine = next(c for c in res.details["chains"] if c["opening"] == "Q056.1")
    assert not chaine["deep"] and chaine["broken_at"] == "Q060.1:OUT_sales_list"
    assert niv(res, "D3") == 1 and niv(res, "D5") == 0          # the IMPACT counts for D3, not for D5
    assert sol(ctx, "Q062.1").lettre == "N"                    # SB-21: the answer states a future state
    # counterfactual: an OUT `nothing` at T060 would not break the chain (SB-20)
    ctx2 = charger_reel("027", debut_presentation="T096")
    rep[("spin.gates", "gates:Q060.1")] = ("OUT", "nothing")
    res2, _ = executer_spin(ctx2, rep)
    assert niv(res2, "D5") == 1


@reel
def test_annexeB_appel011_besoin_ferme_et_pas_de_spin_apres_presentation():
    """B1 case 2; B1 case 6 and B3 case 3 superseded by SB-34 (no check-in, no reopening inside the pitch), call 011."""
    ctx = charger_reel("011", debut_presentation="T127", premier_prix="T201", fin_presentation="T201")
    g = {"gates:Q047.1": "S", "gates:Q049.1": ("N", None, {"g3": {"content_supplied": True}}),
         "gates:Q141.1": "S", "gates:Q163.2": "P", "gates:Q163.3": "P", "gates:Q173.1": "P", "gates:Q173.2": "P"}
    rep = {("spin.gates", k): v for k, v in g.items()}
    res, _ = executer_spin(ctx, rep)
    q49 = sol(ctx, "Q049.1")
    assert (q49.lettre, q49.raison_hors) == ("OUT", "agreement") and "closed_need_payoff" in q49.etiquettes   # B1 case 2
    assert res.details["perimeter"]["reopenings"] == []                                                # SB-34
    for sid in ("Q141.1", "Q163.2", "Q163.3", "Q173.1", "Q173.2", "Q177.1"):
        assert sol(ctx, sid).lettre is None and "post_discovery" in sol(ctx, sid).etiquettes


@reel
def test_annexeB_appel046_debut_social_et_reponse_d_un_mot():
    """B3 case 1 and B2 case 12 (call 046)."""
    ctx = charger_reel("046", debut_presentation="T200")
    g = {"gates:Q023.1": "N", "gates:Q023.2": "N",
         "gates:Q103.1": ("I", None, {"g4": {"problem_domain": "self_belief", "named_domain": "open"}}),
         "gates:Q105.1": "I"}
    rep = {("spin.gates", k): v for k, v in g.items()}
    rep[("spin.atoms", "atoms:Q103.1")] = {"atoms": [atome("IMPACT", "T104", "Everything.", domain="other",
                                                          problem_domain="self_belief")]}
    rep[("spin.atoms", "atoms:Q105.1")] = {"atoms": [
        atome("IMPACT", "T106", "the life I want to give my children before they've moved out", domain="family",
             problem_domain="self_belief"),
        atome("IMPACT", "T106", "it just makes me really unhappy with myself that I haven't done it",
             domain="self_belief", problem_domain="other")]}
    res, _ = executer_spin(ctx, rep)
    assert ctx.phases.debut_decouverte == "T023"                                         # B3 case 1 (T007 social)
    assert sol(ctx, "Q103.1").tours_reponse == ["T104"]                                  # SB-7 does not extend
    assert not [a for a in ctx.atomes if a.preuve.tour == "T104"]                       # below 2 words
    imp = [a for a in ctx.atomes if a.type == "IMPACT"]
    assert {a.domaine for a in imp} == {"family", "self_belief"} and len(imp) == 2


# =============================================================================================== 8. registers (SB-26..SB-33)
def reg(domaine, base_="named", citation=None, ref=None, **kw) -> dict:
    d = {"asked_domain": domaine, "basis": base_, "quote": citation, "reference_turn": ref}
    d.update(kw)
    return d


def reponses_reg():
    a = reponses_syn()
    a.update({("spin.register", "register:Q003.1"): reg("clients", "answer", citation="I have no clients", ref="T004"),  # SB-35
              ("spin.register", "register:Q005.1"): reg("money", citation="your money"),
              ("spin.register", "register:Q007.1"): reg("family", citation="your family"),
              ("spin.register", "register:Q009.1"): reg("money", citation="How much do you make"),
              ("spin.register", "register:Q011.1"): reg("future", citation="Where do you want to be")})
    return a


class TestRegistres:
    @pytest.mark.parametrize("dom,reg_", [("money", "financial"), ("clients", "financial"), ("time", "time_load"),
                                          ("family", "time_load"), ("future", "identity_status"),
                                          ("self_belief", "mental_emotional"), ("health", "mental_emotional"),
                                          ("other", "other"), ("none", "other")])
    def test_sb26_domaine_vers_registre(self, dom, reg_):
        assert S.decider_registre(reg(dom)) == reg_

    @pytest.mark.parametrize("q,att", [
        ("With your clients being so up and down, what impact is that having on your income?", {"financial"}),
        ("How has that impacted you on a personal level?", set()),
        ("How does that make you feel?", {"mental_emotional"}),
        ("Where do you want to be in 12 months?", {"identity_status"}),
        ("What is $5k a month going to do for you?", {"financial"}),
        ("And how is your family taking it?", {"time_load"}),
        ("What is leading you to look now?", set())])
    def test_sb30_mots_du_domaine(self, q, att):
        assert S.registres_lexique(q) == att

    def unite(self, sid):
        ctx = mk(SYN, debut_presentation="T013")
        return ctx, next(u for u in S.inventaire(ctx) if u.sol.id == sid)

    def test_sb32_verifications(self):
        ctx, u = self.unite("Q005.1")
        v = lambda a: S._valider_registre(a, ctx, u)          # noqa: E731
        assert v(reg("money", citation="your money")) == []
        assert v(reg("money", citation="your wallet")) == ["bad_quote:named"]
        assert v(reg("family", citation="your money")) == ["lexicon_conflict"]           # rule 3: one register in the words
        assert v(reg("clients", "reference", citation="I have no clients", ref="T004")) == []
        assert v(reg("clients", "reference", citation="I have no clients", ref="T010")) == ["bad_reference_turn"]
        assert v(reg("money", "none")) == ["none_basis_with_domain"]
        assert v(reg("none", "named", citation="your money")) == ["domain_without_basis"]
        assert v(reg("career", citation="your money")) == ["bad_domain"]
        assert v(reg("other", "named", citation="your money")) == ["named_other"]                # SB-35: open question
        assert v(reg("money", "answer", citation="I lost about 2K a month", ref="T006")) == ["no_answer"]
        u.sol.tours_reponse = ["T006"]                                                       # now it has an answer
        assert v(reg("money", "answer", citation="I lost about 2K a month", ref="T006")) == []
        assert v(reg("money", "answer", citation="I lost about 2K a month", ref="T004")) == ["bad_answer_turn"]
        assert v(reg("money", "answer", citation="I lost 5K", ref="T006")) != []
        assert v(reg("other", "answer", citation="I can't pay my rent", ref="T006")) == []     # the answer may be Other
        assert v(reg("clients", "reference", citation="I have no clients", ref="T004")) == ["reference_with_answer"]
        assert v(reg("none", "none")) == ["none_with_answer"]

    def test_registres_dans_une_execution(self):
        ctx = mk(SYN, debut_presentation="T013")
        res, client = executer_spin(ctx, reponses_reg())
        lignes_ = {r["id"]: r for r in res.details["solicitations"]}
        assert {k: lignes_[k]["register"] for k in ("Q003.1", "Q005.1", "Q007.1", "Q009.1", "Q011.1")} == {
            "Q003.1": "financial", "Q005.1": "financial", "Q007.1": "time_load", "Q009.1": "financial",
            "Q011.1": "identity_status"}
        assert lignes_["Q001.1"]["register"] is None                          # before the perimeter
        assert lignes_["Q015.1"]["register"] is None and lignes_["Q017.1"]["register"] is None   # SB-26: after the pitch
        assert not any(t == "spin.register" and u in ("register:Q015.1", "register:Q017.1") for t, u, _ in client.appels)
        resum = res.details["registers"]
        assert resum["counts"] == {"financial": 3, "time_load": 1, "identity_status": 1, "mental_emotional": 0, "other": 0}
        assert resum["agreement"] == 1.0 and "register_agreement_low" not in res.signaux
        assert res.note is not None and res.version_regles == "SPIN-1.3"     # the register never changes the score

    def test_sb35_une_question_ouverte_prend_le_registre_de_sa_reponse(self):
        """Romain 2026-10-29: "what made you book this call?" names no domain; the answer speaks of clients: Financial.
        A reference although the question was answered is rejected (SB-32), replayed, then to_review."""
        res, _ = executer_spin(mk(SYN, debut_presentation="T013"), reponses_reg())
        ligne_ = next(r for r in res.details["solicitations"] if r["id"] == "Q003.1")
        assert (ligne_["register"], ligne_["register_basis"], ligne_["register_reference_turn"]) == ("financial", "answer", "T004")
        a = reponses_reg()
        a[("spin.register", "register:Q003.1")] = reg("clients", "reference", citation="I have no clients", ref="T004")
        res2, _ = executer_spin(mk(SYN, debut_presentation="T013"), a)
        ligne2 = next(r for r in res2.details["solicitations"] if r["id"] == "Q003.1")
        assert ligne2["register"] is None and ligne2["register_status"] == "to_review"

    def test_sb35_la_consigne_montre_la_reponse(self):
        ctx = mk(SYN, debut_presentation="T013")
        u = next(x for x in S.inventaire(ctx) if x.sol.id == "Q003.1")
        u.sol.tours_reponse = ["T004"]
        assert "PROSPECT'S ANSWER TO IT:" in S._construire_registre(ctx, u) and "I have no clients" in S._construire_registre(ctx, u)
        u.sol.tours_reponse = []
        assert "(no answer)" in S._construire_registre(ctx, u)

    def test_le_registre_ne_change_jamais_la_note(self):
        a = reponses_reg()
        b = dict(a)
        b[("spin.register", "register:Q005.1")] = reg("none", "none")
        ra, _ = executer_spin(mk(SYN, debut_presentation="T013"), a)
        rb, _ = executer_spin(mk(SYN, debut_presentation="T013"), b)
        assert (ra.note, [i.niveau for i in ra.items]) == (rb.note, [i.niveau for i in rb.items])

    def test_questions_hors_sans_registre(self):
        a = reponses_reg()
        a[("spin.gates", "gates:Q009.1")] = ("OUT", "agreement")
        res, client = executer_spin(mk(SYN, debut_presentation="T013"), a)
        lignes_ = {r["id"]: r for r in res.details["solicitations"]}
        assert lignes_["Q009.1"]["register"] is None
        assert ("spin.register", "register:Q009.1") not in {(t, u) for t, u, _ in client.appels}

    def test_un_desaccord_va_a_l_arbitre_puis_a_revoir_et_baisse_l_accord(self):
        a = reponses_reg()
        fut, lun = reg("future", citation="Where do you want to be"), reg("money", citation="Where do you want to be")
        a[("spin.register", "register:Q011.1")] = [fut, fut, lun, dict(fut, case_label="undecidable")]
        res, _ = executer_spin(mk(SYN, debut_presentation="T013"), a)
        lignes_ = {r["id"]: r for r in res.details["solicitations"]}
        assert lignes_["Q011.1"]["register"] is None and lignes_["Q011.1"]["register_status"] == "to_review"
        resum = res.details["registers"]
        assert resum["to_review"] == 1 and resum["agreement"] == 0.8 and "register_agreement_low" in res.signaux

    def test_l_arbitre_decide_par_les_regles(self):
        a = reponses_reg()
        fut, lun = reg("future", citation="Where do you want to be"), reg("money", citation="Where do you want to be")
        a[("spin.register", "register:Q011.1")] = [fut, lun, fut, dict(fut, case_label="application_error",
                                                                       justification="SB-28: no amount is asked")]
        res, _ = executer_spin(mk(SYN, debut_presentation="T013"), a)
        ligne_ = next(r for r in res.details["solicitations"] if r["id"] == "Q011.1")
        assert (ligne_["register"], ligne_["register_status"]) == ("identity_status", "arbitrated")

    def test_conflit_lexique_rejoue_puis_a_revoir(self):
        a = reponses_reg()
        a[("spin.register", "register:Q005.1")] = reg("family", citation="your money")
        res, client = executer_spin(mk(SYN, debut_presentation="T013"), a)
        ligne_ = next(r for r in res.details["solicitations"] if r["id"] == "Q005.1")
        assert ligne_["register"] is None and ligne_["register_status"] == "to_review"
        assert sum(1 for t, u, _ in client.appels if u == "register:Q005.1") == 8      # (3 passes + arbiter) x (1 + replay)


def test_une_coupe_de_porte_mal_formee_est_une_mauvaise_coupe():
    """A split / sub sent as an object instead of a list is rejected by the validator and never applied."""
    from lnp_analyse.competences.spin import _valider_obj_porte, decider_portes
    g = {"g1": {"reason": None}, "split": ["How long?", "And why?"], "sub": {"0": {}, "1": {}}}
    assert "bad_split" in _valider_obj_porte(g, "How long? And why?")
    attrs = {"validation_tail": False, "alternative": False, "open_branch": False, "offer_mention": False,
             "anchor_words": [], "backchannel": False, "system": False}
    assert [t for t, _ in decider_portes(g, attrs, "How long? And why?")] == ["How long? And why?"]

