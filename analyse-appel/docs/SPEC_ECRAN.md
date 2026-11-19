# Écran d'analyse d'appel · spécification

Maquette de référence : `docs/screen/call_analysis_mockup.dc.html` (construite sur le vrai appel 001, Jennifer S., avec des
notes d'illustration). C'est une référence de dessin, pas du code de production : la refaire avec les composants de
l'application.

**Périmètre.** Un écran = l'analyse d'UN appel. Ce n'est pas une vue du CRM : pas de cycle de vente, pas de statut de
paiement, pas de prochaine action, pas de note du commercial, pas d'onglet « Prochain appel ». L'écran vit dans la fiche du
prospect de l'application et reprend son langage visuel (voir Jetons de design).

## 1. Disposition, de haut en bas

| Bloc | Contenu | Source des données (enregistrement de l'appel, voir CONTRAT_DE_SORTIE.md) |
|---|---|---|
| En-tête du prospect | Initiale dans l'avatar, nom du prospect, puce de statut (« Appel honoré »), nom du client, nom du commercial, puce du tour (R1, R2…), menu Statut, bouton de fermeture | Fiche du prospect de l'application (existante) |
| Ligne de l'appel | Icône de téléphone · puce `R1 · 18/06/2026 15:00 · 62 min · passé` · `1 appel` | Métadonnées de l'appel : tour, heure de début dans le fuseau horaire du commercial, durée = horodatage du dernier tour |
| Ligne de titre | « Analyse d'appel » + bouton « Ajouter la transcription » | — |
| Carte d'en-tête de l'analyse | Titre `Analyse d'appel — <prospect>` · bouton « Transcription » (ouvre et ferme le tiroir de la transcription) · quatre tuiles de note (1 Découverte, 2 Écart, 3 Présentation, 4 Objections) : note /100 + puce de niveau (Maîtrisé ≥ 85, En progrès 60 à 84, À travailler < 60, ou Non conforme / Écart absent / Sans objet / Exclu) · la tuile la plus basse est marquée « goulot » · mention « provisoire » tant que les seuils de fiabilité ne sont pas atteints | `results.<COMP>.score`, `.status`, `.verdict` |
| Carte de l'appel | Chronologie horizontale, un repère par ancre, de gauche à droite, chacun avec son horodatage, son libellé et son numéro de tour : Début de la découverte · Restitution de l'écart (début → fin, durée) · Validation · Début de la présentation · Premier prix · Objection (une par épisode) · Décision. Défile horizontalement sur les petits écrans | `phases.*`, `results.GAP.details` (plage de la restitution, tour de validation), `results.OBJECTIONS.details.episodes[].start`, demande de décision |
| Tiroir de la transcription | S'ouvre sous la carte d'en-tête : les tours autour de la preuve choisie, surlignés | `turns[]` |
| 1 · La découverte | Voir § 2.1 | `results.SPIN` |
| 2 · L'écart restitué | Voir § 2.2 | `results.GAP` |
| 3 · La présentation | Voir § 2.3 | `results.PITCH` |
| 4 · Objections | Voir § 2.4 | `results.OBJECTIONS` |

## 2. Sections

### 2.1 La découverte (SPIN)
- Sous-titre : début → fin du périmètre (horodatages), nombre de questions codées, « lu dans ce que le prospect a dit, jamais dans la lettre ».
- Tableau, une ligne par **domaine** des atomes du prospect (argent, temps, clients, famille, santé, confiance en soi, avenir ; plus une dernière ligne « Hors SPIN ») :
  - nom du domaine, carré de couleur, citations clés du prospect pour ce domaine ;
  - **Questions posées, dans l'ordre** : une puce par sollicitation (S vert, P orange, I rouge, N noir). Puce pleine = la question a produit un atome ; puce en pointillés = sans effet ; puce hachurée = OUT (hors SPIN). Sous les puces : le décompte, les chaînes ;
  - barre **Douleur · Désir** : nombre d'atomes PAIN/BLOCKER/IMPACT (douleur, blocage, impact ; à gauche, rouge) face aux atomes DESIRE/VALUE (désir, valeur ; à droite, or) ;
  - puce **État** : Absent, Effleuré, Quantifié, Profond (une chaîne profonde sur ce domaine), Valeur exprimée, Hors SPIN (« aucun point »).
- Ligne de légende. Les niveaux des items D1 à D5 peuvent s'afficher au survol ou dans un détail dépliable.

### 2.2 L'écart restitué
- Puce de statut : `Écart présent` (vert) ou `Écart absent · <raison principale>` (rouge).
- Sous-titre : « Problème et coût restitués d'un seul tenant, avec les mots exacts du prospect, validés par le prospect, avant la présentation et le prix. »
- **Chronologie de l'écart** : une barre proportionnelle sur l'appel (0 → fin) qui montre la découverte, la plage de la restitution (début → fin, durée, nombre de tours du commercial), la marque de la validation, le début de la présentation, le premier prix ; légende avec les horodatages.
- **Ce que le commercial a dit · verbatim exact** : le texte complet du ou des tours de restitution, sans retouche, avec chaque passage évalué surligné et étiqueté : ses mots exacts (vert), paraphrase (rouge, ne compte pas), cadrage propre au commercial (orange, ne compte pas), pas son chiffre (gris), demande de validation (bleu). En dessous, le tour de validation du prospect, avec la puce de son issue (confirmé / confirmé avec contenu / corrigé / rejeté / aucune).
- **Quatre contrôles de validité**, chacun ✓ ou ✗ avec une justification d'une ligne : D'un seul tenant (GB-34) · Avant la présentation et le prix · Problème + coût mot pour mot (GB-22) · Validé (GB-8 à GB-10).
- **Tableau des composantes** : Composante · Ce que le prospect a dit (citation + horodatage) · Ce que le commercial a restitué (citation) · Mot pour mot (oui / non · raison).
- Ligne de la matière pour la feuille de route : nombre d'autres blocages relevés dans les réponses P ou I ; avertissement du Copilote quand il y en a moins que d'étapes de la feuille de route.

### 2.3 La présentation
- Puce de statut : `Conforme` ou `Non conforme · <raison>` (présentation avant le oui / hors de son écart ou de l'offre / promesse de résultat).
- Sous-titre : blocage validé (citation) → catégorie → mécanisme attendu.
- Puces de conformité : ✓/✗ pour chaque chose interdite, avec la citation et le tour en cause ; puces `?` pour les affirmations qui n'ont pas pu être vérifiées (référence de l'offre manquante).
- **Escalier** : cinq cases — Étape 1 Blocage, Étape 2 Mécanisme, Étape 3 A → B, Étape 4 Preuve, Puis feuille de route — chacune avec son état (fait / paraphrasé / récitation / partiel / manquant / sans objet / prix d'abord) et une courte raison.
- **Verbatim complet de la présentation** : chaque tour depuis le début de la présentation jusqu'au premier prix (commercial et prospect, les tours du prospect sur fond gris), dans une boîte qui défile (au plus ~620 px), chaque tour avec son horodatage, son numéro de tour et son locuteur, les passages évalués surlignés et étiquetés (étapes, récitation, promesse de résultat, affirmations à vérifier, points de contrôle, adhésion, prix).

### 2.4 Objections
- Tableau, une ligne par épisode : Résistance (thème + puce de résolution : résolue / accueillie / persistante / latente) · Mots du prospect · Nature (objection / anxiété · capacité / anxiété · choix / inertie) · Moment de l'appel (position sur une barre 0 → fin avec l'horodatage) · puces **A · I · E · M**.
- **Les puces A · I · E · M sont des boutons.** A = accueillie, I = isolée, E = explorée, M = geste de réponse adapté. Vert = fait, rouge en pointillés = pas fait, or = partiel. Un clic sur une lettre ouvre, sous le tableau, un panneau avec : le nom du geste, la puce de son verdict, une justification d'une ligne qui cite la règle (OB-13, OB-14, OB-15/OB-20, OB-16/OB-21), et les tours exacts qui le prouvent (horodatage, numéro de tour, locuteur, passage clé surligné). Un nouveau clic sur la même lettre referme le panneau ; la lettre choisie est entourée d'un anneau.
- Tuiles de la prévention : Circuit de décision · Budget et échéance · Tentative passée, chacune avec son état et sa citation (avant le premier prix).

## 3. États

| État | Affichage |
|---|---|
| Compétence `not_applicable` | La tuile affiche « Sans objet » et la raison (pas de présentation, pas de résistance) ; section repliée avec la raison |
| Compétence `excluded` | Tuile « Exclu · diarisation douteuse » ; sections masquées ; bandeau qui explique pourquoi |
| Compétence `to_review` | Tuile « À revoir » ; la section montre ce qui est en attente |
| Écart absent | Note 0, puce rouge avec la raison principale ; le panneau de restitution montre quand même chaque candidate et pourquoi elle a échoué (diagnostics) |
| Présentation non conforme | Note 0, puce rouge ; les items restent affichés comme diagnostics (« note brute » au survol) |
| Provisoire | Petite mention rouge « provisoire » dans la carte d'en-tête tant que les seuils de la Partie C (C7) ne sont pas atteints |

## 4. Jetons de design (d'après la fiche du prospect de l'application)

- Fond `#F6F4EE`, cartes `#FFFFFF` avec bordure `#E7E2D6`, rayon 12 px ; encre `#1E1C17` ; atténué `#6B675C`.
- Or `#D9A93F` (accent, puces `#FBF1DA` / texte `#8A6417`) ; rouge `#B42318` ; vert `#2E7D4F` ; bleu `#2F5DA8` ; orange `#C2571A`.
- Titres : Source Serif 4 (600 à 700). Texte courant : IBM Plex Sans. Horodatages et identifiants : IBM Plex Mono.
- Numéros de section dans de petits carrés dorés ; légendes en capitales espacées pour les en-têtes de tableau.
- Préférer les composants et les jetons existants de l'application à ces valeurs quand ils diffèrent.
