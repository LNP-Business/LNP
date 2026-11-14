# 20 · Entraînement › Simulateur

Le simulateur d'appel de vente de LNP (Romain, 2026-11-11) : un prospect joué par Claude, en texte ou à la voix, que le commercial
doit faire avancer de la découverte jusqu'à la décision. Il reprend, fonctionnalité par fonctionnalité, le simulateur décrit par le
kit de réplication fourni (documentation et code source), adapté à LNP : français partout, charte LNP, données dans Supabase, aucun
nom d'une autre entreprise, jamais « closer ».

## 1. Ce que voit la personne

Barre latérale › Entraînement › **Simulateur** (clé d'accès `simulateur`, Paramètres › Accès ; ouverte à qui a déjà un
entraînement). L'écran (`app/training/simulateur.html`, dans un cadre comme Maîtrise de l'offre) a quatre vues :

- **Nouvelle simulation** : l'entraînement (Appel complet, Diagnostic, Objections), l'offre, le prospect (sa difficulté : Moyen,
  Difficile, Expert, vient du prospect), Texte ou Voix, « Lancer la simulation » ; les appels en cours, à reprendre.
- **L'appel** : la fiche du prospect selon le mode, les 7 étapes et 25 critères à cocher, le minuteur de 45 minutes, la conversation
  en flux, la dictée, « Annuler le dernier échange », la voix mains libres (le prospect parle, on peut lui couper la parole),
  « Terminer ». Fin automatique au bout de 2 heures ; une page fermée termine l'appel sans analyse.
- **Fin d'appel** : la note de la simulation (1 à 5 étoiles), l'auto-analyse en quatre questions, puis l'analyse : une note sur 100,
  cinq dimensions (Connexion, Écoute, Exposition, Alignement, Résolution), chaque point avec sa citation, le point fort, le point
  faible, un exercice, la lecture ligne à ligne, les conditions éliminatoires, le miroir de l'auto-analyse et la progression.
- **Historique** : chaque simulation (filtres, tri, recherche, transcription à télécharger, suppression confirmée) ; les
  administrateurs voient celles de toute l'équipe.
- Administrateurs : **Offres et prospects** (créer une offre depuis un texte, un site ou des PDF ; générer, régénérer, désactiver,
  supprimer les prospects ; leur voix) et **Réglages** (modèle du prospect, voix, silence de fin de tour, plafond quotidien d'analyses).

## 2. Comment ça marche

```
Écran (cadre) ── window.claude.use("crm")         → lecture des tables crm_sim_* (RLS : chacun les siennes, l'admin toutes)
              └─ window.claude.use("simulateur")  → fonction Edge `simulateur` (jeton de la personne)
Fonction Edge `simulateur` (supabase/functions/simulateur)
   ├─ moteur d'état du prospect (_shared/simulateur) : confiance 1-10, conscience 0-10, résistance par objection, difficulté
   ├─ à chaque réplique : 2 analyses de signaux (claude-haiku-5-5), puis la réponse du prospect en flux (claude-sonnet-5-5)
   ├─ voix : un tour de parole par réplique (nombres dits en toutes lettres), la voix ElevenLabs si ELEVENLABS_API_KEY existe,
   │         sinon la voix du navigateur (speechSynthesis) ; la reconnaissance vocale est celle du navigateur (fr-FR)
   ├─ fin : l'analyse (grille/) en arrière-plan, plafond quotidien (heure de Paris), file d'attente relancée toutes les 10 min
   └─ offres (offres.ts) : extraction de l'offre (10 modules), matrice de 6 prospects, 6 prospects complets, voix attribuées
Tables : crm_sim_offers, crm_sim_personas, crm_sim_simulations, crm_sim_messages, crm_sim_feedback, crm_sim_analyses,
         crm_sim_config (057) ; l'offre LNP (058) ; l'historique avec la mesure de réalisme (060).
```

Le prospect ne se livre que si on gagne sa confiance : une bonne question ouverte, une reformulation juste ou de l'empathie la font
monter (plafonnée par tour et par fenêtre de 5 tours, ralentie après une faute) ; un prix annoncé trop tôt, de la pression, une
suite de questions fermées ou une mauvaise écoute la font baisser. Ses douleurs ne sortent qu'à certains seuils de confiance et de
nombre de tours. Quand le commercial présente l'offre, le prospect passe aux objections : chacune a une résistance (de 6 à 9 selon la
difficulté) qui baisse avec la méthode Accueillir, Isoler, Challenger et monte avec la pression ; elle ne peut pas tomber avant un
nombre minimal de tours. Les règles et seuils sont ceux de la source, sans changement (`difficulty-config.ts`, `etat/`), vérifiés par
les 18 tests de caractérisation d'origine (`supabase/tests/simulateur_etat.test.ts`).

## 3. Mise en service

1. Base : `web/supabase/057_crm_simulateur.sql` puis `058_crm_simulateur_offre_lnp.sql` (après accord sur la PR).
2. Fonction : déployée par `.github/workflows/crm-functions.yml` (liste des fonctions) depuis `main`.
3. Secrets des fonctions : `ANTHROPIC_API_KEY` (déjà là pour l'analyse d'appel) ; `ELEVENLABS_API_KEY` facultatif (compte LNP). Les
   4 voix (Hugo, Jérémy, Claire, Jade) sont des voix de la bibliothèque ElevenLabs : les ajouter au compte LNP si elles n'y sont pas.
4. Un administrateur ouvre Simulateur › Offres et prospects et lance « Générer les prospects » sur l'offre LNP.

## 4. Fidèle, adapté, écarté

Fidèle à la source : modes, difficultés, moteur d'état et ses seuils, prompts du prospect et des analyses (verbatim, neutralisés),
fenêtre de 60 messages (30 à l'origine, voir § 5), annulation du dernier échange, fin par la page fermée, plafond et file des analyses, chaîne et moteur de la
grille d'analyse, auto-analyse et miroir, note de la simulation, génération des offres et des prospects, attribution des voix,
textes de l'écran (traduits en français correct quand la source était en anglais ou sans accents).

Adapté (avec raison) :
- modèles actuels (`claude-sonnet-5-5`, `claude-haiku-5-5`) : ceux de la source sont retirés le 2026-11-30 ; pas de température
  (refusée par l'API) ;
- la voix mains libres passait par un agent vocal externe configuré hors du code (non exporté) : elle est refaite dans le navigateur
  (reconnaissance vocale, fin de tour au silence réglable, coupure de parole) avec le même tour de parole côté serveur ;
- les routes vérifient toutes le jeton de la personne (le point d'entrée vocal d'origine n'était pas protégé) ;
- les rôles du transcript de l'analyse sont toujours « COMMERCIAL / PROSPECT » (la source pouvait les inverser) ;
- la difficulté des prospects générés est enregistrée en `moyen` / `difficile` / `expert` (la source enregistrait 2, 4, 5 et
  affichait toujours « Moyen ») ;
- les données de l'offre lues par le prospect (entreprise, promesse, prix, durée, financements) sont remplies (la source ne les
  trouvait jamais et prenait des valeurs par défaut) ;
- l'auto-analyse n'est plus effacée par la fin de l'analyse ; le mode objections démarre sur sa première étape visible.

Écarté (hors simulateur) : Bootcamp, recrutement, pilotage, CRM et analytique de la source, débogage, envoi du rapport par e-mail.

Non vérifié ici : les réponses réelles du modèle et de la voix (aucun appel réel pendant le portage, les tests simulent le modèle),
l'accès aux voix ElevenLabs depuis le compte LNP, les temps de réponse en production.

## 5. Référentiel v0.13 : un prospect qui parle comme dans les vrais appels (Romain, 2026-11-14)

Constat : le prospect simulé parlait très peu (réponses de 5 à 15 mots, aucune question), loin des vrais appels de vente. Les 549 appels
R1 de LNP enregistrés par Fathom de mai à novembre 2026 (10 minutes ou plus) donnent la référence, identique pour les ventes conclues et
perdues :

| Mesure (vrais appels)                         | Valeur                         |
|-----------------------------------------------|--------------------------------|
| Part de parole du prospect                    | 46 % des mots (37 à 56 %)      |
| Répliques par appel                           | 134, dont 67 du prospect       |
| Mots par réponse du prospect                  | 55 en moyenne, 26 en médiane   |
| Réponses du prospect de plus de 80 mots       | 20 % (environ 14 par appel)    |
| Réponses du prospect avec une question        | 1 sur 4 (18 questions par appel) |
| Part de parole au début, pendant la présentation, aux objections | 67 %, 34-38 %, 44-45 % |

Ce qui change (`VERSION_REFERENTIEL_SIMULATION = "v0.13"`, gardé sur chaque simulation) :
- **Longueurs calibrées** (`build-gated-prompt.ts`, `build-gated-objections-prompt.ts`) : 55 mots par réponse en moyenne ; au début
  le prospect raconte sa situation (80 à 200 mots) ; question fermée 5 à 15 mots, factuelle 20 à 50, ouverte 30 à 80, profonde 100 à
  250 ; pendant la présentation 10 à 40 ; objections 30 à 80, un récit de 100 à 200 quand le commercial creuse.
- **Des questions** : environ une réponse sur quatre en contient une (pratique, sur l'offre, sur le commercial) ; l'ancienne
  interdiction (« tu ne poses jamais de question ») est retirée.
- **La difficulté joue sur le contenu, plus sur la longueur** : un prospect fermé parle autant mais ne livre rien d'utile (vague,
  généralités, digressions) ; les plafonds « MAX 20 mots », « MAX 2 phrases » des blocs de confiance, de difficulté et PCM sont
  retirés. Un prospect difficile se contredit une fois dans l'appel, un expert deux fois (116 contradictions relevées sur 71 vrais
  appels qualifiés).
- **Loquacité** (`persona.loquacite` : bref, moyen, bavard) : attribuée à la génération (deux bavards, trois moyens, un bref sur six),
  modifiable par un administrateur dans le tableau des prospects (`PATCH personas/:id {loquacite}`). Les prospects déjà générés sont
  « moyen » tant qu'on ne les change pas.
- **Ce que le prospect sait de l'offre** : les sections `prospect_already_knows`, `prospect_unclear_about` et les mots des prospects
  de l'extraction de l'offre entrent dans le prompt (avant, le prospect ne savait rien de l'offre et ne pouvait pas poser de question
  dessus).
- **Style oral** en texte aussi (hésitations, phrases qui repartent), pas de didascalie.
- `maxTokens` 900 (300 avant), fenêtre d'historique 60 messages (30 avant) pour tenir un appel de 130 répliques.
- **Mesure de réalisme** (`realisme.ts`) : à la fin de chaque simulation, les quatre mesures ci-dessus sont calculées sur la
  conversation et comparées aux cibles ; une note sur 100 et les écarts en français sont gardés dans `crm_sim_simulations.usage.realisme`
  et rendus par `crm_sim_history` (060). L'historique affiche « réalisme N % », la page de résultat une carte « Réalisme de la
  simulation » (cette simulation contre les vrais appels). Les simulations d'avant v0.13 n'ont pas de mesure.

Tests : `supabase/tests/simulateur_realisme.test.ts` (mesure, prompts), `web/supabase/tests/simulateur_test.sql` (historique),
`app/training/simulateur_test.js` (colonne Loquacité, réalisme à l'écran). Non vérifié ici : le comportement réel du modèle avec les
nouvelles consignes ; la mesure de réalisme des premières simulations en production dira si les cibles sont atteintes.

