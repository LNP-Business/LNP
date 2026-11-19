# Consigne de reprise à donner à Claude Code

Document historique : c'est le texte qui a servi à lancer l'intégration de l'analyse d'appel dans l'application (octobre 2026 ;
le plan qui en est sorti est `PLAN.md`). Il s'appelait `HANDOFF_PROMPT.md`. Les chemins ont été mis à jour le 2026-11-19 : le
dossier s'appelle `analyse-appel/` (alors `call-analysis/`), le moteur `moteur/` (alors `engine/`), et les documents ont des
noms français. Le nombre de tests (182) est celui de l'époque.

Copier ce dossier (alors livré sous le nom `lnp-call-analysis/`) dans le dépôt de l'application (par exemple sous
`analyse-appel/`), ouvrir Claude Code à la racine du dépôt, et coller la consigne ci-dessous.

---

Tu intègres dans cette application le système d'analyse des appels de vente de LNP. Tout ce dont tu as besoin est dans
`analyse-appel/` (adapte le chemin si le dossier a été copié ailleurs).

**À lire d'abord, dans cet ordre, avant d'écrire la moindre ligne de code :**
1. `analyse-appel/CLAUDE.md` (les règles qui priment sur tout ; recopie son contenu dans le CLAUDE.md du dépôt, sous une
   section « Analyse d'appel ») ;
2. `analyse-appel/docs/ARCHITECTURE.md` ;
3. `analyse-appel/docs/INDEX_DES_BORNES.md`, puis pour chaque compétence les trois fichiers
   `docs/methodologie/0N_<competence>_A_notation.md`, `_B_regles_de_bornage.md`, `_C_cas_de_calibration.md`, et
   `docs/methodologie/00_regles_communes_partie_C.md` ;
4. `analyse-appel/docs/CONTRAT_DE_SORTIE.md`, `docs/SPEC_ECRAN.md` (et la maquette `docs/screen/call_analysis_mockup.dc.html`),
   `docs/DECISIONS_OUVERTES.md` ;
5. le code du moteur dans `analyse-appel/moteur/` et ses tests.

Ensuite, examine ce dépôt (technologies, base de données, écran actuel de la fiche du prospect, tâches de fond,
authentification, manière dont arrivent les enregistrements ou les transcriptions des appels) et **écris un plan dans
`analyse-appel/PLAN.md` avant de coder** : les fichiers que tu vas ajouter ou modifier, les tables de la base, le déroulé du
travail d'analyse, les composants de l'écran et les questions ouvertes. Arrête-toi et montre-moi le plan. Ne commence pas la
phase 2 avant que je l'aie approuvé.

**Objectif.** Pour chaque appel de vente qui a une transcription, l'application lance l'analyse, enregistre l'enregistrement
de l'appel, affiche l'écran d'analyse d'appel dans la fiche du prospect et alimente l'écran de performance (périodes 7 jours /
ce mois-ci / depuis le début).

**Phases (une pull request par phase, tests verts à chaque étape) :**
1. **Moteur en place.** Ajouter le moteur comme paquet ou comme service, selon ce qui convient aux technologies de ce dépôt
   (garder la référence Python si un exécutant Python est possible ; sinon le porter module par module, en gardant chaque
   identifiant de règle en commentaire et en portant les 182 tests avec lui : le portage n'est accepté que lorsque tous les
   tests passent). Lancer les tests.
2. **Données.** Des tables pour : les appels (métadonnées, rang, identifiant du cycle, commercial, prospect, début en UTC,
   fuseau horaire, statut), les tours (réparés, avec leurs identifiants et leurs horodatages), les résultats d'appel (une
   ligne par appel × compétence : version des règles, statut, verdict, raisons, note, items avec leurs preuves, détails JSON),
   l'audit (chaque passe du modèle, chaque arbitrage, chaque correction humaine), la référence d'offre (versionnée), la
   bibliothèque de cas (avec l'accord du client et le point de départ). Une sécurité par ligne cohérente avec l'application.
3. **Arrivée des transcriptions et travail d'analyse.** Quand une transcription arrive (dépôt par « Ajouter une
   transcription » ou par l'intégration d'enregistrement que l'application utilise déjà), faire correspondre les intervenants
   à SALES (le commercial) / PROSPECT / OTHER (demander à la personne quand la correspondance est ambiguë), enregistrer les
   tours, mettre le travail d'analyse en file. Le travail exécute la chaîne d'analyse dans l'ordre fixe, avec trois passes par
   unité, les unités d'une même étape en parallèle, de nouveaux essais en cas d'erreur, et enregistre l'enregistrement de
   l'appel. Les identifiants de modèle par palier viennent de la configuration ; la clé API, du coffre des secrets.
4. **Écran d'analyse d'appel** dans la fiche du prospect, exactement comme le décrit `docs/SPEC_ECRAN.md`, avec les composants
   et les jetons de design de l'application : en-tête, ligne de l'appel avec la durée, quatre tuiles de note, carte horizontale
   de l'appel, tiroir de la transcription, les quatre sections (tableau de la découverte par domaine avec les pastilles
   S/P/I/N ; barre de temps de l'écart, texte mot pour mot annoté de la restitution en entier, quatre contrôles de validité,
   tableau des composantes ; conformité de la présentation de l'offre, escalier, texte mot pour mot annoté de la présentation
   en entier ; tableau des objections avec A·I·E·M cliquables qui ouvrent les tours exacts). Chaque nombre ouvre ses preuves.
5. **Écran de performance** : agrégation par période (`noyau/agregation.py`) par commercial et par compétence, goulot
   d'étranglement, taux par item, mention « provisoire ».
6. **Banc de calibration** : une commande qui rejoue chaque cas de calibration (fichiers de l'annexe C) avec le vrai modèle et
   donne la concordance par règle ; un rapport de reproductibilité (trois passes) par item ; une vue de la file des arbitrages
   (`rule_ambiguity`, `uncovered_case`) pour le responsable de la méthodologie.

**Règles non négociables** (tirées du CLAUDE.md) : le modèle cite, le code décide ; chaque citation vérifiée ; trois passes et
un arbitrage ; rien d'inventé (entrées métier manquantes → configuration + signal + `DECISIONS_OUVERTES.md`) ; jamais
« closer », toujours « le commercial » ; aucun secret ni aucune transcription personnelle dans le dépôt ou dans les journaux ;
la méthodologie l'emporte sur le code.

**Me demander avant :** de choisir les identifiants de modèle ; tout changement de règle, de poids ou de seuil ; de supprimer
ou de migrer des données existantes ; tout ce qui figure dans les sections A et B de `docs/DECISIONS_OUVERTES.md`.

**Critères de recette :**
- les 182 tests du moteur passent dans la CI, plus de nouveaux tests pour l'enregistrement, le travail d'analyse et l'écran ;
- un vrai appel traité de bout en bout avec le vrai modèle, l'enregistrement de l'appel stocké, l'écran affiché avec des
  preuves qui mènent, d'un clic, à la transcription ;
- le banc de calibration tourne sur les cas de l'annexe C et affiche la concordance par compétence ;
- chaque note affichée porte la version de ses règles et la mention « provisoire » tant que les seuils de la Partie C (C7) ne
  sont pas atteints.
