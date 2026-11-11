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
         crm_sim_config (055) ; l'offre LNP (056).
```

Le prospect ne se livre que si on gagne sa confiance : une bonne question ouverte, une reformulation juste ou de l'empathie la font
monter (plafonnée par tour et par fenêtre de 5 tours, ralentie après une faute) ; un prix annoncé trop tôt, de la pression, une
suite de questions fermées ou une mauvaise écoute la font baisser. Ses douleurs ne sortent qu'à certains seuils de confiance et de
nombre de tours. Quand le commercial présente l'offre, le prospect passe aux objections : chacune a une résistance (de 6 à 9 selon la
difficulté) qui baisse avec la méthode Accueillir, Isoler, Challenger et monte avec la pression ; elle ne peut pas tomber avant un
nombre minimal de tours. Les règles et seuils sont ceux de la source, sans changement (`difficulty-config.ts`, `etat/`), vérifiés par
les 18 tests de caractérisation d'origine (`supabase/tests/simulateur_etat.test.ts`).

## 3. Mise en service

1. Base : `web/supabase/055_crm_simulateur.sql` puis `056_crm_simulateur_offre_lnp.sql` (après accord sur la PR).
2. Fonction : déployée par `.github/workflows/crm-functions.yml` (liste des fonctions) depuis `main`.
3. Secrets des fonctions : `ANTHROPIC_API_KEY` (déjà là pour l'analyse d'appel) ; `ELEVENLABS_API_KEY` facultatif (compte LNP). Les
   4 voix (Hugo, Jérémy, Claire, Jade) sont des voix de la bibliothèque ElevenLabs : les ajouter au compte LNP si elles n'y sont pas.
4. Un administrateur ouvre Simulateur › Offres et prospects et lance « Générer les prospects » sur l'offre LNP.

## 4. Fidèle, adapté, écarté

Fidèle à la source : modes, difficultés, moteur d'état et ses seuils, prompts du prospect et des analyses (verbatim, neutralisés),
fenêtre de 30 messages, annulation du dernier échange, fin par la page fermée, plafond et file des analyses, chaîne et moteur de la
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
