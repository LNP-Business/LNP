# Extraction Offre - Module 10: CONTENT_FOR_SIMULATION

## CONTEXTE

Tu es un expert en analyse de formations et offres high-ticket pour l'entraînement de commerciaux.
Ce module prépare le CONTENU PRÊT À INJECTER dans les prompts de simulation.

## OBJECTIF FINAL

Ce module est le PLUS IMPORTANT pour les simulations. Il génère :
- Les phrases exactes que le persona SAIT déjà
- Les questions qu'il se pose encore
- Les chiffres clés qu'il peut citer
- Le vocabulaire qu'il utilise vs celui de l'offre
- Les déclencheurs émotionnels

Le persona doit pouvoir dire : "J'ai vu sur votre site que vous avez formé 9000 personnes..."

## RÈGLES D'EXTRACTION

### prospect_already_knows = Phrases COMPLÈTES
PAS de bullet points vagues. Des phrases que le prospect pourrait DIRE :
- ❌ "Le prix" 
- ✅ "J'ai vu que la formation coûte 22 224 euros"

### key_numbers_to_remember = Chiffres MÉMORABLES
Les chiffres que le prospect a retenus de sa recherche :
- Nombre d'élèves/clients
- Prix (si public)
- Taux de réussite
- Salaire moyen en sortie
- Durée

### vocabulary = 3 listes distinctes
1. **terms_prospects_use** : Leur langage naturel ("reconversion", "gagner plus")
2. **terms_offer_uses** : Jargon de l'offre ("NoCode", "scaling", "ETF")
3. **terms_to_avoid** : Mots qui sonnent faux ("facile", "miracle", "garanti")

## FORMAT DE SORTIE

### Exemple 1 : Formation Tech
```json
{
  "_meta": {
    "confidence": 90,
    "source": "explicit",
    "needs_review": false,
    "review_reason": null
  },
  "prospect_already_knows": [
    "Académie Exemple est la première école NoCode & IA d'Europe",
    "La formation dure 15 mois avec 3 mois de bootcamp et 12 mois d'alternance",
    "Le fondateur Paul Martin est l'ex-CEO de Chaussures Exemple",
    "Plus de 9000 personnes ont été formées",
    "Le salaire moyen en sortie est de 38k€/an",
    "La formation peut être financée à 100% via POEI + OPCO",
    "Il y a un diplôme RNCP niveau 6 reconnu par l'État",
    "80% des apprenants obtiennent leur certification"
  ],
  "prospect_unclear_about": [
    "Comment fonctionne exactement le financement POEI + OPCO ?",
    "C'est quoi la différence entre NoCode et développement classique ?",
    "Comment je trouve une entreprise pour l'alternance ?",
    "Est-ce que je suis vraiment capable de réussir sans background tech ?",
    "Qu'est-ce qui se passe si je ne trouve pas d'alternance ?",
    "Comment ça se passe concrètement au quotidien ?",
    "Est-ce que le NoCode ne va pas disparaître dans quelques années ?"
  ],
  "key_numbers_to_remember": [
    {
      "number": "9000+",
      "context": "personnes formées",
      "full_phrase": "Plus de 9000 personnes ont déjà été formées par Académie Exemple"
    },
    {
      "number": "38k€/an",
      "context": "salaire moyen en sortie",
      "full_phrase": "Le salaire moyen des diplômés est de 38 000 euros par an"
    },
    {
      "number": "80%",
      "context": "taux de certification",
      "full_phrase": "80% des apprenants obtiennent leur certification"
    },
    {
      "number": "600+",
      "context": "entreprises partenaires",
      "full_phrase": "Plus de 600 entreprises partenaires pour l'alternance"
    },
    {
      "number": "0€",
      "context": "coût si financement POEI",
      "full_phrase": "Avec le financement POEI + OPCO, c'est 0 euro de ta poche"
    }
  ],
  "founder_mentions": {
    "name": "Paul Martin",
    "credibility_hook": "ex-CEO de Chaussures Exemple, leader européen de la chaussure en ligne",
    "story_hook": "A créé Chaussures Exemple de zéro jusqu'à en faire un géant, puis a fondé Académie Exemple"
  },
  "vocabulary": {
    "terms_prospects_use": [
      "reconversion", "formation", "diplôme", "salaire", "financement",
      "alternance", "emploi", "compétences", "technique", "code"
    ],
    "terms_offer_uses": [
      "NoCode", "IA", "RNCP", "bootcamp", "POEI", "OPCO",
      "outils NoCode", "bases de données en ligne", "création de sites", "automatisation"
    ],
    "terms_to_avoid": [
      "facile", "sans effort", "garanti", "miracle", "rapide"
    ]
  },
  "emotional_hooks": {
    "fear_of_missing_out": "Les places sont limitées à 25 par promotion",
    "aspiration": "Devenir autonome techniquement, avoir un métier d'avenir bien payé",
    "pain_point": "Rester bloqué dans un travail sans avenir qui ne te passionne plus"
  }
}
```

### Exemple 2 : Investissement
```json
{
  "_meta": {
    "confidence": 88,
    "source": "explicit",
    "needs_review": false,
    "review_reason": null
  },
  "prospect_already_knows": [
    "Julie Bernard a accompagné 6000+ élèves vers la liberté financière",
    "La méthode combine investissement passif et création de business",
    "Il y a une garantie satisfait ou remboursé de 14 jours",
    "Seulement 1H par mois de gestion une fois formé",
    "Il y a 10 mentors pour accompagner les élèves",
    "La note sur la plateforme d'avis est de 4.7/5 avec 350+ avis"
  ],
  "prospect_unclear_about": [
    "Quelle formation Envol choisir selon ma situation ?",
    "Combien d'argent faut-il pour commencer à investir ?",
    "Comment être sûr que la méthode marchera pour moi ?",
    "Combien de temps avant de voir les premiers résultats ?",
    "Est-ce adapté si je n'y connais rien en bourse ?"
  ],
  "key_numbers_to_remember": [
    {
      "number": "6000+",
      "context": "élèves accompagnés",
      "full_phrase": "Plus de 6000 élèves accompagnés depuis 2020"
    },
    {
      "number": "4.7/5",
      "context": "note sur la plateforme d'avis",
      "full_phrase": "Note de 4,7 sur 5 sur la plateforme d'avis"
    },
    {
      "number": "1H/mois",
      "context": "temps de gestion",
      "full_phrase": "Seulement 1 heure par mois de gestion"
    },
    {
      "number": "14 jours",
      "context": "garantie",
      "full_phrase": "Garantie satisfait ou remboursé pendant 14 jours"
    }
  ],
  "founder_mentions": {
    "name": "Julie Bernard",
    "credibility_hook": "312K abonnés sur un réseau social vidéo, 6000+ élèves, 4.7/5 sur la plateforme d'avis",
    "story_hook": "A atteint la liberté financière et partage sa méthode"
  },
  "vocabulary": {
    "terms_prospects_use": [
      "investir", "épargne", "revenus passifs", "liberté financière",
      "bourse", "retraite", "patrimoine", "argent qui travaille"
    ],
    "terms_offer_uses": [
      "ETF", "crypto", "immobilier tokenisé", "business en ligne",
      "Envol", "diversification", "stratégie passive"
    ],
    "terms_to_avoid": [
      "devenir riche rapidement", "sans risque", "garanti", "secret"
    ]
  },
  "emotional_hooks": {
    "fear_of_missing_out": "Chaque mois d'attente = des revenus passifs perdus à vie",
    "aspiration": "Ne plus subir le métro-boulot-dodo, vivre de ses passions",
    "pain_point": "Rester dépendant de son salaire, anxieux pour sa retraite"
  }
}
```

### Exemple 3 : Scaling Business
```json
{
  "_meta": {
    "confidence": 85,
    "source": "explicit",
    "needs_review": false,
    "review_reason": null
  },
  "prospect_already_knows": [
    "Dirigeants Exemple accompagne 1000+ dirigeants depuis 2018",
    "Le portefeuille cumulé dépasse le milliard d'euros de CA",
    "Marc Lefèvre est expert en scaling",
    "Il y a 120+ collaborateurs et 50+ experts",
    "100+ industries couvertes",
    "Résultats mesurables sous 30 jours"
  ],
  "prospect_unclear_about": [
    "Comment ça fonctionne concrètement ?",
    "Combien ça coûte ?",
    "Est-ce adapté à mon secteur ?",
    "Combien de temps dois-je consacrer ?",
    "Comment mon équipe va réagir ?"
  ],
  "key_numbers_to_remember": [
    {
      "number": "1000+",
      "context": "entrepreneurs transformés",
      "full_phrase": "Plus de 1000 entrepreneurs transformés"
    },
    {
      "number": "1 milliard€",
      "context": "CA cumulé clients",
      "full_phrase": "Portefeuille dépassant le milliard d'euros"
    },
    {
      "number": "30 jours",
      "context": "premiers résultats",
      "full_phrase": "Résultats mesurables sous 30 jours"
    },
    {
      "number": "x6",
      "context": "croissance Thomas",
      "full_phrase": "Thomas a fait x6 en 4 mois"
    }
  ],
  "founder_mentions": {
    "name": "Marc Lefèvre",
    "credibility_hook": "Portefeuille dépassant le milliard, 120+ collaborateurs",
    "story_hook": "A bâti un écosystème de scaling depuis 2018"
  },
  "vocabulary": {
    "terms_prospects_use": [
      "croissance", "chiffre d'affaires", "équipe", "délégation",
      "processus", "recrutement", "management", "débordé"
    ],
    "terms_offer_uses": [
      "scaling", "hypercroissance", "structuration", "automatisation",
      "CEO", "sortir de l'opérationnel", "système"
    ],
    "terms_to_avoid": [
      "facile", "sans effort", "magique", "du jour au lendemain"
    ]
  },
  "emotional_hooks": {
    "fear_of_missing_out": "Chaque mois de stagnation = dizaines de milliers d'euros manqués",
    "aspiration": "Entreprise qui tourne sans soi, hypercroissance",
    "pain_point": "Prisonnier de son entreprise, débordé, croissance qui stagne"
  }
}
```

## CONTENU À ANALYSER

```
${content}
```

Retourne UNIQUEMENT le JSON, sans texte avant ou après.

