"""Le moteur allégé sur un appel fictif, avec des réponses du modèle enregistrées (pas de réseau, aucune vraie donnée)."""
import copy
import json

import pytest

import appel_synthetique as sc
from analyse_allegee.moteur import ErreurModeleAllege, analyse
from analyse_allegee.etapes import ClientAllegeSimule, lire_json


def executer(reponses=None, **cfg):
    client = ClientAllegeSimule(reponses or sc.REPONSES)
    return analyse(sc.contexte(), client, cfg or None), client


def sols(enr):
    return enr["results"]["SPIN"]["details"]["solicitations"]


# ------------------------------------------------------------------ vérification des citations (C3)
def test_citations_inventees_ou_mal_attribuees_rejetees_et_comptees():
    enr, _ = executer()
    etapes = enr["meta"]["steps"]
    assert etapes["S0"]["reasons"] == {"wrong_speaker": 1}                       # un tour du prospect donné comme description de l'offre
    assert etapes["S1"]["reasons"]["question:wrong_speaker"] == 1                 # un tour du prospect donné comme question
    assert etapes["S1"]["reasons"]["atom:not_a_substring"] == 1                   # « 20,000 a month » n'a jamais été dit
    assert etapes["S1"]["reasons"]["atom:outside_answers"] == 1                   # un tour du commercial donné comme atome
    assert etapes["S3"]["reasons"] == {"pitch.claims:claim": 1}                   # « Our students make 20K » jamais dit
    assert etapes["S4"]["reasons"]["quote:wrong_speaker"] == 1                    # un tour du commercial donné comme objection
    atomes = enr["results"]["SPIN"]["details"]["atom_decisions"]
    assert all("20,000" not in a["quote"] for a in atomes)
    assert all(a["turn"] in {"T004", "T006", "T008", "T010", "T012", "T014", "T016"} for a in atomes)
    affirmations = enr["results"]["PITCH"]["details"]["claims"]
    assert [c["turn"] for c in affirmations] == ["T027"] and "20K" not in json.dumps(affirmations)


def test_un_geste_dont_la_citation_est_absente_n_est_pas_fait():
    a = copy.deepcopy(sc.REPONSES)
    a["lite.s4_objections"]["objections"][1]["isolate"] = {"turn": "T029", "quote": "is this the only thing in the way?"}
    enr, _ = executer(a)
    e1 = enr["results"]["OBJECTIONS"]["details"]["episodes"][0]
    assert e1["isolate"] is False and enr["meta"]["steps"]["S4"]["reasons"]["isolate:not_a_substring"] == 1
    assert next(i for i in e1["items"] if i["id"] == "H3")["level"] == 1        # exploré seulement (§5.1 H3)


# ------------------------------------------------------------------ phases et découverte
def test_la_carte_des_phases_est_decidee_par_le_code():
    enr, _ = executer()
    ph = enr["phases"]
    assert (ph["discovery_start"], ph["pitch_start"], ph["first_price"], ph["decision_request"], ph["pitch_end"]) == \
        ("T003", "T019", "T027", "T039", "T027")


def test_le_prix_doit_etre_celui_de_l_offre_lnp_avec_son_explication():
    """Romain 2026-11-03 : le premier prix est dit par le commercial pour l'offre LNP et va avec son explication."""
    a = copy.deepcopy(sc.REPONSES)
    a["lite.s0_phases"]["turns"] += [
        # un montant qui n'est pas le prix de l'offre (un chiffre du prospect) : écarté
        {"turn": "T023", "quote": "You go from 1,500 a month to 6,000 a month", "price_for_offer": True, "amount": 1500,
         "lnp_offer_price": False},
        # dit comme un prix, mais l'explication citée n'est pas un extrait exact : écarté
        {"turn": "T025", "quote": "Do you have any questions about how the weekly calls work?", "price_for_offer": True,
         "amount": 900, "lnp_offer_price": True, "offer_explained": {"turn": "T019", "quote": "a twelve-month plan"}}]
    enr, _ = executer(a)
    assert enr["phases"]["first_price"] == "T027"
    r = enr["meta"]["steps"]["S0"]["reasons"]
    assert r["price:not_lnp_offer"] == 1 and r["price:no_offer_explained"] == 1


def test_une_introduction_suivie_de_decouverte_n_est_pas_le_debut_de_presentation():
    a = copy.deepcopy(sc.REPONSES)
    a["lite.s0_phases"]["turns"].append(
        {"turn": "T001", "quote": "Hi Alex, can you hear me okay?", "offer_description": True,
         "followed_by_discovery": False, "next_discovery_question": {"turn": "T003", "quote": "what made you book this call?"}})
    enr, _ = executer(a)
    assert enr["phases"]["pitch_start"] == "T019"


def test_un_prix_lnp_valide_avant_le_debut_deplace_le_debut_de_presentation():
    a = copy.deepcopy(sc.REPONSES)
    t = next(x for x in a["lite.s0_phases"]["turns"] if x["turn"] == "T019")
    t["followed_by_discovery"] = True                         # T019 pris comme une mention : pas de début de présentation avant T027
    t["next_discovery_question"] = None
    enr, _ = executer(a)
    ph = enr["phases"]
    assert ph["first_price"] == "T027" and ph["pitch_start"] == "T019"     # l'explication du prix ouvre la présentation


def test_la_decouverte_finit_quand_l_ecart_est_fait():
    enr, _ = executer()
    assert enr["results"]["GAP"]["verdict"] == "present"
    assert enr["meta"]["discovery_end_rule"] == "gap" and enr["phases"]["discovery_end"] == "T018"
    assert all(int(x["turn"][1:]) < 18 for x in sols(enr))


def test_sans_decouverte_ni_presentation_ecart_non_applicable():
    a = {"lite.s0_phases": {"turns": []}, "lite.s1_discovery": {"questions": []},
         "lite.s2_gap": {"passages": []}, "lite.s3_pitch": {}, "lite.s4_objections": {"objections": []}}
    enr, _ = executer(a)
    assert enr["results"]["GAP"]["status"] == "not_applicable"


def test_la_decouverte_ne_garde_que_les_questions_avant_la_presentation():
    enr, _ = executer()
    s = sols(enr)
    assert all(int(x["turn"][1:]) < 19 for x in s)
    assert enr["meta"]["steps"]["S1"]["reasons"]["question:after_pitch"] == 1
    assert [x["id"] for x in s if x["in_perimeter"]] == ["Q003.1", "Q005.1", "Q007.1", "Q009.1", "Q011.1", "Q013.1",
                                                          "Q015.1"]
    premier = s[0]                                                                   # échange social : avant le périmètre
    assert premier["turn"] == "T001" and not premier["in_perimeter"] and premier["letter"] is None


def test_chaque_question_a_sa_lettre_son_registre_et_la_reponse_du_prospect():
    enr, _ = executer()
    by = {x["turn"]: x for x in sols(enr)}
    assert [by[t]["letter"] for t in ("T003", "T005", "T007", "T009", "T011", "T013", "T015")] == \
        ["S", "S", "P", "I", "I", "N", "N"]
    assert by["T007"]["register"] == "financial" and by["T007"]["register_basis"] == "named"
    assert by["T009"]["register"] == "mental_emotional" and by["T009"]["register_basis"] == "answer"
    assert by["T011"]["register"] == "time_load" and by["T015"]["register"] == "time_load"
    assert by["T005"]["answer_turns"] == ["T006"]                                 # SB-5, calculé par le code
    assert by["T003"]["answer"] == {"turn": "T004", "quote": "I only make about 1,500 a month from it"}
    reg = enr["results"]["SPIN"]["details"]["registers"]
    assert reg["counts"] == {"financial": 4, "time_load": 2, "identity_status": 0, "mental_emotional": 1, "other": 0}
    assert reg["flags"] == [] and reg["agreement"] is None and reg["single_reading"]


def test_un_registre_contraire_aux_mots_du_domaine_est_rejete():
    a = copy.deepcopy(sc.REPONSES)
    q = next(x for x in a["lite.s1_discovery"]["questions"] if x["turn"] == "T005")
    q.update(register_domain="time")                    # « How many clients » : seulement des mots du registre financier (SB-32, règle 3)
    enr, _ = executer(a)
    by = {x["turn"]: x for x in sols(enr)}
    assert by["T005"]["register"] is None and by["T005"]["register_status"] == "to_review"
    assert enr["meta"]["steps"]["S1"]["reasons"]["register:lexicon_conflict"] == 1


def test_une_queue_de_validation_met_la_question_hors_accord():
    a = copy.deepcopy(sc.REPONSES)
    enr0, _ = executer(a)
    t = sc.contexte()
    t.tours[4].texte = "How many clients do you have right now, right?"
    a["lite.s1_discovery"]["questions"][2]["quote"] = "How many clients do you have right now, right?"
    enr = analyse(t, ClientAllegeSimule(a))
    q = next(x for x in sols(enr) if x["turn"] == "T005")
    assert q["letter"] == "OUT" and q["out_reason"] == "agreement" and "validation_tail" in q["tags"]
    assert next(x for x in sols(enr0) if x["turn"] == "T005")["letter"] == "S"


# ------------------------------------------------------------------ objections
def test_objections_avant_premier_prix_rejetees_et_repetitions_fusionnees():
    enr, _ = executer()
    d = enr["results"]["OBJECTIONS"]["details"]
    eps = d["episodes"]
    assert [(e["subtype"], e["resistance"]["turn"]) for e in eps] == [("price", "T028"), ("co_decider", "T036")]
    # OB-27 : avant la présentation (T010) et pendant la présentation mais avant le premier prix (T024, prix en T027) : écartées
    assert enr["meta"]["steps"]["S4"]["reasons"]["quote:before_price"] == 2
    assert d["lite"]["scope"] == "after_first_price"
    argent = eps[0]
    assert [q["turn"] for q in argent["quotes"]] == ["T028", "T038"] and argent["merged_items"] == 2
    assert argent["recurs_later"] and next(i for i in argent["items"] if i["id"] == "H5")["level"] == 0   # OB-11, X4
    assert (argent["acknowledge"], argent["isolate"], argent["explore"], argent["gesture_match"]) == \
        (True, True, {"asked": True, "answered_with_content": True}, "yes")
    assert argent["reaction"]["level"] == "resolved" and argent["topic_change"] == "T035"
    assert argent["response_turns"] == ["T029", "T031", "T033"] and argent["reaction_turns"] == ["T030", "T032", "T034"]
    co = eps[1]
    assert co["explore"]["asked"] is False                                        # OB-15 : ne reprend aucun de ses mots
    assert co["reaction"]["level"] == "acknowledged"


def test_aucune_objection_deux_fois_meme_avec_une_citation_partagee():
    a = copy.deepcopy(sc.REPONSES)
    a["lite.s4_objections"]["objections"].append({"subjects": ["offer_trust"],
                                                  "quotes": [{"turn": "T028", "quote": "a lot of money for me"}]})
    enr, _ = executer(a)
    eps = enr["results"]["OBJECTIONS"]["details"]["episodes"]
    assert len(eps) == 2 and len({(e["nature"], e["subtype"]) for e in eps}) == 2


def test_la_prevention_se_lit_avant_le_premier_prix_seulement():
    enr, _ = executer()
    pv = enr["results"]["OBJECTIONS"]["details"]["prevention"]
    assert pv["influencers"] is None and pv["rejected"] == {"influencers": "after_first_price"}


# ------------------------------------------------------------------ notes (par le code seulement)
def test_les_notes_sont_calculees_par_le_code():
    enr, _ = executer()
    r = enr["results"]
    lv = lambda c: {i["id"]: i["level"] for i in r[c]["items"]}                    # noqa: E731
    assert r["SPIN"]["status"] == "scored" and lv("SPIN") == {"D1": 1, "D2": 1, "D3": 2, "D4": 2, "D5": 1}
    assert r["SPIN"]["score"] == 75
    assert r["GAP"]["verdict"] == "present" and r["GAP"]["score"] == 100
    assert r["PITCH"]["verdict"] == "compliant" and lv("PITCH")["K1"] == 2 and lv("PITCH")["K6"] == 0
    assert r["PITCH"]["score"] == 65
    d = r["OBJECTIONS"]["details"]
    assert (d["handling_score"], d["prevention_score"], r["OBJECTIONS"]["score"]) == (64, 20, 51)
    assert all(x["concordance"] == "single_reading" for x in r.values())


def test_une_note_ecrite_par_le_modele_est_ignoree():
    a = copy.deepcopy(sc.REPONSES)
    for k in a:
        a[k] = dict(a[k], score=99, verdict="present", level=2)
    a["lite.s2_gap"]["passages"][0]["validation"] = {"turn": "T018", "outcome": "rejected",
                                                     "agreement_quote": "Yes, exactly", "score": 100}
    enr, _ = executer(a)
    assert enr["results"]["GAP"]["verdict"] == "absent" and enr["results"]["GAP"]["score"] == 0
    assert enr["results"]["PITCH"]["verdict"] == "non_compliant"                   # présentation avant le oui (PB-37)
    assert "pitch_before_gap" in enr["results"]["PITCH"]["reasons"] and enr["results"]["PITCH"]["score"] == 0


def test_un_cout_paraphrase_n_est_pas_une_composante():
    a = copy.deepcopy(sc.REPONSES)
    c = a["lite.s2_gap"]["passages"][0]["clauses"][3]
    c["key_expression"] = "barely see my kids in the evening"                       # dans la source, pas dans les mots du commercial
    enr, _ = executer(a)
    g = enr["results"]["GAP"]
    assert g["verdict"] == "absent" and g["details"]["absence_reason"] == "cost_missing"   # GB-22, X11


# ------------------------------------------------------------------ l'analyse enregistrée que lit l'écran
def test_l_enregistrement_a_les_champs_lus_par_l_ecran():
    enr, _ = executer()
    assert {"call_id", "sales_id", "start_utc", "timezone", "status", "flags", "turns", "phases", "results", "audit",
            "meta"} <= set(enr)
    assert enr["meta"]["engine"] == "lite" and enr["meta"]["version"] == "callqa-lite-1.0"
    assert {"id", "ts", "role", "speaker", "text", "repaired", "attribution_doubtful"} == set(enr["turns"][0])
    for c in ("SPIN", "GAP", "PITCH", "OBJECTIONS"):
        assert {"competence", "rules_version", "status", "verdict", "reasons", "score", "items", "flags", "details",
                "concordance"} == set(enr["results"][c])
    spin = enr["results"]["SPIN"]["details"]
    assert {"perimeter", "solicitations", "registers", "items_evidence", "chains", "diagnostics", "health"} <= set(spin)
    assert {"id", "turn", "ts", "letter", "in_perimeter", "answer_turns", "register", "register_status"} <= set(spin["solicitations"][1])
    assert any(e.get("question_id") for it in spin["items_evidence"].values() for e in it["evidence"])
    assert spin["chains"][0]["deep"] is True
    ecart = enr["results"]["GAP"]["details"]
    r = ecart["restitution"]
    assert r["span"] == ["T017", "T017"] and r["validation"]["turn"] == "T018" and r["effective_outcome"] == "confirmed_with_content"
    assert {c["component"]: c["match"] for c in r["clauses"]} == {"A": "verbatim", "B": "verbatim", "PROBLEM": "verbatim",
                                                                  "COST": "verbatim"}
    assert ecart["validation_turn"] == "T018" and ecart["validated_P"]["turn"] == "T008"
    presentation = enr["results"]["PITCH"]["details"]
    assert {"1", "2", "3", "4"} == set(presentation["steps"]) and presentation["steps"]["1"]["span"] == ["T021", "T021"]
    assert presentation["validated_P"]["category"] == "Acquisition" and presentation["adhesion"][0]["turn"] == "T024"
    obj = enr["results"]["OBJECTIONS"]["details"]
    assert {"episodes", "prevention", "handling_score", "prevention_score"} <= set(obj)
    assert {"nature", "subtype", "resistance", "acknowledge", "isolate", "explore", "gesture_match", "reaction",
            "items", "response_turns"} <= set(obj["episodes"][0])
    json.dumps(enr)


# ------------------------------------------------------------------ appels du modèle : cache, JSON, nouvelle demande, blocs
def test_un_appel_par_etape_avec_la_transcription_en_meme_prefixe_en_cache():
    enr, client = executer()
    assert [c["task"] for c in client.appels] == ["lite.s0_phases", "lite.s1_discovery", "lite.s2_gap", "lite.s3_pitch",
                                                 "lite.s4_objections"]
    prefixes = {c["prefix"] for c in client.appels}
    assert len(prefixes) == 1 and next(iter(prefixes)).splitlines()[1] == "T001 [SALES] Hi Alex, can you hear me okay?"
    assert "début de la présentation T019" in client.appels[2]["prompt"] and "[T014] \"I want to make 6,000" in client.appels[2]["prompt"]
    assert "\"turn\": \"T008\"" in client.appels[3]["prompt"]                       # le P validé, venu du code de l'écart
    assert all(c["effort"] == "low" and c["tier"] == "fast" for c in client.appels)


def test_le_json_est_lu_solidement_et_rejoue_une_fois():
    assert lire_json("```json\n{\"a\": [1, 2,],}\n```") == {"a": [1, 2]}
    assert lire_json("Here it is: {\"a\": 1} done") == {"a": 1}
    with pytest.raises(ValueError):
        lire_json("no object")
    a = dict(sc.REPONSES, **{"lite.s2_gap": ["{oops", sc.S2]})
    enr, client = executer(a)
    assert [c["task"] for c in client.appels].count("lite.s2_gap") == 2 and enr["results"]["GAP"]["verdict"] == "present"
    assert "REJETÉE PAR LE CODE" in [c for c in client.appels if c["task"] == "lite.s2_gap"][1]["prompt"]


def test_une_etape_toujours_invalide_laisse_sa_competence_a_revoir():
    a = dict(sc.REPONSES, **{"lite.s4_objections": "not json"})
    enr, client = executer(a)
    assert [c["task"] for c in client.appels].count("lite.s4_objections") == 2
    assert enr["results"]["OBJECTIONS"]["status"] == "to_review" and enr["results"]["GAP"]["status"] == "scored"
    assert enr["meta"]["failed_steps"] == ["S4"]
    with pytest.raises(ErreurModeleAllege):
        executer(dict(sc.REPONSES, **{"lite.s0_phases": "not json"}))
    with pytest.raises(ErreurModeleAllege):                                            # la plupart des étapes ont échoué : rien n'est enregistré
        executer({**sc.REPONSES, **{k: "x" for k in ("lite.s1_discovery", "lite.s2_gap", "lite.s3_pitch", "lite.s4_objections")}})


def test_une_reponse_decouverte_coupee_est_redemandee_en_deux_moities():
    a = dict(sc.REPONSES, **{"lite.s1_discovery": [("{\"questions\": [", "max_tokens"), sc.S1, sc.S1]})
    enr, client = executer(a, s1_min_chunk_turns=4)
    unites = [c["unit"] for c in client.appels if c["task"] == "lite.s1_discovery"]
    assert unites == ["T001-T018", "T001-T009", "T010-T018"]
    assert enr["results"]["SPIN"]["score"] == 75                                    # les mêmes questions, listées une fois


def test_un_appel_exclu_ne_demande_rien():
    t = sc.contexte()
    for x in t.tours:
        x.role = "SALES"
    client = ClientAllegeSimule(sc.REPONSES)
    enr = analyse(t, client)
    assert client.appels == [] and enr["status"] == "no_diarization"
    assert all(r["status"] == "excluded" for r in enr["results"].values())


def test_estimation_cout_aux_prix_haiku():
    from analyse_allegee.cout import estimer
    conso = {"fast": {"calls": 6, "input_tokens": 9000, "output_tokens": 30000, "cache_read_input_tokens": 78000,
                      "cache_creation_input_tokens": 15600}}
    usd = estimer(conso)
    assert usd == pytest.approx(0.0009 + 0.015 + 0.00078 + 0.00195, abs=1e-6) and usd < 0.05


def test_le_code_resserre_une_expression_cle_copiee_en_phrase_entiere():
    """GB-22 par le code : le modèle a copié toute la phrase du prospect ; les mots partagés comptent (l'appel
    d'Anastasia)."""
    from analyse_allegee.ecart import expression_cle_partagee
    src = "on gagne vraiment, je pense, quelques 10% de ce qui coûte"
    commercial = "tu te retrouves avec 10% de ce que coûte un cours"
    k = expression_cle_partagee("quelques 10% de ce qui coûte", src, commercial)
    assert k and "10" in k and "quelques" not in k
    # « suis dépendante » quand le glissement de personne français de GB-22 (« je suis » → « tu es ») est dans le moteur
    # de référence, « dépendante » sinon : les deux portent la composante et sont repris par le commercial
    assert expression_cle_partagee("je suis dépendante actuellement de l'aide de ma mère",
                                 "je suis dépendante actuellement de l'aide de ma mère", "es dépendante de ta maman") in \
        ("dépendante", "suis dépendante")
    assert expression_cle_partagee("je suis vraiment", "je suis vraiment", "tu es là") is None       # seulement générique : aucune


# ------------------------------------------------------------------ consignes en français, schémas inchangés
MARQUEURS = {"systeme": [], "s0_phases": [], "s1_decouverte": ["{fenetre}"], "s2_ecart": ["{ancres}", "{limite}", "{enonces}"],
             "s3_presentation": ["{ancres}", "{vp}", "{a}", "{b}", "{blocages}", "{references}"],
             "s4_objections": ["{ancres}"]}


@pytest.mark.parametrize("nom", sorted(MARQUEURS))
def test_les_consignes_gardent_leurs_marqueurs_et_un_schema_json_lisible(nom):
    from analyse_allegee.etapes import charger
    texte = charger(nom)
    for m in MARQUEURS[nom]:
        assert texte.count(m) == 1, m
    if nom != "systeme":
        assert texte.startswith("ÉTAPE ")
        schema = json.loads(texte.split("\nJSON: ", 1)[1])                    # les clés et les valeurs restent en anglais
        assert isinstance(schema, dict) and schema


def test_les_consignes_envoyees_sont_remplies_et_en_francais():
    _, client = executer()
    for c in client.appels:
        assert not any(m in c["prompt"] for ms in MARQUEURS.values() for m in ms), c["task"]
    assert client.appels[0]["prefix"].startswith("TRANSCRIPTION · ")
    s1 = client.appels[1]["prompt"]
    assert "Lis seulement les questions posées dans les tours T001 à T018" in s1
    s2 = client.appels[2]["prompt"]
    assert "CARTE DES PHASES (décidée par le code)" in s2
    assert "depuis le début de la découverte jusqu'au tour T027, qui restitue" in s2


@pytest.mark.parametrize("queue", [", non ?", ", c'est ça ?", ", hein ?", ", d'accord ?"])
def test_une_queue_de_validation_francaise_met_la_question_hors_accord(queue):
    """Les queues de validation viennent du moteur de référence (spin.QUEUES) : le moteur allégé les applique telles
    quelles à la phrase de la question. Ignoré tant que le moteur de référence ne connaît pas cette tournure."""
    import re
    from lnp_analyse.competences import spin as E
    question = "Tu as combien de clients en ce moment" + queue
    if not any(re.search(p, question.lower()) for p in E.QUEUES):
        pytest.skip(f"queue « {queue.strip(', ')} » pas encore dans spin.QUEUES du moteur de référence")
    a = copy.deepcopy(sc.REPONSES)
    t = sc.contexte()
    t.tours[4].texte = question
    a["lite.s1_discovery"]["questions"][2]["quote"] = question
    enr = analyse(t, ClientAllegeSimule(a))
    q = next(x for x in sols(enr) if x["turn"] == "T005")
    assert q["letter"] == "OUT" and q["out_reason"] == "agreement" and "validation_tail" in q["tags"]
