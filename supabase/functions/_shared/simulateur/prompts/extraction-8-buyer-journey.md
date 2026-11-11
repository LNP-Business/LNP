# Extraction Offre - Module 8: BUYER_JOURNEY

## CONTEXTE

Tu es un expert en analyse de formations et offres high-ticket pour l'entraînement de commerciaux.
Ce module extrait le PARCOURS D'ACHAT : comment les prospects arrivent et ce qu'ils savent.

## OBJECTIF FINAL

Comprendre le parcours permet de créer des personas avec le BON NIVEAU DE CONNAISSANCE :
- Par quel canal sont-ils arrivés ? (pub, webinaire, bouche-à-oreille)
- Qu'ont-ils déjà vu/lu AVANT l'appel ?
- Quelles sont leurs zones de flou ?
- Qui d'autre est impliqué dans la décision ?

## RÈGLES D'EXTRACTION

### Où chercher ces infos
- Pages "Comment ça marche"
- Processus de candidature décrit
- FAQ ("J'ai vu votre webinaire...")
- Témoignages ("J'ai découvert via...")
- Sources de trafic visibles (pub sur les réseaux sociaux, vidéos en ligne, etc.)

### Classification SOURCE
- **explicit** : Parcours décrit dans le doc
- **inferred** : Parcours déduit du type d'offre et du secteur

## FORMAT DE SORTIE

### Exemple 1 : Formation Tech
```json
{
  "_meta": {
    "confidence": 85,
    "source": "explicit",
    "needs_review": false,
    "review_reason": null
  },
  "entry_points": [
    {
      "channel": "Webinaires d'information",
      "percentage_estimate": 40,
      "knowledge_level": "Connaît les bases du NoCode, a vu une présentation de l'école"
    },
    {
      "channel": "Médias et presse (télévision, magazines)",
      "percentage_estimate": 20,
      "knowledge_level": "A entendu parler, curieux mais peu informé"
    },
    {
      "channel": "Bouche-à-oreille / Anciens élèves",
      "percentage_estimate": 25,
      "knowledge_level": "Recommandation directe, confiance établie"
    },
    {
      "channel": "Partenariats grandes écoles",
      "percentage_estimate": 15,
      "knowledge_level": "Découvre via son école, intérêt académique"
    }
  ],
  "pre_call_knowledge": {
    "definitely_knows": [
      "Académie Exemple est la première école NoCode & IA d'Europe",
      "Le fondateur est l'ex-CEO de Chaussures Exemple",
      "Plus de 9000 personnes formées",
      "La formation peut être financée à 100%"
    ],
    "probably_knows": [
      "Le salaire moyen en sortie est de 38k€/an",
      "Il y a un diplôme reconnu par l'État",
      "La formation dure 15 mois"
    ],
    "unclear_points": [
      "Comment fonctionne exactement le financement POEI + OPCO ?",
      "Comment trouver une entreprise pour l'alternance ?",
      "Est-ce que je suis capable de réussir sans background tech ?"
    ],
    "main_concerns": [
      "Suis-je vraiment capable de réussir ?",
      "Vais-je trouver une alternance ?",
      "Le NoCode a-t-il un avenir ?"
    ]
  },
  "admission_process": [
    {
      "step": 1,
      "name": "Formulaire de candidature",
      "description": "Remplir le formulaire en ligne"
    },
    {
      "step": 2,
      "name": "Test de personnalité",
      "description": "Évaluation du profil"
    },
    {
      "step": 3,
      "name": "Entretien pédagogique",
      "description": "Appel avec un conseiller"
    },
    {
      "step": 4,
      "name": "Admission",
      "description": "Confirmation et inscription"
    }
  ],
  "decision_factors": {
    "typical_decision_time": "1-2 semaines après l'appel",
    "stakeholders": ["Conjoint", "Pôle Emploi"],
    "key_validation_points": [
      "Confirmation du financement POEI",
      "Accord du conjoint",
      "Disponibilité pour la prochaine session"
    ]
  }
}
```

### Exemple 2 : Investissement
```json
{
  "_meta": {
    "confidence": 80,
    "source": "explicit",
    "needs_review": false,
    "review_reason": null
  },
  "entry_points": [
    {
      "channel": "Réseaux sociaux (vidéos courtes, photos)",
      "percentage_estimate": 50,
      "knowledge_level": "A vu des vidéos, inspiré par le lifestyle"
    },
    {
      "channel": "Plateforme de vidéos",
      "percentage_estimate": 20,
      "knowledge_level": "A regardé des vidéos éducatives"
    },
    {
      "channel": "Newsletter",
      "percentage_estimate": 15,
      "knowledge_level": "Suit depuis un moment, relation établie"
    },
    {
      "channel": "Webinaire gratuit",
      "percentage_estimate": 15,
      "knowledge_level": "A participé à un live, convaincu de la valeur"
    }
  ],
  "pre_call_knowledge": {
    "definitely_knows": [
      "Julie Bernard a accompagné 6000+ élèves",
      "Il y a une garantie 14 jours",
      "Seulement 1H/mois de gestion"
    ],
    "probably_knows": [
      "Il existe plusieurs formations Envol",
      "Il y a des coachings hebdomadaires"
    ],
    "unclear_points": [
      "Quelle formation choisir selon ma situation ?",
      "Combien faut-il pour commencer à investir ?",
      "Combien de temps avant les premiers résultats ?"
    ],
    "main_concerns": [
      "Est-ce que ça va marcher pour moi ?",
      "N'est-ce pas une arnaque ?",
      "Mon conjoint va-t-il comprendre ?"
    ]
  },
  "admission_process": [
    {
      "step": 1,
      "name": "Appel découverte",
      "description": "Échange pour comprendre la situation"
    },
    {
      "step": 2,
      "name": "Présentation solution",
      "description": "Recommandation de la formation adaptée"
    },
    {
      "step": 3,
      "name": "Inscription",
      "description": "Paiement et accès immédiat"
    }
  ],
  "decision_factors": {
    "typical_decision_time": "Souvent dans l'appel ou sous 48h",
    "stakeholders": ["Conjoint"],
    "key_validation_points": [
      "Garantie 14 jours rassurante",
      "Accord du conjoint",
      "Capital disponible"
    ]
  }
}
```

### Exemple 3 : Scaling Business
```json
{
  "_meta": {
    "confidence": 80,
    "source": "explicit",
    "needs_review": false,
    "review_reason": null
  },
  "entry_points": [
    {
      "channel": "Podcasts (Podcast Exemple)",
      "percentage_estimate": 30,
      "knowledge_level": "A écouté Marc Lefèvre, inspiré par les témoignages"
    },
    {
      "channel": "Réseaux sociaux professionnels",
      "percentage_estimate": 30,
      "knowledge_level": "Suit les contenus, voit les résultats"
    },
    {
      "channel": "Bouche-à-oreille entrepreneurs",
      "percentage_estimate": 25,
      "knowledge_level": "Recommandation directe, confiance forte"
    },
    {
      "channel": "Événements",
      "percentage_estimate": 15,
      "knowledge_level": "A rencontré l'équipe en personne"
    }
  ],
  "pre_call_knowledge": {
    "definitely_knows": [
      "1000+ dirigeants accompagnés",
      "Portefeuille dépassant le milliard d'euros",
      "Résultats sous 30 jours"
    ],
    "probably_knows": [
      "Thomas a fait x6 en 4 mois",
      "100+ industries couvertes"
    ],
    "unclear_points": [
      "Comment ça fonctionne concrètement ?",
      "Combien ça coûte ?",
      "Est-ce adapté à mon secteur ?"
    ],
    "main_concerns": [
      "Le retour sur investissement",
      "Le temps à consacrer",
      "L'adaptation à mon secteur"
    ]
  },
  "admission_process": [
    {
      "step": 1,
      "name": "Dépôt de candidature",
      "description": "Formulaire avec infos entreprise"
    },
    {
      "step": 2,
      "name": "Appel de qualification",
      "description": "Échange pour valider le fit"
    },
    {
      "step": 3,
      "name": "Proposition personnalisée",
      "description": "Programme adapté"
    },
    {
      "step": 4,
      "name": "Démarrage",
      "description": "Onboarding"
    }
  ],
  "decision_factors": {
    "typical_decision_time": "1-4 semaines",
    "stakeholders": ["Associés", "Conjoint", "Comptable"],
    "key_validation_points": [
      "ROI démontré",
      "Confiance dans l'équipe",
      "Disponibilité"
    ]
  }
}
```

## CONTENU À ANALYSER

```
${content}
```

Retourne UNIQUEMENT le JSON, sans texte avant ou après.

