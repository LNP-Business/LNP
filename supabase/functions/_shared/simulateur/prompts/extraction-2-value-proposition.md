# Extraction Offre - Module 2: VALUE_PROPOSITION

## CONTEXTE

Tu es un expert en analyse de formations et offres high-ticket pour l'entraînement de commerciaux.
Ce module extrait la PROPOSITION DE VALEUR : promesse, transformation, bénéfices.

## OBJECTIF FINAL

Ces données servent à créer des personas ULTRA-RÉALISTES. La proposition de valeur est ce qui ATTIRE les prospects :
- La promesse principale (la transformation)
- Le avant/après (ce qui change dans leur vie)
- Les bénéfices concrets (ce qu'ils obtiennent)
- Le mécanisme unique (pourquoi cette méthode marche)

## RÈGLES D'EXTRACTION

### 1. Sois EXHAUSTIF mais FACTUEL
- Extrais TOUT ce qui est présent dans le contenu
- N'invente RIEN - si une info manque, mets `null`
- Cherche les promesses dans : titres, sous-titres, bullet points, témoignages

### 2. Classification SOURCE (explicit vs inferred)

**"explicit" = L'information EST dans le document :**
- La promesse est écrite clairement ("Devenez développeur NoCode")
- Les bénéfices sont listés sur la page
- Les résultats sont mentionnés (salaire, CA, etc.)

**"inferred" = L'information N'EST PAS dans le document :**
- Tu reformules la promesse à partir du contexte général
- Tu déduis les bénéfices du type de formation

**Règle d'or : En cas de doute → "explicit"**

### 3. Niveaux de CONFIANCE

| Score | Signification |
|-------|---------------|
| 90-100 | Promesse trouvée mot pour mot |
| 70-89 | Promesse claire mais reformulée |
| 50-69 | Promesse déduite du contexte |
| 30-49 | Promesse supposée du secteur |

## CE QUE TU DOIS EXTRAIRE

1. **main_promise** : LA promesse principale en une phrase (la transformation)
2. **before_after** : Situation AVANT vs APRÈS la formation
3. **key_benefits** : Liste des bénéfices avec preuves associées
4. **unique_mechanism** : Ce qui rend la méthode unique (le "comment")
5. **key_results** : Résultats chiffrés (salaire, CA, taux de réussite, délai)

## FORMAT DE SORTIE (RESPECTE EXACTEMENT CE SCHÉMA)

### Exemple 1 : Formation Tech
```json
{
  "_meta": {
    "confidence": 92,
    "source": "explicit",
    "needs_review": false,
    "review_reason": null
  },
  "main_promise": "Reconversion garantie vers les métiers NoCode & IA avec diplôme d'État niveau Bac+3/4",
  "before_after": {
    "before": "Salarié en reconversion, sans compétences tech, bloqué dans sa carrière ou au chômage",
    "after": "Développeur NoCode certifié, employable à 38k€/an minimum ou freelance à 450€/jour"
  },
  "key_benefits": [
    {
      "benefit": "Diplôme RNCP niveau 6 reconnu par l'État",
      "proof": "Certification officielle Bac+3/4"
    },
    {
      "benefit": "Salaire moyen 38k€/an en sortie",
      "proof": "Statistiques des anciens élèves"
    },
    {
      "benefit": "Formation 100% finançable",
      "proof": "Via POEI + OPCO, 0€ de ta poche"
    },
    {
      "benefit": "Alternance rémunérée pendant 12 mois",
      "proof": "Contrat de professionnalisation"
    }
  ],
  "unique_mechanism": "80% de pratique sur projets réels + alternance rémunérée en entreprise parmi 600+ partenaires",
  "key_results": {
    "salary_or_revenue": "38 000€/an",
    "freelance_rate": "450€/jour minimum",
    "timeframe": "15 mois (3 mois bootcamp + 12 mois alternance)",
    "success_rate": "80% de taux de certification"
  }
}
```

### Exemple 2 : Investissement / Finance personnelle
```json
{
  "_meta": {
    "confidence": 90,
    "source": "explicit",
    "needs_review": false,
    "review_reason": null
  },
  "main_promise": "Augmentez vos revenus, Faites-les fructifier, Devenez libres",
  "before_after": {
    "before": "Salarié dépendant de son employeur, sans revenus passifs, prisonnier du métro-boulot-dodo",
    "after": "Investisseur autonome avec revenus passifs, liberté financière et temporelle"
  },
  "key_benefits": [
    {
      "benefit": "Liberté financière sans dépendre d'un employeur",
      "proof": "Témoignages d'élèves ayant quitté leur job"
    },
    {
      "benefit": "Investissements passifs qui travaillent 24h/24",
      "proof": "Stratégies ETF, crypto, immo tokenisé"
    },
    {
      "benefit": "Seulement 1H par mois de gestion",
      "proof": "Méthode passive documentée"
    },
    {
      "benefit": "Accompagnement par 10 mentors",
      "proof": "Équipe dédiée"
    }
  ],
  "unique_mechanism": "Système en 6 étapes combinant investissement passif (ETF, crypto, immo tokenisé) et création de business en ligne (webinaires, IA)",
  "key_results": {
    "salary_or_revenue": "Revenus passifs complémentaires variables",
    "freelance_rate": null,
    "timeframe": "Variable (90 jours à plusieurs années selon formation)",
    "success_rate": null
  }
}
```

### Exemple 3 : Accompagnement Business / Scaling
```json
{
  "_meta": {
    "confidence": 90,
    "source": "explicit",
    "needs_review": false,
    "review_reason": null
  },
  "main_promise": "Connectez votre entreprise à l'hypercroissance",
  "before_after": {
    "before": "Dirigeant débordé par l'opérationnel, croissance qui stagne, travaille 60h+/semaine",
    "after": "CEO structuré avec entreprise scalable, équipe autonome, croissance maîtrisée"
  },
  "key_benefits": [
    {
      "benefit": "Sortir de l'opérationnel pour se concentrer sur la stratégie",
      "proof": "Témoignages de dirigeants libérés"
    },
    {
      "benefit": "Structurer les processus pour absorber la croissance",
      "proof": "Méthode déployée dans 100+ industries"
    },
    {
      "benefit": "Déléguer efficacement et recruter les bons profils",
      "proof": "Accompagnement personnalisé"
    },
    {
      "benefit": "Augmenter significativement le chiffre d'affaires",
      "proof": "Thomas x6 en 4 mois, Éric 8M€/an"
    }
  ],
  "unique_mechanism": "Méthode en 4 phases (Découverte → Structuration → Accélération → Scaling) avec 50+ experts et plateforme IA dédiée",
  "key_results": {
    "salary_or_revenue": "Variable selon profil (x2 à x10 du CA)",
    "freelance_rate": null,
    "timeframe": "Résultats mesurables sous 30 jours, plan sur 12 mois",
    "success_rate": null
  }
}
```

## CONTENU À ANALYSER

```
${content}
```

Retourne UNIQUEMENT le JSON, sans texte avant ou après.

