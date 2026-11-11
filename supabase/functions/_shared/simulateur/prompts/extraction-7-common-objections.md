# Extraction Offre - Module 7: COMMON_OBJECTIONS

## CONTEXTE

Tu es un expert en analyse de formations et offres high-ticket pour l'entraînement de commerciaux.
Ce module extrait les OBJECTIONS PROBABLES et leurs éléments de traitement.

## OBJECTIF FINAL

Les objections sont ce qui BLOQUE les prospects. Pour un entraînement réaliste, le persona doit :
- Exprimer des objections CRÉDIBLES
- Avoir des raisons PROFONDES derrière chaque objection
- Être sensible aux bons arguments (reframe, preuve, question)

## COMMENT DÉDUIRE LES OBJECTIONS

Même si les objections ne sont pas listées explicitement, déduis-les depuis :

| Élément du doc | Objections probables |
|----------------|---------------------|
| Prix élevé (>5000€) | "C'est trop cher", "Je n'ai pas les moyens" |
| Longue durée (>6 mois) | "C'est trop long", "Je n'ai pas le temps" |
| Formation tech/nouvelle | "Je ne suis pas capable", "C'est trop technique" |
| Promesses importantes | "C'est trop beau pour être vrai", "C'est une arnaque" |
| Garantie mentionnée | Ils anticipent la méfiance → objection trust |
| FAQ sur le conjoint | Objection conjoint fréquente |
| Témoignages "j'hésitais" | L'objection mentionnée était fréquente |

## STRUCTURE D'UNE OBJECTION

Pour chaque objection :
1. **surface_objection** : Ce que le prospect DIT
2. **underlying_reason** : Ce qu'il RESSENT vraiment (la peur derrière)
3. **typical_trigger** : Quand cette objection sort dans l'appel
4. **frequency** : 1-10 (10 = très fréquente)
5. **treatment_elements** : Comment traiter
   - reframe : Recadrer le problème
   - proof_to_use : Quelle preuve utiliser
   - question_to_ask : Question pour faire réfléchir

## FORMAT DE SORTIE

### Exemple 1 : Formation Tech
```json
{
  "_meta": {
    "confidence": 88,
    "source": "inferred",
    "needs_review": false,
    "review_reason": null
  },
  "objections": [
    {
      "id": "price-expensive",
      "category": "price",
      "surface_objection": "C'est trop cher, 22 000€ c'est énorme",
      "underlying_reason": "Peur de s'endetter pour rien si ça ne marche pas",
      "typical_trigger": "Annonce du prix total",
      "frequency": 9,
      "treatment_elements": {
        "reframe": "Ce n'est pas une dépense mais un investissement avec ROI calculable",
        "proof_to_use": "100% finançable via POEI + OPCO = 0€ de ta poche",
        "question_to_ask": "Si c'était entièrement financé, qu'est-ce qui te retiendrait ?"
      }
    },
    {
      "id": "competence-no-tech",
      "category": "competence",
      "surface_objection": "Je n'ai aucune compétence technique, je ne vais pas y arriver",
      "underlying_reason": "Syndrome de l'imposteur, peur de l'échec public",
      "typical_trigger": "Discussion sur le programme",
      "frequency": 8,
      "treatment_elements": {
        "reframe": "Le NoCode est justement fait pour les non-techniques",
        "proof_to_use": "80% de taux de certification, 0 prérequis technique",
        "question_to_ask": "Qu'est-ce qui te fait penser que tu ne pourrais pas réussir comme les 9000 autres ?"
      }
    },
    {
      "id": "time-duration",
      "category": "time",
      "surface_objection": "15 mois c'est long, je n'ai pas le temps",
      "underlying_reason": "Peur de ne pas tenir, contraintes familiales",
      "typical_trigger": "Explication du format",
      "frequency": 7,
      "treatment_elements": {
        "reframe": "C'est en alternance : tu apprends ET tu gagnes de l'argent",
        "proof_to_use": "3 mois intensifs puis 12 mois en entreprise avec salaire",
        "question_to_ask": "Combien de temps perds-tu chaque semaine dans un travail qui ne te plaît pas ?"
      }
    },
    {
      "id": "spouse-validation",
      "category": "spouse",
      "surface_objection": "Je dois en parler à mon conjoint",
      "underlying_reason": "Besoin de validation, peur du conflit familial",
      "typical_trigger": "Moment de la décision",
      "frequency": 6,
      "treatment_elements": {
        "reframe": "C'est normal, c'est un projet qui vous concerne tous les deux",
        "proof_to_use": "Témoignages de personnes soutenues par leur famille",
        "question_to_ask": "Qu'est-ce qui pourrait le/la rassurer ?"
      }
    }
  ]
}
```

### Exemple 2 : Investissement
```json
{
  "_meta": {
    "confidence": 85,
    "source": "inferred",
    "needs_review": false,
    "review_reason": null
  },
  "objections": [
    {
      "id": "trust-scam",
      "category": "trust",
      "surface_objection": "Les formations en investissement, c'est souvent des arnaques",
      "underlying_reason": "Méfiance due aux scandales passés du secteur",
      "typical_trigger": "Début de conversation ou promesses",
      "frequency": 8,
      "treatment_elements": {
        "reframe": "Ta méfiance est saine, c'est pour ça qu'on a des preuves",
        "proof_to_use": "6000 élèves, 4.7/5 sur la plateforme d'avis, garantie 14 jours",
        "question_to_ask": "Qu'est-ce qui te rassurerait pour avancer sereinement ?"
      }
    },
    {
      "id": "competence-complex",
      "category": "competence",
      "surface_objection": "L'investissement c'est trop compliqué pour moi",
      "underlying_reason": "Peur de perdre de l'argent par ignorance",
      "typical_trigger": "Discussion sur la bourse/crypto",
      "frequency": 7,
      "treatment_elements": {
        "reframe": "La méthode est conçue pour les débutants, 1H/mois suffit",
        "proof_to_use": "Stratégies passives, accompagnement par 10 mentors",
        "question_to_ask": "Et si c'était plus simple que tu ne le penses ?"
      }
    },
    {
      "id": "spouse-money",
      "category": "spouse",
      "surface_objection": "Mon conjoint ne va pas comprendre",
      "underlying_reason": "Peur du jugement sur les dépenses",
      "typical_trigger": "Moment de la décision",
      "frequency": 7,
      "treatment_elements": {
        "reframe": "C'est un investissement pour votre avenir commun",
        "proof_to_use": "Témoignages de couples qui ont réussi ensemble",
        "question_to_ask": "Et si tu lui présentais comme un projet pour votre liberté à deux ?"
      }
    }
  ]
}
```

### Exemple 3 : Scaling Business
```json
{
  "_meta": {
    "confidence": 85,
    "source": "inferred",
    "needs_review": false,
    "review_reason": null
  },
  "objections": [
    {
      "id": "time-busy",
      "category": "time",
      "surface_objection": "Je suis déjà débordé, je n'ai pas le temps",
      "underlying_reason": "Peur que ça rajoute du travail au lieu d'en enlever",
      "typical_trigger": "Discussion sur le format",
      "frequency": 9,
      "treatment_elements": {
        "reframe": "C'est justement parce que tu es débordé que tu as besoin de structurer",
        "proof_to_use": "L'objectif est de te sortir de l'opérationnel",
        "question_to_ask": "Combien d'heures passes-tu sur des tâches que tu devrais déléguer ?"
      }
    },
    {
      "id": "trust-sector",
      "category": "trust",
      "surface_objection": "Mon secteur est différent, ça ne marchera pas",
      "underlying_reason": "Peur d'être un cas particulier non soluble",
      "typical_trigger": "Présentation de la méthode",
      "frequency": 7,
      "treatment_elements": {
        "reframe": "La méthode est déployée dans 100+ industries",
        "proof_to_use": "BTP, immobilier, agences, traiteurs...",
        "question_to_ask": "Qu'est-ce qui te fait penser que ton secteur est si différent ?"
      }
    },
    {
      "id": "past-failure",
      "category": "past_failure",
      "surface_objection": "J'ai déjà essayé des accompagnements, j'ai été déçu",
      "underlying_reason": "Méfiance due à expériences négatives",
      "typical_trigger": "Début de conversation",
      "frequency": 6,
      "treatment_elements": {
        "reframe": "Ta prudence est compréhensible, qu'est-ce qui n'a pas marché ?",
        "proof_to_use": "1000+ entrepreneurs, portefeuille 1 milliard€",
        "question_to_ask": "Qu'est-ce qui serait différent cette fois ?"
      }
    }
  ]
}
```

## CATÉGORIES POSSIBLES
- price | time | competence | trust | spouse | past_failure | timing

## CONTENU À ANALYSER

```
${content}
```

Retourne UNIQUEMENT le JSON, sans texte avant ou après.

