# Extraction Offre - Module 5: PRICING

## CONTEXTE

Tu es un expert en analyse de formations et offres high-ticket pour l'entraînement de commerciaux.
Ce module extrait le PRICING : prix, financement, paiement, garanties, ROI.

## OBJECTIF FINAL

Le pricing est CENTRAL pour la vente :
- Le prix déclenche les objections principales
- Les options de financement DÉSAMORCENT les objections
- La garantie RASSURE et permet de conclure
- Le ROI JUSTIFIE l'investissement

## RÈGLES D'EXTRACTION

### IMPORTANT : Ne PAS inventer le prix
- Si le prix n'est pas mentionné → mets `null`
- Cherche dans : CGV, pages de vente, checkout, mentions de financement
- "Sur candidature" ou "Sur devis" = pas de prix fixe → `null` pour price, "Sur candidature" pour price_display

### Classification SOURCE
- **explicit** : Prix trouvé dans le document
- **inferred** : Prix déduit (très rare - seulement si fourchette mentionnée)
- **missing** : Prix non trouvé → confidence < 50

### Niveaux de CONFIANCE
| Score | Quand |
|-------|-------|
| 90-100 | Prix exact trouvé ("22 224€ TTC") |
| 70-89 | Fourchette de prix trouvée |
| 40-60 | Prix déduit du secteur (PAS RECOMMANDÉ) |
| 0-39 | Prix non trouvé → mettre null |

### Ce que tu dois CHERCHER
- Prix TTC clairement affiché
- Options de financement (CPF, OPCO, POEI, paiement échelonné)
- Garanties (satisfait ou remboursé, durée, conditions)
- Arguments ROI (retour sur investissement, témoignages chiffrés)

## FORMAT DE SORTIE

### Exemple 1 : Formation avec prix explicite et financement
```json
{
  "_meta": {
    "confidence": 95,
    "source": "explicit",
    "needs_review": false,
    "review_reason": null
  },
  "main_offer": {
    "name": "Formation certifiante NoCode & IA 15 mois",
    "price": 22224,
    "price_display": "22 224€ TTC",
    "currency": "EUR"
  },
  "financing_options": [
    {
      "id": "poei-opco",
      "name": "POEI + OPCO",
      "description": "Financement Pôle Emploi pour le bootcamp + OPCO pour l'alternance",
      "coverage": "100% de la formation",
      "eligibility": "Demandeurs d'emploi inscrits à Pôle Emploi",
      "result_for_prospect": "0€ de ta poche + rémunération pendant l'alternance"
    },
    {
      "id": "autofinancement",
      "name": "Autofinancement",
      "description": "Paiement personnel avec facilités",
      "coverage": "100% de la formation",
      "eligibility": "Tous",
      "result_for_prospect": "Paiement échelonné possible"
    }
  ],
  "payment_options": ["Paiement en 2x sans frais", "Paiement en 3x sans frais", "Paiement en 4x sans frais"],
  "guarantee": {
    "type": null,
    "duration": null,
    "conditions": null
  },
  "roi_calculation": {
    "investment": 22224,
    "expected_return": "38 000€/an minimum en sortie",
    "payback_period": "Immédiat si financé POEI, sinon ~7 mois de salaire"
  }
}
```

### Exemple 2 : Formation avec prix non explicite mais garantie forte
```json
{
  "_meta": {
    "confidence": 60,
    "source": "inferred",
    "needs_review": true,
    "review_reason": "Prix non mentionné explicitement dans le contenu"
  },
  "main_offer": {
    "name": "Formations Envol (Bourse, Immo, Cash, Webi, IA)",
    "price": null,
    "price_display": null,
    "currency": "EUR"
  },
  "financing_options": [
    {
      "id": "paiement-echelonne",
      "name": "Paiement en plusieurs fois",
      "description": "Possibilité d'échelonner le paiement",
      "coverage": "100% de la formation",
      "eligibility": "Tous",
      "result_for_prospect": "Étaler l'investissement sur plusieurs mois"
    }
  ],
  "payment_options": ["Carte bancaire", "Virement bancaire", "Paiement en plusieurs fois"],
  "guarantee": {
    "type": "Satisfait ou remboursé",
    "duration": "14 jours",
    "conditions": "Remboursement intégral même après avoir visionné l'intégralité de la formation"
  },
  "roi_calculation": {
    "investment": null,
    "expected_return": "Revenus passifs complémentaires à vie",
    "payback_period": "Variable selon profil et capital investi"
  }
}
```

### Exemple 3 : Accompagnement premium sur candidature
```json
{
  "_meta": {
    "confidence": 40,
    "source": "inferred",
    "needs_review": true,
    "review_reason": "Prix non communiqué publiquement, accompagnement sur candidature"
  },
  "main_offer": {
    "name": "Programme d'accompagnement Dirigeants Exemple",
    "price": null,
    "price_display": "Sur candidature",
    "currency": "EUR"
  },
  "financing_options": [],
  "payment_options": [],
  "guarantee": {
    "type": "Garantie de résultats",
    "duration": "30 jours",
    "conditions": "Résultats mesurables sous 30 jours"
  },
  "roi_calculation": {
    "investment": null,
    "expected_return": "ROI x4-x5 selon témoignages (Thomas x6 en 4 mois)",
    "payback_period": "Rapide selon les témoignages clients"
  }
}
```

## CONTENU À ANALYSER

```
${content}
```

Retourne UNIQUEMENT le JSON, sans texte avant ou après.

