# Extraction Offre - Module 3: TARGET_AUDIENCE

## CONTEXTE

Tu es un expert en analyse de formations et offres high-ticket pour l'entraînement de commerciaux.
Ce module extrait les PROFILS CIBLES avec leurs douleurs, objectifs et GAP.

## OBJECTIF FINAL

Ces données servent à créer des personas ULTRA-RÉALISTES. Les profils cibles définissent :
- QUI sont les prospects idéaux
- Ce qui les BLOQUE (douleurs surface et profondes)
- Ce qu'ils VEULENT (objectifs, rêves)
- Le GAP = coût de l'inaction (crucial pour la vente)

## RÈGLES D'EXTRACTION

### 1. Identifie 2 à 4 PROFILS DISTINCTS
- Cherche dans : pages de vente, témoignages, FAQ, "pour qui c'est fait"
- Chaque profil = un type de personne différent (pas juste des variations)

### 2. Pour chaque profil, CALCULE LE GAP
Le GAP est CRUCIAL pour la vente. Formule :
- **monthly_gap** = (revenu désiré - revenu actuel) par mois
- **annual_cost_of_inaction** = monthly_gap × 12
- **time_cost** = ce qu'ils perdent chaque mois/année d'attente

### 3. Distingue douleurs SURFACE vs PROFONDES
- **Surface** = ce qu'ils DISENT ("je veux gagner plus")
- **Profonde** = ce qu'ils RESSENTENT vraiment ("j'ai peur de rater ma vie")

### 4. Classification SOURCE

**"explicit"** : Les profils sont décrits dans le document
**"inferred"** : Tu déduis les profils du contexte (prix, secteur, témoignages)

### 5. Niveaux de CONFIANCE

| Score | Signification |
|-------|---------------|
| 90-100 | Profils explicitement listés |
| 70-89 | Profils déduits des témoignages |
| 50-69 | Profils déduits du contexte général |

## CE QUE TU DOIS EXTRAIRE

1. **constraints** : Cible démographique (genre, âge, géo, secteurs, exclusions)
2. **ideal_profiles[]** : 2-4 profils avec :
   - id, label, description
   - typical_jobs, age_range, situation
   - current_revenue, target_revenue
   - pain_points (surface + deep)
   - motivations
   - gap_calculation (monthly_gap, annual_cost_of_inaction, time_cost)
3. **prerequisites** : Prérequis obligatoires, recommandés, et NON requis

## FORMAT DE SORTIE (RESPECTE EXACTEMENT CE SCHÉMA)

### Exemple 1 : Formation Tech
```json
{
  "_meta": {
    "confidence": 88,
    "source": "explicit",
    "needs_review": false,
    "review_reason": null
  },
  "constraints": {
    "gender_target": "all",
    "age_range": {
      "min": 25,
      "max": 50
    },
    "geographic_target": {
      "countries": ["France"],
      "regions": ["Île-de-France"],
      "restriction_level": "preferred"
    },
    "industries": ["Tech", "Digital", "Services"],
    "excluded_profiles": ["Mineurs", "Personnes non éligibles au travail en France"]
  },
  "ideal_profiles": [
    {
      "id": "reconversion-salarie",
      "label": "Salarié en reconversion",
      "description": "Professionnel insatisfait de son travail actuel, cherchant une reconversion dans la tech sans avoir de background technique",
      "typical_jobs": ["Cadre administratif", "Commercial", "Assistant", "Manager"],
      "typical_age_range": "28-45 ans",
      "typical_situation": "CDI mais envie de changement",
      "current_revenue": {
        "range": "2500-4000€/mois",
        "typical": 35000
      },
      "target_revenue": {
        "range": "3000-5000€/mois",
        "typical": 45000
      },
      "pain_points": [
        {
          "surface": "Mon travail ne me passionne plus, je m'ennuie",
          "deep": "J'ai peur de regretter de ne pas avoir osé changer"
        },
        {
          "surface": "Je n'évolue plus dans mon entreprise",
          "deep": "Je me sens bloqué et anxieux pour mon avenir"
        }
      ],
      "motivations": ["Nouveau départ", "Métier d'avenir", "Meilleur salaire", "Autonomie"],
      "gap_calculation": {
        "monthly_gap": 833,
        "annual_cost_of_inaction": 10000,
        "time_cost": "Chaque année passée = une année de plus à rattraper"
      }
    },
    {
      "id": "demandeur-emploi",
      "label": "Demandeur d'emploi",
      "description": "Personne au chômage cherchant une formation qualifiante financée pour revenir sur le marché du travail",
      "typical_jobs": ["Ex-cadre", "Ex-commercial", "Ex-assistant"],
      "typical_age_range": "25-50 ans",
      "typical_situation": "Inscrit Pôle Emploi, éligible POEI",
      "current_revenue": {
        "range": "1000-1500€/mois (ARE)",
        "typical": 15000
      },
      "target_revenue": {
        "range": "3000-4000€/mois",
        "typical": 38000
      },
      "pain_points": [
        {
          "surface": "Je n'arrive pas à retrouver un emploi",
          "deep": "J'ai peur de l'exclusion sociale et je perds confiance"
        },
        {
          "surface": "Mes compétences sont obsolètes",
          "deep": "Je me sens inutile et honteux vis-à-vis de mon entourage"
        }
      ],
      "motivations": ["Retrouver un emploi", "Formation gratuite", "Compétences recherchées"],
      "gap_calculation": {
        "monthly_gap": 1917,
        "annual_cost_of_inaction": 23000,
        "time_cost": "Chaque mois au chômage = déqualification progressive"
      }
    }
  ],
  "prerequisites": {
    "required": ["Motivation", "Disponibilité pour 15 mois"],
    "recommended": ["Bac ou équivalent", "Appétence pour le digital"],
    "not_required": ["Savoir coder", "Diplôme technique", "Expérience en informatique"]
  }
}
```

### Exemple 2 : Investissement
```json
{
  "_meta": {
    "confidence": 85,
    "source": "explicit",
    "needs_review": false,
    "review_reason": null
  },
  "constraints": {
    "gender_target": "all",
    "age_range": {
      "min": 25,
      "max": 55
    },
    "geographic_target": {
      "countries": ["France", "Suisse", "Belgique", "Canada"],
      "regions": [],
      "restriction_level": "none"
    },
    "industries": ["Tous secteurs"],
    "excluded_profiles": ["Mineurs", "Personnes surendettées"]
  },
  "ideal_profiles": [
    {
      "id": "debutant-investissement",
      "label": "Débutant en investissement",
      "description": "Salarié qui veut commencer à faire fructifier son argent mais ne sait pas par où commencer",
      "typical_jobs": ["Cadre", "Employé", "Fonctionnaire", "Profession libérale"],
      "typical_age_range": "25-45 ans",
      "typical_situation": "CDI stable, épargne dormante",
      "current_revenue": {
        "range": "0€/mois en passif",
        "typical": 0
      },
      "target_revenue": {
        "range": "500-2000€/mois en passif",
        "typical": 12000
      },
      "pain_points": [
        {
          "surface": "Je ne sais pas par où commencer pour investir",
          "deep": "J'ai peur de perdre mon argent durement gagné"
        },
        {
          "surface": "L'inflation ronge mes économies",
          "deep": "Je suis anxieux pour ma retraite et mon avenir"
        }
      ],
      "motivations": ["Sécuriser l'avenir", "Revenus passifs", "Liberté financière"],
      "gap_calculation": {
        "monthly_gap": 1000,
        "annual_cost_of_inaction": 12000,
        "time_cost": "Chaque année = intérêts composés perdus à jamais"
      }
    }
  ],
  "prerequisites": {
    "required": ["Motivation", "Capital minimum à investir"],
    "recommended": ["Situation financière stable"],
    "not_required": ["Connaissances en bourse", "Diplôme en finance"]
  }
}
```

### Exemple 3 : Scaling Business
```json
{
  "_meta": {
    "confidence": 90,
    "source": "explicit",
    "needs_review": false,
    "review_reason": null
  },
  "constraints": {
    "gender_target": "all",
    "age_range": {
      "min": 30,
      "max": 55
    },
    "geographic_target": {
      "countries": ["France", "Suisse", "Belgique"],
      "regions": [],
      "restriction_level": "none"
    },
    "industries": ["BTP", "Services", "Digital", "Immobilier", "Artisanat"],
    "excluded_profiles": ["Startups early-stage", "Auto-entrepreneurs débutants"]
  },
  "ideal_profiles": [
    {
      "id": "dirigeant-tpe",
      "label": "Dirigeant TPE / Artisan",
      "description": "Chef d'entreprise très opérationnel qui veut structurer et scaler son activité",
      "typical_jobs": ["Artisan", "Dirigeant BTP", "Gérant SARL"],
      "typical_age_range": "35-55 ans",
      "typical_situation": "CA 200k-2M€, travaille 60h+/semaine",
      "current_revenue": {
        "range": "200k-500k€/an de CA",
        "typical": 500000
      },
      "target_revenue": {
        "range": "1-2M€/an de CA",
        "typical": 2000000
      },
      "pain_points": [
        {
          "surface": "Je suis débordé, je fais tout moi-même",
          "deep": "J'ai peur de perdre le contrôle si je délègue"
        },
        {
          "surface": "Ma croissance stagne",
          "deep": "Je me sens prisonnier de mon entreprise"
        }
      ],
      "motivations": ["Scaler", "Déléguer", "Retrouver du temps"],
      "gap_calculation": {
        "monthly_gap": 125000,
        "annual_cost_of_inaction": 1500000,
        "time_cost": "Vie personnelle sacrifiée + opportunités manquées"
      }
    }
  ],
  "prerequisites": {
    "required": ["Entreprise existante", "CA minimum 100k€"],
    "recommended": ["Équipe en place", "Volonté de déléguer"],
    "not_required": ["Expérience en management", "MBA"]
  }
}
```

## CONTENU À ANALYSER

```
${content}
```

Retourne UNIQUEMENT le JSON, sans texte avant ou après.

