# Compétence 1 · Découverte SPIN
_Méthodologie de notation : comment le système mesure si le commercial a mené une découverte qui a fait dire au prospect son problème, ses conséquences et la valeur de sa résolution_

**Version :** version 1.1 · 25 octobre 2026  
**Statut :** brouillon à faire valider par le responsable de la méthodologie. Les valeurs marquées « à valider » sont des propositions.  
**Périmètre :** appels de vente (premier appel et tout appel qui rouvre la découverte). Sources : référence de bornage SPIN LNP v1.0, référence des verbatims LNP v2, analyse de 85 vrais appels.  
# 1. Ce que mesure cette compétence

**Définition.** La découverte SPIN est la capacité du commercial à amener le prospect, par des questions, à dire avec ses propres mots : sa situation actuelle, ce qui ne marche pas, ce que cela lui coûte en dehors du problème lui-même, et ce que sa résolution vaudrait pour lui.

**Ce que veut dire réussir, en une phrase.** Le commercial a réussi quand le prospect, et non le commercial, a verbalisé un point de départ mesurable, au moins un problème, au moins deux conséquences de ce problème dans d'autres domaines de sa vie (dont une chiffrée), et un état désiré avec la valeur qu'il y attache, et quand tout cela est sorti de suites de questions qui ont creusé le même problème.

**Le principe directeur.** Le système mesure l'**effet** des questions sur le prospect, jamais le nombre de questions. Une question ne rapporte rien par elle-même ; seul ce que le prospect dit en réponse compte. Cela suit la recherche SPIN (Rackham, Huthwaite : dans les ventes complexes, les questions d'implication et de bénéfice attendu prédisent l'avancée parce qu'elles font dire à l'acheteur les conséquences du problème et la valeur de sa résolution) et le garde-fou de LNP : **la lettre d'une question ne produit jamais de points.** Si le nombre de questions entrait dans la note, les commerciaux enchaîneraient les questions pour remplir le compteur.

L'analyse a donc deux couches qui ne se mélangent jamais :

| Couche | Ce qu'elle lit | Ce qu'elle produit | Notée ? |
|---|---|---|---|
| Couche des lettres | La question du commercial | S, P, I, N ou OUT, avec la porte et la preuve | Non. Diagnostics d'accompagnement seulement (partie B §8) |
| Couche de l'effet | La réponse du prospect | Atomes : SITUATION, PAIN, BLOCKER, IMPACT, DESIRE, VALUE | Oui. La note SPIN (partie B §6) |

# Partie A · Définitions
Les règles qui trouvent chaque élément dans une transcription brute (unités, marqueurs de début et de fin, segmentation, exclusions et paires minimales) sont dans l'**annexe A · Règles de bornage**. L'**annexe B** donne de vrais cas annotés pour la calibration. Un verdict qu'on ne peut pas atteindre avec ces règles va à l'arbitre comme cas non couvert.

# 2. Unités et vocabulaire

Dans tout le document, les rôles des tours de parole s'écrivent comme dans la transcription : `SALES` (le commercial), `PROSPECT` (le prospect) et `OTHER` (une autre personne).

**Sollicitation.** Toute proposition du commercial qui demande une réponse au prospect. On la reconnaît à l'un de trois signaux : un point d'interrogation final ; une forme interrogative sans point d'interrogation (inversion, mot interrogatif en tête de proposition) ; un impératif de demande (« dis-moi », « racontez-moi », « explique-moi », « aidez-moi à comprendre », « décris » ; en anglais « tell me », « walk me through », « help me understand », « describe »). Une forme elliptique (« Et le chiffre d'affaires ? ») est une sollicitation.

**Règles de segmentation.**
- **SEG-1.** Une proposition interrogative, une sollicitation. Trois questions dans un même tour font trois unités, numérotées `Q007.1`, `Q007.2`, `Q007.3`.
- **SEG-2.** Deux interrogatives coordonnées font deux unités si le prospect peut répondre à l'une sans l'autre (« Tu bloques à combien, et depuis quand ? »). Les compléments rattachés à une question ne la coupent pas (« qu'est-ce que ça te coûte, sur ton mois, sur ta famille ? »).
- **SEG-3.** Une alternative (« c'est plutôt le prix ou le moment ? ») est une seule unité.
- **SEG-4.** Une queue de validation (« ..., non ? », « ..., c'est ça ? », « ..., hein ? », « ça te parle ? » ; en anglais « …, right? », « …, no? », « …, is that it? », « does that make sense? ») appartient à la proposition qu'elle termine et n'est jamais comptée à part.
- **SEG-5.** Un préambule déclaratif dans le même tour n'est pas une sollicitation, mais ses mots comptent pour l'ancrage.
- **SEG-6.** Une question interrompue compte si elle est intelligible et que le prospect y répond ; sinon elle est gardée avec l'attribut `debris` et exclue.
- **SEG-7.** Une relance d'écoute (« hmm ? », « ah ouais ? », « c'est vrai ? ») dite par-dessus le prospect n'est jamais une sollicitation.
- **SEG-8.** Seul le commercial produit des sollicitations. Une question du prospect n'est jamais codée.

**Périmètre de la découverte.** Seules les sollicitations situées dans le périmètre sont codées :
- **Début :** la première sollicitation sur la situation, les objectifs ou les problèmes du prospect qui n'est ni sociale (d'où tu appelles, papotage sur la famille), ni logistique, ni de cadrage (« voilà comment va se passer l'appel »).
- **Fin :** le premier début de la présentation de l'offre ou le premier prix, selon ce qui vient en premier (méthodologie de la présentation de l'offre, annexe A, PB-1 et PB-3). Une restitution de l'écart ne termine **pas** le périmètre : les questions posées après une restitution et avant la présentation de l'offre sont encore de la découverte (voir annexe A, SB-1, et la décision du §11).
- **Pas de réouverture (v1.2, SB-34) :** la découverte se termine au premier début de la présentation de l'offre ou au premier prix et ne se rouvre jamais ; rien de ce qui est dit après n'est du SPIN.

**Lettres.**

| Lettre | La question demande… |
|---|---|
| S · Situation | un fait neutre vérifiable aujourd'hui : un nombre, une durée, un nom, un statut, une description de ce qui se fait aujourd'hui |
| P · Problème | la difficulté elle-même, formulée par le prospect : un manque, un blocage, une perte, une insatisfaction, une tentative ratée |
| I · Implication | ce que fait le problème : une conséquence en dehors du domaine propre du problème (argent, temps, clients, famille, santé, confiance en soi, avenir) |
| N · Bénéfice attendu (need-payoff) | un état désiré qui n'existe pas encore, ou la valeur que le prospect attache à la résolution du problème, dite par le prospect |
| OUT | un accord, un choix dans la liste du commercial, une information sur l'offre, la charge d'une solution, ou rien de substantiel |

**Domaine.** Une unité de perte : argent, heures, clients, personnel, sommeil, santé, réputation, famille, confiance en soi. Un périmètre de temps ou de lieu (« le reste de la semaine », « à la maison le soir ») n'est pas un domaine.

**Atomes (couche de l'effet).** Ce que le prospect a produit dans une réponse.

| Atome | Le prospect dit… | Produit en général par |
|---|---|---|
| SITUATION | un fait neutre sur aujourd'hui | S |
| PAIN | quelque chose qui ne marche pas, avec ses mots | P |
| BLOCKER | ce qui l'empêche d'atteindre son objectif | P |
| IMPACT | une conséquence du problème dans un autre domaine | I |
| DESIRE | un état futur désiré | N |
| VALUE | pourquoi la résolution compte, ce qu'elle changerait, ce qu'il en ferait | N |

Un atome est rattaché à la question qui l'a produit, mais **ne change jamais la lettre de cette question**. Une question de situation qui reçoit une douleur chiffrée reste un S ; une question d'implication à laquelle le prospect répond « je ne sais pas » reste un I.

# 3. Comment une question reçoit sa lettre

Le modèle ne choisit pas une lettre. Il répond à cinq portes dans un ordre fixe, chacune avec une citation exacte. Le code applique l'ordre : **le premier « oui » l'emporte.** À chaque porte, l'exclusion est évaluée avant le test positif.

| Porte | Question fermée posée au modèle | Si oui |
|---|---|---|
| 0 Aiguillage | Demande-t-elle de confirmer une restitution complète de l'écart, ou demande-t-elle une décision d'achat ? | `VALIDATION_REQUEST` ou `DECISION_REQUEST`, non codée |
| 1 OUT | La réponse attendue est-elle seulement un accord avec ce que le commercial vient d'affirmer, un choix parmi des options listées par le commercial, une information ou un avis sur l'offre du commercial, la charge estimée d'une solution, ou rien de substantiel ? | OUT, avec sa raison |
| 2 S | La réponse attendue est-elle un fait neutre que le prospect pourrait vérifier aujourd'hui ? (Non si elle lui demande de nommer une difficulté, une conséquence ou un état qui n'existe pas encore) | S |
| 3 N | La réponse attendue est-elle un état désiré qui n'existe pas encore, ou la valeur de la résolution ? (Non si la question contient déjà cet état ou cette valeur, nomme une charge ou porte sur l'offre ; non si l'antécédent est la poursuite du problème) | N |
| 4 I | La réponse attendue est-elle une conséquence du problème, dans un domaine autre que le domaine propre du problème ? | I |
| 5 P | La réponse attendue est-elle la difficulté elle-même, formulée par le prospect ? (Non si le commercial l'a déjà nommée avec ses propres mots) | P |
| aucune | Aucune porte n'a répondu oui | OUT, raison `absent` (un défaut du système, jamais compté contre le commercial) |

**Raisons de OUT, par ordre de priorité :** `nothing` (social, logistique, cadrage, rhétorique, « ça te parle ? »), `offer_info`, `solution_load`, `sales_list`, `agreement`, `absent`. Un bénéfice attendu dont le contenu est fourni par le commercial (« donc ton objectif, c'est à peu près 10 000 €, c'est ça ? ») est OUT `agreement` avec l'étiquette `closed_need_payoff`.

**Règles strictes appliquées par le code, qui l'emportent sur le modèle :** une queue de validation finale donne toujours OUT `agreement` ; un état désiré contenu dans la question donne toujours OUT `agreement` + `closed_need_payoff` ; la charge d'une solution donne toujours OUT `solution_load` ; une valeur demandée sur l'offre donne toujours OUT `offer_info`.

# Partie B · Mécanisme et notation

# 4. Ce que le système extrait de chaque réponse

Pour chaque sollicitation codée, le modèle reçoit la question, le tour suivant du prospect (et le tour du prospect d'après si le premier fait moins de 6 mots et que le commercial n'a pas parlé entre les deux), et répond à ces questions fermées, chaque réponse positive avec une citation exacte **tirée du tour du prospect** :

| Champ | Question fermée | Valeurs permises |
|---|---|---|
| `atoms` | Quels atomes la réponse contient-elle ? | Liste parmi SITUATION, PAIN, BLOCKER, IMPACT, DESIRE, VALUE, ou vide |
| `atom.quote` | Passage exact qui énonce l'atome | 2 à 40 mots, tour du prospect |
| `atom.quantified` | Le passage y attache-t-il un nombre, un montant, une durée ou une fréquence ? | oui / non |
| `atom.domain` | Pour IMPACT : quel domaine ? | money, time, clients, family, health, self_belief, future, other |
| `atom.problem_domain` | Pour IMPACT : domaine du problème dont il vient | même liste |
| `atom.prompted_by_sales` | Le contenu a-t-il été énoncé d'abord par le commercial et seulement approuvé ? | oui / non |
| `atom.object` | Courte étiquette du problème auquel il se rapporte (3 à 6 mots) | texte libre, sert à construire les suites |
| `followed_up` | La sollicitation suivante du commercial reprend-elle un mot ou un nombre de cette réponse ? | calculé par le code (recouvrement lexical des mots pleins de 4 lettres ou plus, hors une liste de mots vides) |

**Règles de décision sur les atomes (code) :**
- Un atome avec `prompted_by_sales = yes` est écarté.
- Un IMPACT dont le domaine est le même que celui du problème est reclassé PAIN (il redécrit le problème).
- Un chiffre de revenu est une SITUATION, jamais un IMPACT : un revenu actuel n'est pas un coût du problème. Seul ce que le problème fait perdre au prospect compte comme IMPACT.
- Une réponse qui ne contient qu'un accord ne produit aucun atome.
- Deux atomes sont **distincts** si leurs citations ne se chevauchent pas et, pour IMPACT, si leurs domaines diffèrent.

**Suites.** Une suite est une série de sollicitations codées consécutives sur le même `atom.object`, ouverte par un P (ou un N du côté du désir) dont la réponse a produit un PAIN ou un BLOCKER. Une suite est **profonde** quand elle contient au moins un I dont la réponse a produit un IMPACT, suivi d'au moins un autre I ou N sur le même objet dont la réponse a produit un IMPACT, un DESIRE ou une VALUE, et que les sollicitations du commercial dans la suite sont `followed_up` sur la réponse précédente.

# 5. Applicabilité

| Situation | Statut SPIN |
|---|---|
| Le périmètre de la découverte existe, avec au moins 5 sollicitations codées | `scored` |
| Appel de relance qui ne fait que rouvrir la découverte, avec moins de 5 sollicitations codées | `not_applicable` |
| Pas de découverte (appel technique, replanification, simple relance) | `not_applicable` |
| Plus de 5 % des sollicitations du périmètre en OUT `absent` | `excluded` (santé) |

# 6. La note SPIN

Cinq items, chacun noté 0, 1 ou 2 à partir des atomes de l'appel. **Note de l'appel = Σ (poids × niveau / 2)**, arrondie à l'entier le plus proche, sur 100.

| Item | Poids | Niveau 0 | Niveau 1 | Niveau 2 |
|---|---|---|---|---|
| D1 Point de départ | 15 | Aucun atome SITUATION lié à l'objectif | Au moins un atome SITUATION lié à l'objectif, non chiffré | Au moins deux atomes SITUATION chiffrés liés à l'objectif (par exemple le chiffre d'affaires actuel et les heures par semaine) |
| D2 Problème | 20 | Aucun atome PAIN ni BLOCKER | Un PAIN ou un BLOCKER distinct | Deux atomes PAIN/BLOCKER distincts ou plus, ou un seul avec sa cause dite par le prospect |
| D3 Implication | 30 | Aucun atome IMPACT | Un atome IMPACT | Deux atomes IMPACT ou plus dans des domaines distincts, dont au moins un chiffré |
| D4 Bénéfice attendu | 20 | Aucun atome DESIRE ni VALUE | Un atome DESIRE (état désiré) | Un atome DESIRE et un atome VALUE (pourquoi cela compte, ce que cela changerait) |
| D5 Profondeur | 15 | Aucune suite profonde | Une suite profonde | Deux suites profondes ou plus sur des objets différents |

« Lié à l'objectif » : l'atome SITUATION porte sur la même dimension qu'un DESIRE dit dans l'appel (chiffre d'affaires, clients, temps, statut professionnel). S'il n'existe aucun DESIRE, tout atome SITUATION chiffré compte.

**Règle des deux citations.** Le niveau 2 demande toujours au moins deux citations distinctes à l'appui. Le niveau 2 de D5 demande les citations des deux suites.

**Pourquoi ces poids.** L'implication pèse le plus (30) parce que c'est l'étape qui transforme un problème énoncé en un coût ressenti ; c'est aussi l'étape qui manque le plus souvent. Le point de départ et la profondeur (15 chacun) sont des appuis. Les poids sont des propositions, à valider.

**Taux par item à l'écran.** Pour chaque item : part des appels notés au niveau 2, part au niveau ≥ 1.

# 7. Comment le système sait que le commercial a réussi

Le système ne décide jamais que « la découverte était bonne » à partir de l'intention du commercial ou du nombre de questions. Il ne conclut à la réussite qu'à partir de faits qu'il peut citer :

1. **Le prospect l'a dit.** Chaque item est appuyé par une citation du prospect, vérifiée mot pour mot dans la transcription (partie C, C3).
2. **Le commercial l'a provoqué.** L'atome est rattaché à une sollicitation du commercial qui l'a précédé dans le périmètre ; un atome donné spontanément par le prospect en dehors de toute question de découverte compte quand même pour D1 à D4 (le prospect l'a dit), mais jamais pour D5.
3. **On ne l'a pas mis dans la bouche du prospect.** Le contenu soufflé est écarté ; un accord seul ne produit rien.
4. **C'est allé en profondeur, pas en largeur.** D5 exige des suites où chaque question reprend la réponse précédente du prospect et va du problème à la conséquence puis à la valeur sur le même objet.
5. **Trois lectures concordent.** Chaque atome et chaque lettre vient de trois passes concordantes ou d'une décision arbitrée (C4).

# 8. Diagnostics d'accompagnement (affichés, jamais notés)

Ces indicateurs expliquent la note ; ils n'y entrent jamais.

| Diagnostic | Calcul | Référence |
|---|---|---|
| Répartition des lettres | Part de S, P, I, N parmi les sollicitations codées S/P/I/N | — |
| Budget de l'appel | S et P : plafond de 2 par appel. I et N : plancher de 3 par appel | Référence SPIN LNP |
| Problème suivi d'une implication | Part des sollicitations P dont la sollicitation codée S/P/I/N suivante est un I | Cible 50 % (à valider) |
| Réponses soufflées | Part des sollicitations du périmètre en OUT `agreement` | Cible ≤ 15 % (à valider) |
| Bénéfice attendu fermé | Nombre d'étiquettes `closed_need_payoff` | Cible 0 |
| Rendement par lettre | Part des sollicitations d'une lettre qui ont produit au moins un atome du type attendu | — |
| Taux de reprise | Part des sollicitations suivies d'une sollicitation du commercial `followed_up` | — |

**Référence observée sur Valentino (85 appels, de juin à octobre 2026) :** S 28 %, P 24 %, I 12 %, N 36 % de 2 033 questions codées ; 2,8 implications par appel ; 23 appels sans aucune question d'implication ; un P suivi d'un I dans 10 % des cas ; 590 questions soufflées (16 % de toutes les questions bornées). Ces chiffres viennent de la couche des lettres et servent de référence de départ pour l'accompagnement, pas de note.

# 8b. Registres des questions (affichés, jamais notés)

Depuis la v1.2, chaque question codée de la découverte, avant le premier début de la présentation de l'offre ou le premier prix, est placée dans un registre :
**Financier** (argent, clients), **Temps et charge** (temps, famille), **Identité et statut** (avenir), **Mental et émotionnel**
(confiance en soi, santé) ou **Autre**. Le modèle nomme le domaine sur lequel porte la question, avec une citation exacte ; le code
le rattache au registre (annexe A, SB-26 à SB-33). Depuis la v1.3, une question ouverte, qui ne nomme aucun des sept
domaines, prend le registre de la réponse que le prospect lui a faite, l'effet qu'elle a produit (SB-35, Romain 2026-10-29). Les questions posées après la présentation de l'offre (qui ne sont pas du SPIN du tout, SB-34), les sollicitations
OUT et les questions hors du périmètre n'ont pas de registre. Le registre dit au commercial quel terrain la découverte a couvert ; il ne produit jamais
de points. Fiabilité visée : ≥ 92 % des questions dans le bon registre (SB-33).

# 9. Exemples commentés
Cas d'illustration, adaptés et raccourcis à partir de vrais appels. En production, chaque preuve est une citation exacte vérifiée sur la transcription.

| Contexte du prospect | Question du commercial | Lettre | Réponse du prospect | Atomes | Effet sur les items |
|---|---|---|---|---|---|
| « J'y mets à peine 15 heures par semaine » | « Et ça, ça t'a touché comment, sur le plan personnel ? » | I (domaine ouvert) | « C'est déprimant. J'ai plus aucune motivation. » | IMPACT (domaine : self_belief) | D3 +1 atome |
| « J'ai perdu mon travail il y a deux ans » | « Ça t'a coûté combien depuis, en argent ? » | I | « Sûrement 40 000, on est endettés maintenant. » | IMPACT (money, chiffré) | D3 chiffré |
| Elle parle de son objectif | « Donc ton objectif, c'est à peu près 10 000 €, c'est ça ? » | OUT agreement, `closed_need_payoff` | « Oui. » | aucun | rien ; compteur du diagnostic +1 |
| Objectif dit : 5 000 € par mois | « Et à 5 000 € par mois, ta vie ressemble à quoi ? » | N | « Je peux arrêter mon boulot administratif et être à la maison pour les enfants. » | DESIRE, VALUE | D4 niveau 2 |
| Heures par semaine dites | « Tu y travailles combien d'heures par semaine ? » | S | « À peu près 15. » | SITUATION (chiffrée) | D1 |
| Problème : pas d'élèves | « C'est plutôt la communication ou les tarifs ? » | OUT sales_list | « La communication. » | aucun (le contenu venait de la liste du commercial) | rien |

# 10. Contrat de sortie

```
{
  "call_id": "…", "competence": "SPIN", "rules_version": "SPIN-1.3",
  "status": "scored",
  "score": 64,
  "items": [
    {"id": "D3", "level": 1, "evidence": [
      {"turn": "T112", "ts": "18:42", "speaker": "PROSPECT",
       "quote": "it's depressing", "atom": "IMPACT", "domain": "self_belief",
       "question_id": "Q111.1", "question_letter": "I"}]}
  ],
  "diagnostics": {"letters": {"S": 9, "P": 6, "I": 2, "N": 8}, "p_followed_by_i": 0.17,
                  "prompted_share": 0.14, "closed_need_payoff": 1},
  "concordance": "3/3", "health": {"absent_share": 0.02},
  "solicitations": [{"id": "Q111.1", "letter": "I", "register": "mental_emotional", "register_status": "verified",
                     "register_basis": "named", "register_domain": "self_belief", "register_quote": "how does that make you feel"}],
  "registers": {"counts": {"financial": 9, "time_load": 3, "identity_status": 2, "mental_emotional": 5, "other": 4},
                "questions": 23, "verified": 22, "to_review": 0, "agreement": 0.957, "threshold": 0.92, "flags": []}
}
```

# 11. Décisions à valider

- Registres (v1.2) : les listes de mots de SB-30. Décidé le 2026-10-27 (Romain) : les sollicitations OUT n'ont pas de registre ; le SPIN s'arrête
  à la présentation de l'offre (SB-34) ; pas d'ensemble de vérification étiqueté à la main pour l'instant.

- Les cinq items et leurs poids (15 / 20 / 30 / 20 / 15).
- Les seuils des diagnostics (P suivi d'un I ≥ 50 %, soufflées ≤ 15 %).
- Si un atome donné sans question doit compter pour D1 à D4 (proposition actuelle : oui) ou seulement les atomes produits par une question.
- Le minimum de 5 sollicitations codées pour qu'un appel soit noté.
- La fin du périmètre au premier début de la présentation de l'offre ou au premier prix, au lieu de la première restitution (changement par rapport à la référence de bornage SPIN v1.0, §6). Raison : sur les 85 appels analysés, les annotateurs n'étaient pas d'accord sur le fait qu'une restitution à deux composants clôt la découverte, ce qui déplaçait la frontière sans changer les questions posées.
---
