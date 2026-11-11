# Extraction Offre - Module 4: OFFER_STRUCTURE

## CONTEXTE

Tu es un expert en analyse de formations et offres high-ticket pour l'entraînement de commerciaux.
Ce module extrait la STRUCTURE DE L'OFFRE : format, durée, composants, outils, certification.

## OBJECTIF FINAL

La structure de l'offre permet au persona de poser des questions réalistes :
- "Combien de temps ça dure ?"
- "C'est en présentiel ou en ligne ?"
- "Qu'est-ce que j'apprends concrètement ?"

## RÈGLES D'EXTRACTION

### Classification SOURCE
- **explicit** : Format, durée, composants clairement décrits dans le doc
- **inferred** : Structure déduite du contexte (prix premium → coaching individuel probable)

### Niveaux de CONFIANCE
| Score | Quand |
|-------|-------|
| 90-100 | Programme détaillé dans le doc |
| 70-89 | Structure mentionnée mais partielle |
| 50-69 | Structure déduite du type d'offre |

### Ce que tu dois CHERCHER
- Pages "Programme", "Comment ça marche", "Déroulé"
- FAQ sur la durée et le format
- Témoignages mentionnant l'expérience

## FORMAT DE SORTIE

### Exemple 1 : Formation Tech (Bootcamp + Alternance)
```json
{
  "_meta": {
    "confidence": 95,
    "source": "explicit",
    "needs_review": false,
    "review_reason": null
  },
  "format": "hybrid",
  "duration": {
    "total": "15 mois",
    "breakdown": [
      {
        "phase": "Bootcamp intensif",
        "duration": "3 mois",
        "description": "Formation intensive en présentiel au campus de Lyon"
      },
      {
        "phase": "Alternance en entreprise",
        "duration": "12 mois",
        "description": "Mise en pratique en entreprise parmi 600+ partenaires"
      }
    ]
  },
  "schedule": {
    "time_commitment": "Temps plein pendant le bootcamp, puis rythme alternance",
    "flexibility": "temps_plein"
  },
  "components": [
    {
      "name": "Cours en présentiel",
      "description": "Formation au campus de Lyon avec formateurs experts",
      "value_highlight": "Apprentissage pratique et interactions directes"
    },
    {
      "name": "Projets réels",
      "description": "80% de pratique sur des cas concrets",
      "value_highlight": "Portfolio professionnel à la sortie"
    },
    {
      "name": "Communauté en ligne",
      "description": "Accès à la communauté de 4000+ membres",
      "value_highlight": "Entraide et networking"
    }
  ],
  "tools_taught": ["Outil NoCode d'applications", "Base de données en ligne", "Créateur de sites", "Outil d'automatisation", "Outil de documentation", "Outil de portails clients"],
  "deliverables": ["Portfolio de projets", "Diplôme RNCP", "Réseau professionnel"],
  "certification": {
    "name": "Concepteur Développeur d'Applications",
    "level": "RNCP niveau 6 (Bac+3/4)",
    "recognized_by": "État français"
  }
}
```

### Exemple 2 : Formation Investissement (E-learning)
```json
{
  "_meta": {
    "confidence": 85,
    "source": "explicit",
    "needs_review": false,
    "review_reason": null
  },
  "format": "online",
  "duration": {
    "total": "Variable selon formation",
    "breakdown": [
      {
        "phase": "Formation vidéo",
        "duration": "Accès illimité",
        "description": "Modules vidéo à suivre à son rythme"
      },
      {
        "phase": "Coachings groupés",
        "duration": "Hebdomadaires",
        "description": "Sessions de coaching en groupe avec les mentors"
      }
    ]
  },
  "schedule": {
    "time_commitment": "1H par mois de gestion une fois formé",
    "flexibility": "flexible"
  },
  "components": [
    {
      "name": "Modules vidéo Envol",
      "description": "Formations spécialisées : Bourse, Immo, Cash, Webi, IA",
      "value_highlight": "Accès à vie aux contenus"
    },
    {
      "name": "Coachings hebdomadaires",
      "description": "Sessions de groupe avec les 10 mentors",
      "value_highlight": "Accompagnement personnalisé"
    },
    {
      "name": "Séminaire présentiel",
      "description": "3 jours à Genève",
      "value_highlight": "Immersion totale et networking"
    }
  ],
  "tools_taught": ["Plateformes de courtage", "ETF", "Crypto", "Immobilier tokenisé"],
  "deliverables": ["Stratégie d'investissement", "Portefeuille diversifié"],
  "certification": {
    "name": null,
    "level": null,
    "recognized_by": null
  }
}
```

### Exemple 3 : Accompagnement Business (Coaching)
```json
{
  "_meta": {
    "confidence": 80,
    "source": "inferred",
    "needs_review": true,
    "review_reason": "Format exact non détaillé, déduit des témoignages"
  },
  "format": "hybrid",
  "duration": {
    "total": "12 mois",
    "breakdown": [
      {
        "phase": "Découverte",
        "duration": "30 jours",
        "description": "Identifier où l'entreprise perd de l'argent et du temps"
      },
      {
        "phase": "Structuration + Accélération",
        "duration": "11 mois",
        "description": "Plan d'action et scaling"
      }
    ]
  },
  "schedule": {
    "time_commitment": "Variable selon besoin",
    "flexibility": "flexible"
  },
  "components": [
    {
      "name": "Accompagnement individuel",
      "description": "Sessions personnalisées avec experts dédiés",
      "value_highlight": "Adapté à votre situation spécifique"
    },
    {
      "name": "Accès aux 50+ experts",
      "description": "Réseau d'intervenants spécialisés",
      "value_highlight": "Expertise pointue"
    },
    {
      "name": "Communauté 1000+ entrepreneurs",
      "description": "Réseau de dirigeants",
      "value_highlight": "Networking haut niveau"
    }
  ],
  "tools_taught": ["Outils de management", "Process de délégation", "Systèmes de scaling"],
  "deliverables": ["Entreprise structurée", "Équipe autonome", "Processus scalables"],
  "certification": {
    "name": null,
    "level": null,
    "recognized_by": null
  }
}
```

## VALEURS POSSIBLES
- **format**: online | hybrid | bootcamp | alternance | seminaire | coaching
- **flexibility**: temps_plein | temps_partiel | flexible

## CONTENU À ANALYSER

```
${content}
```

Retourne UNIQUEMENT le JSON, sans texte avant ou après.

