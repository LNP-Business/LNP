# Extraction Offre - Module 6: SOCIAL_PROOF

## CONTEXTE

Tu es un expert en analyse de formations et offres high-ticket pour l'entraînement de commerciaux.
Ce module extrait les PREUVES SOCIALES : métriques, témoignages, médias, partenaires.

## OBJECTIF FINAL

Les preuves sociales sont ce qui CONVAINC les prospects :
- Les chiffres rassurent ("9000 personnes formées")
- Les témoignages créent l'identification ("Il était comme moi et il a réussi")
- Les partenaires légitiment ("Si une grande école travaille avec eux...")
- Les médias valident ("Vu à la télévision")

## RÈGLES D'EXTRACTION

### IMPORTANT : Chiffres EXACTS
- N'arrondis PAS les chiffres
- Doc dit "9247 élèves" → extrais 9247, pas 9000
- Si le doc dit "9000+" → extrais 9000 dans number, "9000+" dans display

### Classification SOURCE
- **explicit** : Métriques et témoignages présents dans le doc
- **inferred** : Aucune preuve trouvée (rare) → confidence basse

### Témoignages : EXTRAIS L'ESSENTIEL
Pour chaque témoignage, capture :
- Qui (prénom/nom)
- Avant (situation initiale)
- Après (résultat obtenu)
- Quote si disponible
- Pour quel profil c'est relatable

## FORMAT DE SORTIE

### Exemple 1 : Formation Tech (preuves multiples)
```json
{
  "_meta": {
    "confidence": 95,
    "source": "explicit",
    "needs_review": false,
    "review_reason": null
  },
  "metrics": {
    "students_trained": {
      "number": 9000,
      "display": "9 000+ personnes formées"
    },
    "success_rate": "80% de taux de certification",
    "satisfaction_score": {
      "score": "4.4/5",
      "platform": "Plateforme d'avis",
      "reviews_count": 502
    },
    "years_active": 5,
    "partner_companies": 600
  },
  "testimonials": [
    {
      "name": "Sophie Lambert",
      "profile_before": "Employée de banque, ne trouvait plus de sens dans son travail",
      "profile_after": "Crée sa propre agence IA, travaille en voyageant",
      "key_result": "Reconversion complète réussie",
      "quote": "J'ai quitté mon job, fait la formation, et maintenant je crée ma propre agence",
      "relatable_for": ["reconversion-salarie", "demandeur-emploi"]
    },
    {
      "name": "Laurent Petit",
      "profile_before": "Freelance, ne savait pas par où commencer en IA",
      "profile_after": "Pilote des projets IA avec confiance",
      "key_result": "Montée en compétences IA réussie",
      "quote": null,
      "relatable_for": ["freelance", "entrepreneur"]
    }
  ],
  "media_mentions": [
    {"outlet": "Chaîne d'info économique", "type": "interview"},
    {"outlet": "Magazine économique", "type": "article"},
    {"outlet": "Quotidien économique", "type": "article"}
  ],
  "partners": {
    "academic": ["École de commerce Exemple", "École de management Exemple", "Business school Exemple", "Institut d'études politiques Exemple"],
    "corporate": ["Plateforme de covoiturage Exemple", "Groupe de jeux Exemple", "Groupe industriel Exemple", "Néobanque Exemple"]
  },
  "trust_signals": [
    "Première école NoCode & IA d'Europe",
    "Diplôme reconnu par l'État niveau Bac+3/4",
    "Communauté en ligne de 4000+ membres"
  ]
}
```

### Exemple 2 : Investissement (preuves réseaux sociaux)
```json
{
  "_meta": {
    "confidence": 93,
    "source": "explicit",
    "needs_review": false,
    "review_reason": null
  },
  "metrics": {
    "students_trained": {
      "number": 6000,
      "display": "6 000+ élèves accompagnés depuis 2020"
    },
    "success_rate": null,
    "satisfaction_score": {
      "score": "4.7/5",
      "platform": "Plateforme d'avis",
      "reviews_count": 350
    },
    "years_active": 6,
    "partner_companies": null
  },
  "testimonials": [],
  "media_mentions": [],
  "partners": {
    "academic": [],
    "corporate": []
  },
  "trust_signals": [
    "312K abonnés sur un réseau social vidéo",
    "77K abonnés sur un réseau social photo",
    "Présent dans 15 pays",
    "10 mentors dans l'équipe",
    "Garantie satisfait ou remboursé 14 jours"
  ]
}
```

### Exemple 3 : Scaling Business (preuves résultats)
```json
{
  "_meta": {
    "confidence": 95,
    "source": "explicit",
    "needs_review": false,
    "review_reason": null
  },
  "metrics": {
    "students_trained": {
      "number": 1000,
      "display": "1000+ entrepreneurs transformés"
    },
    "success_rate": null,
    "satisfaction_score": {
      "score": null,
      "platform": null,
      "reviews_count": null
    },
    "years_active": 7,
    "partner_companies": null
  },
  "testimonials": [
    {
      "name": "Thomas Garnier",
      "profile_before": "Agence IA à 5-8k€/mois",
      "profile_after": "30-40k€/mois après 4 mois",
      "key_result": "x6 de croissance en 4 mois",
      "quote": "Délégation complète du consulting et développement en 1 mois",
      "relatable_for": ["entrepreneur-digital", "agence"]
    },
    {
      "name": "Éric Fontaine",
      "profile_before": "Agence immobilière en croissance",
      "profile_after": "8M€ HT/an, 300+ commerciaux",
      "key_result": "x3 leads à masse salariale constante",
      "quote": null,
      "relatable_for": ["immobilier", "reseau"]
    }
  ],
  "media_mentions": [
    {"outlet": "Podcast Exemple", "type": "podcast"}
  ],
  "partners": {
    "academic": [],
    "corporate": []
  },
  "trust_signals": [
    "Portefeuille cumulé dépassant le milliard d'euros",
    "120+ collaborateurs",
    "50+ experts et intervenants",
    "100+ industries"
  ]
}
```

## CONTENU À ANALYSER

```
${content}
```

Retourne UNIQUEMENT le JSON, sans texte avant ou après.

