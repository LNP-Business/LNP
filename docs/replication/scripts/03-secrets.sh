#!/usr/bin/env bash
# LNP · réplication, étape 3 : saisir les secrets, au clavier, sans les afficher ni les écrire sur le disque.
#   a) secrets et variable du dépôt GitHub (déploiement des fonctions, worker d'analyse d'appel) : par la CLI gh ;
#   b) secrets des fonctions Edge Supabase : par l'API de gestion Supabase.
# Usage (depuis la racine du dépôt) : docs/replication/scripts/03-secrets.sh <organisation/dépôt> <réf du projet>
# Laisser vide un secret facultatif pour le sauter. Les valeurs viennent des comptes de la NOUVELLE installation, jamais de la
# production LNP. Prérequis : gh (connecté), curl, jq.
set -euo pipefail
REPO=${1:?organisation/dépôt}; REF=${2:?réf du projet Supabase}
if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then read -rsp "Jeton personnel Supabase : " SUPABASE_ACCESS_TOKEN; echo; fi
API="https://api.supabase.com/v1/projects/$REF"

echo "== a) GitHub ($REPO)"
gh variable set SUPABASE_URL --repo "$REPO" --body "https://$REF.supabase.co"
printf '%s' "$SUPABASE_ACCESS_TOKEN" | gh secret set SUPABASE_ACCESS_TOKEN --repo "$REPO"
printf '%s' "$REF" | gh secret set SUPABASE_PROJECT_REF --repo "$REPO"
read -rsp "Clé secrète du projet Supabase (sb_secret_…, Project Settings › API Keys) : " K; echo
[ -n "$K" ] && printf '%s' "$K" | gh secret set SUPABASE_SERVICE_ROLE_KEY --repo "$REPO"; unset K

echo "== b) Secrets des fonctions Edge (chapitre 04 : qui lit quoi)"
put() { # nom, description, obligatoire (o/f)
  local v; read -rsp "$1 — $2 [$3] : " v; echo
  if [ -z "$v" ]; then [ "$3" = "obligatoire" ] && echo "   (sauté : la fonction qui le lit répondra une erreur claire)"; return; fi
  jq -n --arg n "$1" --arg v "$v" '[{name: $n, value: $v}]' |
    curl -sS -f -o /dev/null -X POST "$API/secrets" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
      -H "Content-Type: application/json" --data-binary @- && echo "   enregistré"
}
put ANTHROPIC_API_KEY        "modèle de l'analyse d'appel et du Simulateur"            obligatoire
put ICLOSED_API_KEY          "imports horaires iClosed (contacts, appels, ventes)"     obligatoire
put ICLOSED_INBOUND_TOKEN    "jeton du webhook iClosed (chaîne aléatoire à inventer)"  obligatoire
put FATHOM_API_KEY           "import horaire des enregistrements Fathom"               obligatoire
put WHATSAPP_INBOUND_TOKEN   "jeton de vérification du webhook WhatsApp (à inventer)"  obligatoire
put WHATSAPP_APP_SECRET      "secret de l'application Meta (signature des messages)"  obligatoire
put FUNNEL_INBOUND_TOKEN     "jeton du webhook des funnels (à inventer)"               obligatoire
put WHOP_WEBHOOK_SECRET      "signature des webhooks Whop, si Whop est utilisé"        facultatif
put ELEVENLABS_API_KEY       "voix du prospect du Simulateur"                          facultatif
put SLACK_SALES_CYCLE_WEBHOOK_URL "copie Slack des alertes (éteinte par défaut)"       facultatif
put CLOSE_API_KEY            "import d'historique depuis Close"                        facultatif
put CRM_REPORT_TOKEN         "rapport nominatif de crm-import (chaîne à inventer)"     facultatif
put FATHOM_WEBHOOK_SECRET    "webhook Fathom (la production n'en a pas : import horaire)" facultatif
echo "Noms enregistrés côté Supabase :"
curl -sS -f "$API/secrets" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" | jq -r '.[].name' | sort | tr '\n' ' '; echo
