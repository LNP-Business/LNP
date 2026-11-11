# Extraction Offre - Module 9: SALES_CONTEXT

## CONTEXTE

Tu es un expert en analyse de formations et offres high-ticket pour l'entraînement de commerciaux.
Ce module extrait le CONTEXTE DE VENTE : type d'appel, méthodologie, phases, GAP typique.

## OBJECTIF FINAL

Le contexte de vente permet de calibrer la simulation :
- Quel type d'appel ? (vente, qualification, découverte)
- Quelle durée ? (30 min, 45 min, 1h)
- Quelle méthodologie ? (structure en 7 phases, SPIN, autre)
- Quels sont les moments critiques ?
- Quel GAP typique pour calculer le coût de l'inaction ?

## RÈGLES D'EXTRACTION

### Ce module est souvent INFÉRÉ
Les docs marketing mentionnent rarement la méthodologie de vente.
Tu dois donc DÉDUIRE depuis :
- Le type d'offre (high-ticket = appel de vente probable)
- Le prix (>5000€ = vente structurée probable)
- Les témoignages ("lors de l'appel...")
- Le processus d'admission

### Méthodologies courantes
- **Structure en 7 phases** : 7 phases (Ice Breaker → Cadrage → Situation Actuelle → Situation Désirée → Engagement → Pitch → Conclusion)
- **SPIN** : Situation, Problem, Implication, Need-payoff
- **Autre** : Si spécifié dans le doc

### Calcul du GAP typique
Basé sur les profils cibles :
- **monthly_min** : GAP du profil le moins impacté
- **monthly_max** : GAP du profil le plus impacté
- **annual_display** : Formulation pour l'affichage

## FORMAT DE SORTIE

### Exemple 1 : Formation Tech
```json
{
  "_meta": {
    "confidence": 80,
    "source": "inferred",
    "needs_review": false,
    "review_reason": null
  },
  "call_type": "Appel de vente (entretien pédagogique)",
  "call_duration": "45-60 minutes",
  "methodology": "Structure en 7 phases",
  "key_phases": [
    "Ice Breaker - Créer le lien",
    "Cadrage - Poser le cadre de l'appel",
    "Situation Actuelle - Explorer les douleurs",
    "Situation Désirée - Projeter vers les objectifs",
    "Engagement - Valider la motivation",
    "Pitch - Présenter la solution",
    "Conclusion - Accompagner vers la décision"
  ],
  "typical_gap_range": {
    "monthly_min": 800,
    "monthly_max": 2000,
    "annual_display": "10K-24K€/an de manque à gagner"
  },
  "critical_moments": [
    {
      "moment": "Annonce du prix",
      "what_happens": "Le prospect découvre que c'est 22 224€",
      "success_indicator": "Il demande comment financer plutôt que dire c'est trop cher"
    },
    {
      "moment": "Discussion financement POEI",
      "what_happens": "Explication du financement à 100%",
      "success_indicator": "Le prospect comprend que c'est 0€ de sa poche"
    },
    {
      "moment": "Objection compétence technique",
      "what_happens": "Le prospect doute de sa capacité",
      "success_indicator": "Il accepte que le NoCode est fait pour les non-techniques"
    }
  ]
}
```

### Exemple 2 : Investissement
```json
{
  "_meta": {
    "confidence": 75,
    "source": "inferred",
    "needs_review": false,
    "review_reason": null
  },
  "call_type": "Appel de vente",
  "call_duration": "30-45 minutes",
  "methodology": "Structure en 7 phases",
  "key_phases": [
    "Ice Breaker - Créer le lien",
    "Cadrage - Poser le cadre",
    "Situation Actuelle - Explorer la situation financière",
    "Situation Désirée - Objectifs de liberté financière",
    "Engagement - Motivation au changement",
    "Pitch - Présenter la formation adaptée",
    "Conclusion - Décision avec garantie 14 jours"
  ],
  "typical_gap_range": {
    "monthly_min": 500,
    "monthly_max": 5000,
    "annual_display": "6K-60K€/an de revenus passifs manqués"
  },
  "critical_moments": [
    {
      "moment": "Discussion sur les peurs d'investir",
      "what_happens": "Le prospect exprime sa peur de perdre de l'argent",
      "success_indicator": "Il comprend la différence entre risque et risque maîtrisé"
    },
    {
      "moment": "Objection arnaque",
      "what_happens": "Le prospect exprime sa méfiance",
      "success_indicator": "Les preuves (6000 élèves, avis clients) le rassurent"
    },
    {
      "moment": "Garantie 14 jours",
      "what_happens": "Le prospect apprend qu'il peut être remboursé",
      "success_indicator": "L'objection risque tombe"
    }
  ]
}
```

### Exemple 3 : Scaling Business
```json
{
  "_meta": {
    "confidence": 75,
    "source": "inferred",
    "needs_review": false,
    "review_reason": null
  },
  "call_type": "Appel de qualification puis vente",
  "call_duration": "45-60 minutes",
  "methodology": "Structure en 7 phases adaptée B2B",
  "key_phases": [
    "Ice Breaker - Connexion entrepreneur à entrepreneur",
    "Cadrage - Objectifs de l'appel",
    "Situation Actuelle - Diagnostic de l'entreprise",
    "Situation Désirée - Vision de croissance",
    "Engagement - Volonté de changement",
    "Pitch - Présentation de l'accompagnement",
    "Conclusion - Prochaines étapes"
  ],
  "typical_gap_range": {
    "monthly_min": 10000,
    "monthly_max": 150000,
    "annual_display": "120K-1.8M€/an de CA manqué"
  },
  "critical_moments": [
    {
      "moment": "Diagnostic situation actuelle",
      "what_happens": "Le dirigeant réalise l'ampleur du problème",
      "success_indicator": "Il verbalise lui-même le coût de l'inaction"
    },
    {
      "moment": "Présentation des témoignages",
      "what_happens": "Le prospect découvre Thomas x6, Éric 8M€",
      "success_indicator": "Il se projette dans ces résultats"
    },
    {
      "moment": "Objection secteur différent",
      "what_happens": "Le prospect pense être unique",
      "success_indicator": "Il accepte que 100+ industries ont réussi"
    }
  ]
}
```

## CONTENU À ANALYSER

```
${content}
```

Retourne UNIQUEMENT le JSON, sans texte avant ou après.

