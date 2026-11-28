#!/usr/bin/env bash
# LNP · réplication, étape 4 : déployer les 10 fonctions Edge, régler l'authentification et créer le seau de stockage.
# Usage (depuis la racine du dépôt) : docs/replication/scripts/04-fonctions-auth-stockage.sh <organisation/dépôt> <réf> <adresse du site>
# Prérequis : étapes 1 à 3 faites (code poussé, base créée, secrets saisis) ; gh connecté ; curl, jq.
set -euo pipefail
REPO=${1:?organisation/dépôt}; REF=${2:?réf du projet Supabase}; SITE=${3:?adresse du site}; SITE=${SITE%/}
if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then read -rsp "Jeton personnel Supabase : " SUPABASE_ACCESS_TOKEN; echo; fi
API="https://api.supabase.com/v1/projects/$REF"; H=(-H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json")

echo "== Fonctions Edge : workflow « CRM functions » sur main (tests, puis déploiement des 10 fonctions)"
gh workflow enable crm-functions.yml --repo "$REPO" >/dev/null 2>&1 || true
gh workflow run crm-functions.yml --repo "$REPO" --ref main
sleep 8
id=$(gh run list --repo "$REPO" --workflow crm-functions.yml --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$id" --repo "$REPO" --exit-status || { echo "Le workflow a échoué : gh run view $id --repo $REPO --log-failed"; exit 1; }

echo "== Authentification : adresse du site, redirections, inscription libre fermée (les comptes se créent par invitation)"
jq -n --arg s "$SITE" '{site_url: $s, uri_allow_list: ($s + "/**"), disable_signup: true}' |
  curl -sS -f -o /dev/null -X PATCH "$API/config/auth" "${H[@]}" --data-binary @- && echo "   réglée"

echo "== Stockage : seau privé callqa-fixtures (jeu de référence de la mesure de l'analyse d'appel)"
echo "insert into storage.buckets (id, name, public) values ('callqa-fixtures', 'callqa-fixtures', false) on conflict (id) do nothing" |
  jq -Rs '{query: .}' | curl -sS -f -o /dev/null -X POST "$API/database/query" "${H[@]}" --data-binary @- && echo "   créé"

echo "== Worker d'analyse d'appel : workflow « Call analysis » (il tourne ensuite seul, toutes les heures à la minute 7)"
gh workflow enable call-analysis.yml --repo "$REPO" >/dev/null 2>&1 || true
gh workflow enable qualification.yml --repo "$REPO" >/dev/null 2>&1 || true
echo "Suite : Vercel (chapitre 07, § 4), puis le premier administrateur (§ 5)."
