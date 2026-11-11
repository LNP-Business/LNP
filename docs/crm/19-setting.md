# 19 — Le suivi du setter (migration 054)

Décision (Romain, 2026-11-09) : suivre toutes les étapes du setter pour chaque lead dans le CRM, surtout dans l'écran Prospects.
Référence : le workflow « Cycle de vente LNP » et le brief setter des funnels Quiz et VSL.

## Le statut setter d'un lead

Gardé sur la personne (`crm_people`), car un lead sans RDV n'a pas encore de cycle de vente :
`setting_status`, `setting_since`, `setting_last_action` / `setting_last_at` (dernière action), `setting_due_at` (échéance de
l'action actuelle), `setting_attempts` (appels sans réponse), `setter_id`, `lead_source`, `quiz` (réponses du quiz).

| Statut | Action actuelle | Échéance | Alerte |
|---|---|---|---|
| Lead à contacter | appeler ; pas de réponse : WhatsApp | arrivée (dans les heures du setter) + 5 min | SE-1 |
| Relance n / 6 | tentative suivante | T0+2 h, fin de journée, J+1, J+2, J+4 (quiz abandonné : +24 h, 2 tentatives) | SE-3 |
| Appel de qualification | tri en 4 points, RDV posé en direct | 21 h le jour même | SE-7 |
| RDV à confirmer | message de confirmation | réservation + 1 h | SE-6 |
| Appel de confirmation | appeler pour confirmer | réservation + 1 h | SE-6 |
| RDV posé · OK attendu | récap, attendre le « OK » | J−1 du RDV | SE-9 |
| RDV confirmé | rappels J−1 et H−2 | — | — |
| Re-confirmation | appeler le jour même | 4 h, au plus tard 2 h avant le RDV | SE-9 |
| À replanifier | reposer le RDV en direct | 21 h le jour même | SE-10 |
| Absent · rattrapage | appeler dans les 15 min, re-booker | absence + 15 min | SH-8 |
| RDV tenu · au commercial | — | — | — |
| Injoignable · nurture / Non qualifié · nurture | — (« Reprendre le lead ») | — | — |

SE-8 (lead sans action) : 24 h après la dernière action, pour tout statut ouvert. SE-4 et SE-5 sont appliquées par le CRM
(injoignable à la 6e tentative ; 2 tentatives pour un quiz abandonné).

Heures du setter : `crm_settings.setting.coverage` (heure de Paris ; par défaut 12 h–13 h 30 et 17 h–20 h en semaine, 9 h–12 h le
samedi). Setter d'un nouveau lead : `crm_settings.setting.default_setter`, sinon le setter actif qui a le moins de leads en cours.

## Ce qui fait avancer le statut

- **Le setter**, depuis la fiche du prospect (panneau « Setting ») : `crm_setter_action(personne, action, note)`. Actions :
  appel sans réponse, joint au téléphone, message de relance envoyé, RDV posé dans iClosed, non qualifié, classer injoignable,
  message de confirmation envoyé, appel de confirmation fait, « OK » reçu, rappel J−1 / H−2 envoyé, pas de « OK » à J−1, RDV
  annulé ou déplacé, reprendre le lead, note. Chaque action est un événement `setter_action` du fil du prospect.
- **Le CRM est la seule source de vérité** (migration 059, Romain 2026-11-11) : d'iClosed, on ne garde que le lead, la date et
  l'heure des RDV, leurs déplacements et leurs annulations ; jamais « honoré », « absent », « gagné », « perdu » ni un paiement (une
  vente iClosed s'affiche dans la fiche, pour information). Un RDV réservé → « RDV à confirmer » (ou reste « RDV posé » si le setter
  vient de le poser), déplacé → « RDV à confirmer », annulé → « À replanifier » ; l'issue déclarée dans le CRM (ou la règle
  d'absence, 056) : absent → « Absent · rattrapage », tenu → « RDV tenu · au commercial ».
- **Webinaire** : le setter ne reprend un lead webinaire que s'il a assisté sans prendre de RDV (« Lead à contacter »), s'il était
  absent au webinaire et n'a pas répondu en 48 h (« Webinaire absent · attente de réponse », puis « Lead à contacter »), ou s'il
  était absent à son RDV de vente et n'a pas répondu en 24 h (« Absent · attente de réponse », puis « Absent · rattrapage »).
  Un lead webinaire qui réserve seul va directement au commercial. `crm_setting_tick` vérifie les attentes toutes les 10 min.
- **L'entrée d'un lead** : fonction `lead-in` (ci-dessous) ou « + Nouveau prospect » (`crm_create_lead`).

Qui voit quoi : un setter voit les leads qui lui sont confiés (`crm_sets_person`, `crm_owns_cycle`, `crm_sees_person`) et reçoit
leurs alertes SE ; un administrateur voit tout et choisit le setter d'un lead. La fonction (commercial ou setter) se choisit dans
Paramètres › Compte › Accès de l'équipe.

## Brancher le quiz et la VSL (`lead-in`)

Adresse : `https://lludbqyosuzgwvvphmqc.supabase.co/functions/v1/lead-in?k=<FUNNEL_INBOUND_TOKEN>` (ou l'en-tête `x-lnp-token`).
Secret Supabase › Edge Functions › Secrets : `FUNNEL_INBOUND_TOKEN`, une valeur inventée (48 lettres et chiffres).

L'outil du quiz ou de la VSL (ou Zapier, Make…) envoie un POST JSON par lead (ou une liste) :

```json
{
  "source": "quiz",
  "email": "lea@example.com",
  "phone": "06 12 34 56 78",
  "first_name": "Léa",
  "last_name": "Martin",
  "booked": false,
  "attended": null,
  "answers": { "matiere": "SVT", "niveau": "lycée", "objectif": "2 000 €/mois" },
  "id": "identifiant-unique-de-la-reponse",
  "submitted_at": "2026-11-10T09:00:00Z"
}
```

`source` : `quiz`, `vsl`, `quiz_abandon` ou `webinaire` (les libellés proches sont reconnus). Les noms de champs courants sont
lus aussi (`telephone`, `prenom`, `nom`, `full_name`, `responses`…). `booked: true` : le RDV arrive par iClosed, le setter le
confirmera (sauf un lead webinaire, qui va au commercial). `attended` (webinaire seulement, ou `present`) : `true` présent,
`false` absent. Le même `id` envoyé deux fois ne crée qu'un lead.

## Tests

`web/supabase/tests/setting_test.sql`, `web/supabase/tests/source_de_verite_test.sql` (059), `supabase/tests/pipeline.test.ts` (lecture des leads), `supabase/tests/ingest.test.ts`
(jeton), `supabase/tests/sla.test.ts` (alertes SE), `app/crm/setting_live.js` (écran Prospects et fiche).
