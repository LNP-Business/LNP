#!/usr/bin/env bash
# LNP · réplication, étape 1 : mettre le code dans le nouveau dépôt GitHub, avec tout l'historique et toutes les branches.
# Usage : ./01-pousser-le-code.sh <lnp.bundle> <organisation/dépôt>
# Le dépôt doit exister et être vide (GitHub › New repository, privé conseillé, sans README).
# Rien de secret ici : l'authentification Git est celle du poste (gh auth login ou clé SSH).
set -euo pipefail
BUNDLE=${1:?chemin du paquet lnp.bundle}; DEST=${2:?organisation/dépôt sur GitHub}
DIR=$(mktemp -d)/LNP
git clone -q "$BUNDLE" "$DIR" -b main
cd "$DIR"
# Toutes les branches du paquet deviennent des branches locales, puis on pousse tout.
for b in $(git for-each-ref --format='%(refname:short)' refs/remotes/origin | grep -v '^origin/HEAD$' | sed 's#^origin/##'); do
  git show-ref -q --verify "refs/heads/$b" || git branch -q "$b" "origin/$b"
done
git remote set-url origin "https://github.com/$DEST.git"
git push -u origin --all
echo
echo "Code poussé sur https://github.com/$DEST (branches : $(git branch --format='%(refname:short)' | tr '\n' ' '))"
echo "Empreintes à comparer au chapitre 10 :"
sha256sum app/lnp.html web/public/index.html
# Le dossier de réplication (chapitres, scripts, configuration) est sur dossier-replication = main + docs/replication :
# le code de l'application y est identique à celui de main, les scripts suivants se lancent depuis cette branche.
git checkout -q dossier-replication
echo "Copie de travail : $DIR (branche dossier-replication ; lancer les scripts 02 à 05 depuis ce dossier)"
