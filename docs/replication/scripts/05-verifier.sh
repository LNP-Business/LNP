#!/usr/bin/env bash
# LNP · réplication, étape 5 : vérifier que la réplique est identique (chapitre 10), sans rien écrire.
# Usage (depuis la racine du dépôt) : docs/replication/scripts/05-verifier.sh <réf du projet> <adresse du site>
set -uo pipefail
REF=${1:?réf du projet Supabase}; SITE=${2:?adresse du site}; SITE=${SITE%/}
if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then read -rsp "Jeton personnel Supabase : " SUPABASE_ACCESS_TOKEN; echo; fi
API="https://api.supabase.com/v1/projects/$REF"; H=(-H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json")
sql() { jq -Rs '{query: ., read_only: true}' | curl -sS -X POST "$API/database/query" "${H[@]}" --data-binary @-; }
ok=0; ko=0; check() { if [ "$2" = "$3" ]; then echo "  ok   $1"; ok=$((ok+1)); else echo "  ÉCART $1 : attendu « $3 », obtenu « $2 »"; ko=$((ko+1)); fi; }

echo "Code"
check "app/lnp.html" "$(sha256sum app/lnp.html | cut -c1-64)" f77614734341ddca2bd97d22a15bd431451fbb0264bf3f37a9b8b48ce2e44214
check "web/public/index.html" "$(sha256sum web/public/index.html | cut -c1-64)" 229e3553c542ea6bdc0504b63170748eae396e784e57936d6671d782630e9daa
check "aucune clé dans le dépôt" "$(git grep -nE 'sbp_[0-9a-f]{20}|sb_secret_[A-Za-z0-9_-]{20}|eyJhbGciOi[A-Za-z0-9_-]{20}|sk-ant-[A-Za-z0-9_-]{20}' | wc -l | tr -d ' ')" 0

echo "Base"
r=$(sql <<'SQL'
select (select count(*) from pg_tables where schemaname = 'public') tables,
       (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity) sans_rls,
       (select count(*) from pg_views where schemaname = 'public') vues,
       (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and not t.tgisinternal) declencheurs,
       (select count(*) from pg_policies where schemaname = 'public') politiques,
       (select count(*) from information_schema.columns where table_schema = 'public') colonnes,
       (select string_agg(jobname || ' ' || schedule, ' | ' order by jobname) from cron.job where active) taches,
       (select count(*) from crm_settings) reglages,
       (select value #>> '{}' from crm_settings where key = 'functions_url') functions_url,
       (select engine || ' ' || (tiers->>'fast') || ' ' || (tiers->>'strong') || ' ' || (tiers->>'arbiter') from crm_ca_config) analyse,
       (select count(*) from crm_sim_personas where active) prospects_simulateur,
       (select string_agg(tablename, ',' order by tablename) from pg_publication_tables where pubname = 'supabase_realtime') temps_reel
SQL
)
v() { echo "$r" | jq -r ".[0].$1"; }
check "53 tables" "$(v tables)" 53
check "RLS sur toutes les tables" "$(v sans_rls)" 0
check "1 vue" "$(v vues)" 1
check "11 déclencheurs" "$(v declencheurs)" 11
check "52 politiques RLS" "$(v politiques)" 52
check "575 colonnes" "$(v colonnes)" 575
check "11 tâches planifiées" "$(v taches)" "crm-assign-owners-hourly 20 * * * * | crm-fathom-hourly 23 * * * * | crm-iclosed-calls-hourly 15 * * * * | crm-iclosed-contacts-hourly 3 * * * * | crm-iclosed-deals-hourly 41 * * * * | crm-no-show-hourly 35 * * * * | crm-process-inbox * * * * * | crm-refusal-daily 17 3 * * * | crm-setting-tick */10 * * * * | crm-simulateur-balayer */10 * * * * | crm-sla-tick */5 * * * *"
check "17 réglages" "$(v reglages)" 17
check "functions_url" "$(v functions_url)" "https://$REF.supabase.co/functions/v1"
check "analyse d'appel" "$(v analyse)" "lite claude-haiku-5-5 claude-haiku-5-5 claude-sonnet-5-5"
check "6 prospects du Simulateur" "$(v prospects_simulateur)" 6
check "temps réel" "$(v temps_reel)" "crm_sla_alerts,docs"

echo "Fonctions Edge"
f=$(curl -sS "$API/functions" "${H[@]}" | jq -r '[.[] | select(.status == "ACTIVE") | .slug + (if .verify_jwt then "!" else "" end)] | sort | join(" ")')
check "10 fonctions actives, sans vérification du JWT" "$f" "callqa-llm crm-import fathom-in iclosed-in lead-in process-inbox simulateur sla-tick whatsapp-in whop-in"
s=$(curl -sS "$API/secrets" "${H[@]}" | jq -r '[.[].name] | sort | join(" ")')
for n in ANTHROPIC_API_KEY ICLOSED_API_KEY ICLOSED_INBOUND_TOKEN FATHOM_API_KEY WHATSAPP_INBOUND_TOKEN WHATSAPP_APP_SECRET FUNNEL_INBOUND_TOKEN; do
  check "secret $n" "$(echo " $s " | grep -c " $n ")" 1
done

echo "Site"
check "page servie" "$(curl -sS "$SITE/" | sha256sum | cut -c1-64)" 229e3553c542ea6bdc0504b63170748eae396e784e57936d6671d782630e9daa
check "configuration publique" "$(curl -sS "$SITE/api/config" | sed -n 's/.*"url":"\([^"]*\)".*/\1/p')" "https://$REF.supabase.co"
check "/api/bootstrap fermé" "$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$SITE/api/bootstrap")" 404
echo; echo "$ok contrôles réussis, $ko écarts. Restent à la main : les écrans et les tests (chapitre 10)."
