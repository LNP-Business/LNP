#!/usr/bin/env bash
# LNP · réplication, étape 2 : créer le schéma (les 62 migrations dans l'ordre), puis charger la configuration de la production.
# Usage (depuis la racine du dépôt) : docs/replication/scripts/02-base-de-donnees.sh <réf du projet> <adresse du site>
#   ex. : docs/replication/scripts/02-base-de-donnees.sh abcdefghijklmnopqrst https://lnp-copie.vercel.app
# Le jeton personnel Supabase (Account › Access Tokens) est demandé au clavier : il n'est ni affiché ni enregistré.
# Prérequis : curl, jq. Le projet Supabase doit être neuf (aucune table crm_*).
set -euo pipefail
REF=${1:?réf du projet Supabase}; SITE=${2:?adresse du site, sans / final}; SITE=${SITE%/}
[ -f web/supabase/001_init.sql ] || { echo "Lancer depuis la racine du dépôt."; exit 1; }
if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then read -rsp "Jeton personnel Supabase : " SUPABASE_ACCESS_TOKEN; echo; fi
API="https://api.supabase.com/v1/projects/$REF"
H=(-H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json")
sql() { jq -Rs '{query: .}' | curl -sS -f -X POST "$API/database/query" "${H[@]}" --data-binary @-; }
migre() { jq -Rs --arg n "$2" '{query: ., name: $n}' "$1" | curl -sS -f -o /dev/null -X POST "$API/database/migrations" "${H[@]}" --data-binary @-; }

deja=$(echo "select count(*) n from pg_tables where schemaname = 'public' and tablename like 'crm_%'" | sql | jq '.[0].n')
[ "$deja" = "0" ] || { echo "Le projet a déjà $deja tables crm_* : ce script est fait pour un projet neuf."; exit 1; }

n=0
for f in web/supabase/0*.sql; do
  nom=$(basename "$f" .sql)
  migre "$f" "$nom" || { echo "ÉCHEC sur $nom : corriger, puis reprendre à partir de ce fichier."; exit 1; }
  n=$((n + 1)); printf '\r%2d migrations appliquées (%s)   ' "$n" "$nom"
done
echo

sed -e "s/__REF__/$REF/g" -e "s#__SITE__#$SITE#g" docs/replication/configuration/production.sql | sql >/dev/null
echo "Configuration de la production chargée (docs/replication/configuration/production.sql)."

echo "Contrôles (attendu : 53 · 53 · 176 · 1 · 11 · 11 · 17) :"
sql <<'SQL' | jq -r '.[0] | "\(.tables) · \(.rls) · \(.fonctions) · \(.vues) · \(.declencheurs) · \(.taches) · \(.reglages)"'
select (select count(*) from pg_tables where schemaname = 'public') tables,
       (select count(*) from pg_tables where schemaname = 'public' and rowsecurity) rls,
       (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public') fonctions,
       (select count(*) from pg_views where schemaname = 'public') vues,
       (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and not t.tgisinternal) declencheurs,
       (select count(*) from cron.job where active) taches,
       (select count(*) from crm_settings) reglages
SQL
echo "Si « fonctions » dépasse 176, pgcrypto est installée dans public au lieu d'extensions : sans effet sur l'application."
