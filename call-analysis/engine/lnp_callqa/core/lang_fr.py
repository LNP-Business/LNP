"""French word lists of the code's checks (LNP, 2026-11-19).

The calls of LNP are in French; the checks of the engine were written with English lists only (lite README, approximation 9),
so a French call was read wrong by the code: accented letters cut out of words, "de" accepted as a verbatim key expression,
"pour" or "avec" taken for content words, "oui, d'accord" not seen as an agreement, "je" never shifted to "tu". Each list
below is added to its English twin (the English stays: a call in English is read as before). The words are written with
their accents; a list compared on accent-folded text (SPIN `_fold`) is folded where it is used.
"""
from __future__ import annotations

# Function words (C3 / GB-22 (d) "not generic", SB-17 content words, objections content words)
# (words that are also English content words are left out: « son » (my son), « car », « ton » (a ton of))
STOP = set("""le la les l' un une des du de d' au aux à a et ou mais donc or ni en dans sur sous pour par avec sans
chez vers entre que qu' qui quoi dont où ce cet cette ces c' ça cela ceci celui celle ceux celles il elle ils elles on nous vous
tu te t' toi moi me m' je j' se s' lui leur leurs y mon ma mes ta tes sa ses notre nos votre vos est es suis sont êtes
sommes être été était étais étaient serait ai as avons avez ont avoir eu avait avais fait fais faire ne n' pas plus moins très
bien alors voilà ouais oui non euh ben bah hein comme si aussi encore déjà là ici ok okay d'accord parce puis quand comment
pourquoi combien quel quelle quels quelles tout tous toute toutes même mêmes autre autres peu beaucoup trop assez juste
vraiment genre truc enfin bon bref donc après avant aujourd'hui maintenant toujours jamais rien quelque quelques chaque
peut peux pouvoir veux veut vouloir va vais vas aller dit dis dire sais sait savoir pense penses""".split())

# Words too vague to carry a component of the gap alone (GB-22 (d))
GENERIC = set("""chose choses truc trucs machin quelque chose tout tous vie gens personne monde façon manière moyen
bien mal mieux bon bonne mauvais mauvaise dur dure facile difficile envie besoin faire fait fais avoir ai as être suis
sentir sens savoir sais penser pense vouloir veux veut voudrais aimerais aime vraiment juste genre beaucoup""".split())

# A prospect's words restated by the sales (GB-22 (b)): first person → second person
PERSON_SHIFT = {"je": "tu", "j'": "tu", "me": "te", "m'": "t'", "moi": "toi", "mon": "ton", "ma": "ta", "mes": "tes",
                "nous": "vous", "notre": "votre", "nos": "vos", "suis": "es", "ai": "as", "vais": "vas", "sais": "sais",
                "mien": "tien", "mienne": "tienne", "miens": "tiens", "miennes": "tiennes", "moi-même": "toi-même"}
# Second-person forms written two ways ("t'as" / "tu as", "t'es" / "tu es"): the same token on both sides. The French
# « vous » of a sales who does not say « tu » counts as « tu » (2026-11-21, Romain), and a possessive is read without
# its gender (« ta maison » = « ton » = « votre maison »): a restatement is not judged on its grammar (GB-22 (b)).
SECOND_PERSON_ALIAS = {"t'": "tu", "te": "tu", "toi": "tu", "vous": "tu", "ta": "ton", "votre": "ton", "vos": "tes",
                       "êtes": "es", "avez": "as", "allez": "vas", "savez": "sais", "pouvez": "peux", "voulez": "veux",
                       "vous-même": "toi-même", "vous-mêmes": "toi-même", "tienne": "tien", "vôtre": "tien",
                       "tiennes": "tiens", "vôtres": "tiens"}

# Elided words split from the word they precede ("j'ai" = "j'" + "ai"), so both sides are cut the same way
ELISIONS = ("jusqu'", "lorsqu'", "puisqu'", "qu'", "l'", "d'", "j'", "m'", "t'", "s'", "n'", "c'")

# Numbers written in words (PB-21, GB-24); "un" and "une" are left out: they are articles far more often than numbers
NUM_WORDS = {"zéro": 0, "deux": 2, "trois": 3, "quatre": 4, "cinq": 5, "six": 6, "sept": 7, "huit": 8, "neuf": 9,
             "dix": 10, "onze": 11, "douze": 12, "treize": 13, "quatorze": 14, "quinze": 15, "seize": 16, "vingt": 20,
             "trente": 30, "quarante": 40, "cinquante": 50, "soixante": 60, "cent": 100, "mille": 1000}
THOUSAND_WORDS = ("mille", "k€")        # « 2 k€ », « 2,5 k€ » written as two words

# A turn that is only an agreement (C3 rule 5). The longer forms come first (« c'est exactement ça » before « c'est ça »).
APPROVAL = (r"c'est exactement ça|exactement ça|c'est bien ça|c'est clair|c'est sûr|c'est juste|sans aucun doute|"
            r"bah oui|ben oui|eh oui|totalement|clairement|grave|"
            r"oui|ouais|ouai|ouep|ok|okay|d'accord|exactement|exact|tout à fait|carrément|voilà|c'est ça|c'est vrai|"
            r"c'est exact|bien sûr|absolument|effectivement|parfait|super|très bien|en effet|évidemment|non|nan|"
            r"mmh|mm|hum|hm|ah oui|oh oui|oui oui|mais oui|tout à fait ça")
