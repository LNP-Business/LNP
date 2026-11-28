# Prompt à donner à Claude Code pour faire la réplication

Ce fichier contient le texte à coller dans Claude Code (terminal, application de bureau ou claude.ai/code), ouvert sur le
**nouveau dépôt**, sur la branche `dossier-replication`, une fois le code poussé (`docs/replication/scripts/01-pousser-le-code.sh`).
Cette branche est `main` (la version en production) plus le dossier `docs/replication/` : le code de l'application y est
identique, et c'est `main` qui est déployé. Claude Code suit alors le
dossier pas à pas, lance les scripts, vérifie chaque étape et s'arrête pour toute action qui demande une personne.

Remplacer les quatre valeurs entre chevrons avant de coller. Aucune clé ne se met dans ce prompt : les scripts demandent les
secrets au clavier, sans les afficher.

---

```text
Tu vas répliquer à l'identique l'application LNP (outil commercial de Les Nouveaux Profs) dans une nouvelle installation.
Ce dépôt en est la copie complète ; tout est décrit dans docs/replication/ (commence par README.md, puis 01, puis 07).

Nouvelle installation :
- dépôt GitHub : <organisation/dépôt>
- projet Supabase (neuf, région eu-central-1, Postgres 17) : réf. <réf du projet>
- adresse du site Vercel : <https://adresse-du-site>
- e-mail du premier administrateur : <e-mail>

Règles, à respecter du début à la fin :
1. Lis CLAUDE.md, puis docs/replication/README.md, 01, 07, 08 et 10 avant toute action. Ouvre 02 à 06, 09 et 11 au besoin.
2. Ne lance JAMAIS ./build.sh : app/lnp.html fait foi et serait effacé (chapitre 06).
3. Ne demande jamais une clé, un jeton ni un mot de passe dans la conversation, et n'en écris aucun dans un fichier, un commit,
   un journal ou une commande que tu affiches. Les scripts docs/replication/scripts/0*.sh les demandent au clavier : quand une
   étape en a besoin, dis-moi quel script lancer moi-même dans mon terminal, avec quels arguments, puis attends mon retour.
4. N'utilise que les comptes de la nouvelle installation. Ne touche jamais au projet Supabase, au site Vercel ni au dépôt de la
   production LNP (leurs adresses figurent dans la documentation à titre d'information seulement).
5. Aucune donnée de la production ne se copie : ni prospects, ni transcriptions, ni analyses, ni comptes (chapitre 07, § 9).
6. Tout ce qu'une personne lit dans l'application reste en français ; ne change aucun texte, aucun prompt envoyé au modèle
   (chapitre 11 : ils restent tels quels, en anglais pour l'analyse d'appel), aucune règle. La réplique doit être identique.
7. Après chaque étape, vérifie avec la commande indiquée au chapitre 10 et montre-moi le résultat. Si un contrôle échoue,
   arrête-toi, explique l'écart et propose une correction avant d'aller plus loin.
8. Ne crée ni ne modifie aucun fichier du dépôt, sauf si je te le demande. Ne pousse rien sans me le demander.

Déroulé (chapitre 07) :
A. Vérifie le code : main et dossier-replication ne diffèrent que par docs/replication (git diff --stat main), empreintes de app/lnp.html et web/public/index.html (chapitre 10), recherche de clés.
   Lance les tests qui ne demandent aucun compte : node app/crm/data.test.js ; cd web && npm ci && npm test ; les tests Python de
   call-analysis (engine, lite, worker, qa) ; deno test --allow-env --allow-read supabase/tests si Deno est installé ;
   web/supabase/tests/run.sh si un Postgres 16 local est disponible. Résume les résultats.
B. Base : fais-moi lancer docs/replication/scripts/02-base-de-donnees.sh <réf> <adresse du site>. Contrôle ensuite les
   compteurs attendus (53 tables, RLS partout, 1 vue, 11 déclencheurs, 11 tâches planifiées, 17 réglages).
C. Secrets : fais-moi lancer docs/replication/scripts/03-secrets.sh <organisation/dépôt> <réf>. Explique-moi avant, pour chaque
   secret, où l'obtenir dans le compte du service (chapitres 04 et 08) et lesquels sont facultatifs.
D. Fonctions, authentification, stockage : fais-moi lancer docs/replication/scripts/04-fonctions-auth-stockage.sh
   <organisation/dépôt> <réf> <adresse du site>, puis vérifie que les 10 fonctions sont actives.
E. Vercel (chapitre 07, § 4) : guide-moi écran par écran (Root Directory web, Framework Other, aucune commande de build, les
   variables SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SITE_URL et, le temps du premier administrateur,
   BOOTSTRAP_TOKEN). Je saisis les valeurs moi-même.
F. Premier administrateur (§ 5) : donne-moi la commande curl de /api/bootstrap à lancer moi-même, puis rappelle-moi de
   supprimer BOOTSTRAP_TOKEN et de redéployer.
G. Outils externes (§ 6, chapitre 04) : pour iClosed, WhatsApp Business, les funnels, Whop et Slack, donne-moi l'adresse exacte
   du webhook de la nouvelle installation et où la saisir chez l'outil. Les imports d'historique se font d'abord à blanc.
H. Analyse d'appel (§ 7, chapitre 09) : vérifie les secrets GitHub, lance une fois le workflow « Call analysis » (tâche worker)
   et explique-moi comment reconstituer un jeu de référence pour la mesure.
I. Vérification finale : fais-moi lancer docs/replication/scripts/05-verifier.sh <réf> <adresse du site>, puis déroule avec
   moi la liste du chapitre 10 (écrans à ouvrir, tests d'écrans Playwright sur app/lnp.html). Termine par un tableau :
   chaque point du chapitre 10, réussi / écart / non fait, avec la raison.
```

---

## Prompts de suivi utiles

À coller dans la même conversation, au besoin :

- « Montre-moi l'état de chaque point du chapitre 10, sans rien modifier. »
- « Un webhook iClosed de test vient d'être envoyé : vérifie dans `crm_webhook_log` et `crm_events` qu'il a été traité, sans
  afficher de donnée personnelle. »
- « Le workflow Call analysis a échoué : lis son journal (`gh run view --log-failed`) et explique la cause, sans relancer. »
- « Compare le schéma de la nouvelle base aux fichiers `web/supabase/0*.sql` (tables, colonnes, politiques RLS, fonctions,
  tâches planifiées) et liste les écarts. »

Pour faire évoluer l'application ensuite, `CLAUDE.md` reste la carte « où changer quoi » ; les règles du moteur d'analyse
d'appel sont dans `call-analysis/CLAUDE.md`.
