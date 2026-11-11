-- Simulateur : l'offre LNP « Accompagnement Les Nouveaux Profs », prête à l'emploi (statut ready), écrite d'après
-- app/training/academie_contenu.json (fiche mémo et cas de l'Académie sales LNP) : les modules de l'offre (identité, promesse, cible,
-- structure, prix, preuves, objections, parcours, contexte de vente, contenu pour la simulation), les règles de LNP, et les champs lus
-- par les consignes du prospect (offer_identity, offer_details, tools_taught). Rien d'inventé : ce que le fichier ne dit pas vaut null.
-- Aucun prospect ici : un administrateur les génère depuis l'écran (« Générer les prospects »).
-- Peut être rejoué (on conflict do nothing).

insert into crm_sim_offers (id, name, description, price, sector, data, sources, fingerprint, status, archived)
values (
  'b1a7c0de-0000-4000-8000-000000000057',
  'Accompagnement Les Nouveaux Profs',
  'Apprendre à trouver ses propres élèves et à vendre une offre premium de cours particuliers, en 4 mois, avec un coach dédié et une communauté de profs, jusqu''à ne plus avoir besoin de nous.',
  '3 000 €',
  'coaching',
  $lnp${
  "identity": {
    "_meta": {
      "confidence": 95,
      "source": "explicit",
      "needs_review": false,
      "review_reason": null
    },
    "company": {
      "name": "Les Nouveaux Profs",
      "description": "On aide des profs à trouver leurs propres élèves et à vendre une offre premium de cours particuliers, en 4 mois, avec un coach et une communauté.",
      "founded": "juin 2024",
      "team_size": null,
      "locations": []
    },
    "founder": {
      "name": "Antoine",
      "title": "Fondateur",
      "story": "Ingénieur de formation, prof particulier à plein temps depuis 2020 : trois ans de galère à 25 €/h, puis le déclic en se rendant visible ; son tarif est passé de 20 à 80 €/h. Il a créé LNP en juin 2024 pour transmettre ce qu'il a compris.",
      "authority_proof": "Plus de 4 500 h de cours particuliers, surtout en maths"
    },
    "certifications": [],
    "domain": "coaching",
    "positioning": "Apprendre à pêcher plutôt que recevoir du poisson : le prof apprend à trouver ses propres élèves, à se positionner en spécialiste et à vendre une offre premium, pour sortir de la course au prix."
  },
  "value_proposition": {
    "_meta": {
      "confidence": 95,
      "source": "explicit",
      "needs_review": false,
      "review_reason": null
    },
    "main_promise": "Apprendre à trouver ses propres élèves et à vendre une offre premium de cours particuliers, en 4 mois, avec un coach dédié et une communauté de profs, jusqu'à ne plus avoir besoin de nous.",
    "before_after": {
      "before": "Prof qui dépend d'une plateforme ou d'un organisme, cours peu payés (15 à 25 €/h), demandes en baisse, ne sait pas se vendre",
      "after": "Prof autonome qui trouve ses propres élèves, se positionne en spécialiste et vend une offre premium ; à la fin des 4 mois, ceux qui bossent donnent des cours à 40-50 €/h"
    },
    "key_benefits": [
      {
        "benefit": "Un coach dédié, qui est prof",
        "proof": "Contact sous 24 h après la signature, 4 visios individuelles, messagerie 7j/7 (réponse sous 24 à 48 h), relecture des pubs, roleplays"
      },
      {
        "benefit": "Apprendre à vendre, pas seulement à trouver des élèves",
        "proof": "Vidéos (appel de setting, appel diagnostic, les 20 règles d'or), sessions de roleplay"
      },
      {
        "benefit": "Gagner plus sans ajouter d'heures",
        "proof": "Scripts pour augmenter ses tarifs, passage aux cours en groupe"
      },
      {
        "benefit": "Une garantie où le risque est chez nous",
        "proof": "Remboursement de la différence ou prolongation jusqu'à 6 mois au total, sous condition"
      }
    ],
    "unique_mechanism": "Une roadmap par axes (mindset, avatar, offre, première publicité image, premier appel de setting, premier appel diagnostic, première vente), une action sous chaque vidéo, un coach qui recadre, des sessions de groupe plusieurs fois par semaine",
    "key_results": {
      "salary_or_revenue": "Ordres de grandeur de ceux qui bossent : mois 1, 2 à 3 élèves ; mois 2, 3 à 4 ; mois 3, 4 à 5 ; 5 000 €/mois et plus atteignable. Aucune moyenne, aucun plancher.",
      "freelance_rate": "40-50 €/h à la fin des 4 mois (ceux qui bossent)",
      "timeframe": "4 mois",
      "success_rate": null
    }
  },
  "target_audience": {
    "_meta": {
      "confidence": 80,
      "source": "inferred",
      "needs_review": false,
      "review_reason": null
    },
    "constraints": {
      "gender_target": "all",
      "age_range": null,
      "geographic_target": {
        "countries": [
          "France"
        ],
        "regions": [],
        "restriction_level": null
      },
      "industries": [
        "Enseignement",
        "Cours particuliers"
      ],
      "excluded_profiles": [
        "Prof qui vise moins de 1 000 €/mois de plus : l'accompagnement ne se justifie pas, on le lui dit",
        "Prof qui ne peut pas dégager 4 h par semaine"
      ]
    },
    "ideal_profiles": [
      {
        "id": "prof-en-complement",
        "label": "Prof de l'Éducation nationale qui veut un complément de revenu",
        "description": "Enseignant titulaire qui veut donner des cours particuliers dans sa discipline, sur son temps libre, en micro-entreprise",
        "typical_jobs": [
          "Prof en collège",
          "Prof en lycée",
          "Professeure des écoles"
        ],
        "typical_age_range": null,
        "typical_situation": "En poste, peu de temps le soir, conjoint associé à la décision",
        "current_revenue": null,
        "target_revenue": null,
        "pain_points": [
          {
            "surface": "Je ne sais pas comment trouver des élèves",
            "deep": "Peur de mettre 3 000 € sans résultat"
          },
          {
            "surface": "J'ai le droit ? Mes collègues vont voir ma pub ?",
            "deep": "Peur d'avoir des ennuis avec sa hiérarchie"
          }
        ],
        "motivations": [
          "Complément de revenu",
          "Transmettre sa matière autrement"
        ],
        "gap_calculation": null
      },
      {
        "id": "prof-plateforme",
        "label": "Prof particulier qui dépend d'une plateforme ou d'un organisme",
        "description": "Donne déjà des cours, mais à 15-25 €/h, avec des demandes en baisse ou des trajets non payés",
        "typical_jobs": [
          "Prof particulier",
          "Prof d'organisme de cours à domicile"
        ],
        "typical_age_range": null,
        "typical_situation": "Des heures de cours, un taux horaire bas",
        "current_revenue": null,
        "target_revenue": null,
        "pain_points": [
          {
            "surface": "Les demandes baissent",
            "deep": "Dépendre d'un intermédiaire qui fixe les règles"
          },
          {
            "surface": "Je n'ose pas dire mon prix",
            "deep": "Ne pas se sentir légitime à vendre"
          }
        ],
        "motivations": [
          "Trouver ses propres élèves",
          "Monter ses tarifs"
        ],
        "gap_calculation": null
      },
      {
        "id": "prof-qui-reussit",
        "label": "Prof qui réussit déjà et veut changer d'échelle",
        "description": "Ne manque pas d'élèves ; son levier est d'augmenter ses prix, de s'outiller et de passer aux cours en groupe",
        "typical_jobs": [
          "Prof particulier à plein temps"
        ],
        "typical_age_range": null,
        "typical_situation": "Agenda plein en individuel",
        "current_revenue": null,
        "target_revenue": null,
        "pain_points": [
          {
            "surface": "Si j'augmente mes prix, mes élèves vont partir",
            "deep": "Peur de perdre ce qui fonctionne"
          }
        ],
        "motivations": [
          "Gagner plus sans ajouter d'heures"
        ],
        "gap_calculation": null
      },
      {
        "id": "prof-en-reconversion",
        "label": "Prof de l'Éducation nationale qui prépare sa sortie",
        "description": "Épuisé, cherche un nouveau métier ; doit être prêt à s'investir, c'est un nouveau métier qui demande du travail",
        "typical_jobs": [
          "Prof en collège ou lycée"
        ],
        "typical_age_range": null,
        "typical_situation": "Peu d'énergie le soir, plan B",
        "current_revenue": null,
        "target_revenue": null,
        "pain_points": [
          {
            "surface": "Je veux quitter l'Éducation nationale",
            "deep": "Peur de ne pas en être capable"
          }
        ],
        "motivations": [
          "Un nouveau métier",
          "L'autonomie"
        ],
        "gap_calculation": null
      }
    ],
    "prerequisites": {
      "required": [
        "4 h par semaine minimum (5 à 6 recommandées)",
        "Une matière à transmettre"
      ],
      "recommended": [
        "Un budget pub à partir de 180 €/mois (500 € lancés avant la fin du 2e mois pour la garantie)"
      ],
      "not_required": [
        "Avoir déjà donné des cours particuliers",
        "Savoir vendre"
      ]
    }
  },
  "offer_structure": {
    "_meta": {
      "confidence": 95,
      "source": "explicit",
      "needs_review": false,
      "review_reason": null
    },
    "format": "online",
    "duration": {
      "total": "4 mois",
      "breakdown": [
        {
          "phase": "Démarrage",
          "duration": "première semaine",
          "description": "Le coach dédié contacte le prof sous 24 h après la signature, puis appel Starter en petit groupe ; accès à la plateforme et à la roadmap"
        },
        {
          "phase": "Accompagnement",
          "duration": "4 mois",
          "description": "Modules par axes, sessions de groupe plusieurs fois par semaine, visios individuelles, messagerie"
        },
        {
          "phase": "Bilan",
          "duration": "à 4 mois",
          "description": "Bilan avec le coach ; la garantie s'applique si le travail est fait sans avoir récupéré la mise"
        }
      ]
    },
    "schedule": {
      "time_commitment": "4 h par semaine minimum, 5 à 6 recommandées",
      "flexibility": "flexible"
    },
    "components": [
      {
        "name": "Coach dédié",
        "description": "Un prof : 4 sessions individuelles (offre et avatar, puis une par mois), messagerie 7j/7 réponse sous 24 à 48 h, relecture des pubs, roleplays",
        "value_highlight": "On n'est pas lâché dans la nature"
      },
      {
        "name": "Plateforme 24h/24",
        "description": "Tous les modules par axes (dont « Attire tes élèves » et « Groupe tes élèves »), une action sous chaque vidéo",
        "value_highlight": "Aucun module à débloquer"
      },
      {
        "name": "Sessions de groupe en visio",
        "description": "Plusieurs fois par semaine, toutes rediffusées : questions générales, flash coachings, session vente, session pub, roleplays",
        "value_highlight": "Replays de tout"
      },
      {
        "name": "Communauté de 250 profs",
        "description": "Forum et salon d'échange d'élèves",
        "value_highlight": "Entraide entre profs"
      },
      {
        "name": "Bonus : module micro-entreprise de A à Z",
        "description": "Statut, réduction d'impôt pour les familles",
        "value_highlight": "Les questions administratives réglées"
      }
    ],
    "tools_taught": [
      "Première publicité image (ciblage large, formulaire instantané)",
      "Appel de setting",
      "Appel diagnostic",
      "Les 20 règles d'or de la vente",
      "Scripts pour augmenter ses tarifs",
      "Cours en groupe (une salle par élève, puis groupes de même niveau)",
      "Techniques sans budget pub (réseau, groupes en ligne)"
    ],
    "deliverables": [
      "Son avatar",
      "Son offre premium",
      "Sa première publicité image",
      "Sa première vente"
    ],
    "certification": {
      "name": null,
      "level": null,
      "recognized_by": null
    }
  },
  "pricing": {
    "_meta": {
      "confidence": 95,
      "source": "explicit",
      "needs_review": false,
      "review_reason": null
    },
    "main_offer": {
      "name": "Starter",
      "price": 3000,
      "price_display": "3 000 €",
      "currency": "EUR"
    },
    "financing_options": [
      {
        "id": "comptant",
        "name": "3 000 € en une fois",
        "description": "Paiement par carte en une fois",
        "coverage": "100 % de l'accompagnement",
        "eligibility": "Tous",
        "result_for_prospect": "3 000 €"
      },
      {
        "id": "2-fois",
        "name": "2 × 1 600 €",
        "description": "Paiement en 2 fois par carte",
        "coverage": "100 % de l'accompagnement",
        "eligibility": "Tous",
        "result_for_prospect": "3 200 € au total : une facilité, pas une remise"
      },
      {
        "id": "3-fois",
        "name": "3 × 1 100 €",
        "description": "Paiement en 3 fois par carte",
        "coverage": "100 % de l'accompagnement",
        "eligibility": "Tous",
        "result_for_prospect": "3 300 € au total"
      },
      {
        "id": "4-fois",
        "name": "4 × 850 €",
        "description": "Paiement en 4 fois par carte",
        "coverage": "100 % de l'accompagnement",
        "eligibility": "Tous",
        "result_for_prospect": "3 400 € au total"
      },
      {
        "id": "2-fois-sans-frais",
        "name": "2 × 1 500 € sans frais",
        "description": "Lien de paiement en 2 fois sans frais",
        "coverage": "100 % de l'accompagnement",
        "eligibility": "Seulement quand la personne veut payer en une fois et que le plafond de sa carte refuse 3 000 €",
        "result_for_prospect": "3 000 € au total"
      },
      {
        "id": "acompte",
        "name": "Acompte de 1 490 € puis le reste en 3 fois",
        "description": "Sur Starter, après un non budget sur le paiement en 4 fois",
        "coverage": "100 % de l'accompagnement",
        "eligibility": "La personne peut payer 1 490 € comptant",
        "result_for_prospect": "Elle reste sur Starter"
      }
    ],
    "payment_options": [
      "Carte bancaire : tout se paie par carte",
      "Virement seulement après deux tentatives par carte échouées"
    ],
    "guarantee": {
      "type": "Remboursement de la différence ou prolongation sans frais jusqu'à 6 mois au total, au choix du prof",
      "duration": "4 mois",
      "conditions": "Avoir fait le travail, critères écrits au contrat : au moins 70 % des vidéos, au moins 10 sessions de groupe sur 3 mois différents, les appels individuels honorés, au moins 12 échanges avec l'équipe, 500 € de pub lancés avant la fin du 2e mois. Seuil = montant investi (3 000, 3 200, 3 300 ou 3 400 €), comparé au chiffre d'affaires de cours particuliers encaissé pendant les 4 mois."
    },
    "roi_calculation": {
      "investment": 3000,
      "expected_return": "3 élèves × une offre à plus de 500 € = 1 500 € le premier mois (ordre de grandeur de ceux qui bossent, pas une promesse)",
      "payback_period": null
    },
    "other_offers": [
      {
        "name": "Signature",
        "price": 5490,
        "price_display": "5 490 €",
        "payment_options": [
          "2 × 2 950 €",
          "3 × 1 990 €",
          "4 × 1 550 €"
        ],
        "description": "Montrée à tout le monde, en entier : mêmes modules, même communauté, mêmes 4 mois, même bilan ; en plus, sessions individuelles illimitées de 30 min sur demande écrite (calées sous 7 jours), messagerie 7j/7 prioritaire sous 24 h, priorité de créneaux, audit pub de 45 min avec un expert de la publicité."
      },
      {
        "name": "Starter Solo",
        "price": 1490,
        "price_display": "1 490 €",
        "payment_options": [
          "4 × 397 €"
        ],
        "description": "Seulement après un non budget sur Starter en 4 fois et après avoir proposé l'acompte de 1 490 € : session de départ avec un coach, session questions générales hebdomadaire, tous les modules, communauté, point à 4 mois ; pas de messagerie coach, de flash coaching, de roleplay, de sessions vente et pub ni d'expert pub. Passage à Starter à tout moment en payant la différence."
      }
    ],
    "extra_costs": "Aucun coût caché ni module à débloquer ; restent à la charge du prof son matériel pour le distanciel, un logiciel de visio, une tablette graphique, et son budget pub (à partir de 180 €/mois s'il en fait)."
  },
  "social_proof": {
    "_meta": {
      "confidence": 70,
      "source": "explicit",
      "needs_review": false,
      "review_reason": null
    },
    "metrics": {
      "students_trained": {
        "number": 250,
        "display": "250 profs dans la communauté"
      },
      "success_rate": null,
      "satisfaction_score": {
        "score": null,
        "platform": null,
        "reviews_count": null
      },
      "years_active": null,
      "partner_companies": null
    },
    "testimonials": [],
    "media_mentions": [],
    "partners": {
      "academic": [],
      "corporate": []
    },
    "trust_signals": [
      "Les coachs sont des profs",
      "Le fondateur a donné plus de 4 500 h de cours particuliers",
      "La garantie a déjà été activée",
      "Les techniques sans budget pub ont ramené plus de la moitié de ses élèves au fondateur"
    ]
  },
  "common_objections": {
    "_meta": {
      "confidence": 95,
      "source": "explicit",
      "needs_review": false,
      "review_reason": null
    },
    "objections": [
      {
        "id": "garantie-rien-au-bout",
        "category": "trust",
        "surface_objection": "Et si au bout de 4 mois j'ai rien, je récupère mes sous ?",
        "underlying_reason": "3 000 € ce n'est pas rien, et le conjoint va demander « et si ça marche pas ? »",
        "typical_trigger": "Juste après l'annonce du prix",
        "frequency": null,
        "treatment_elements": {
          "reframe": "La garantie porte sur le résultat, pas sur l'envie",
          "proof_to_use": "Avoir fait le travail, critères écrits au contrat : au moins 70 % des vidéos, au moins 10 sessions de groupe sur 3 mois différents, les appels individuels honorés, au moins 12 échanges avec l'équipe, 500 € de pub lancés avant la fin du 2e mois. Seuil = montant investi (3 000, 3 200, 3 300 ou 3 400 €), comparé au chiffre d'affaires de cours particuliers encaissé pendant les 4 mois.",
          "question_to_ask": "Est-ce que ça répond à ce qu'il va te demander ?"
        }
      },
      {
        "id": "prix-trop-cher",
        "category": "price",
        "surface_objection": "Même 850 par mois, je peux pas. Vous avez rien de moins cher ?",
        "underlying_reason": "Budget réellement serré",
        "typical_trigger": "Présentation des facilités de paiement",
        "frequency": null,
        "treatment_elements": {
          "reframe": "D'abord vérifier si 1 490 € comptant est possible (acompte puis le reste en 3 fois sur Starter)",
          "proof_to_use": "Starter Solo, 1 490 € ou 4 × 397 €, présenté honnêtement, seulement à ce moment",
          "question_to_ask": "Est-ce que tu peux payer 1 490 € comptant ?"
        }
      },
      {
        "id": "droit-education-nationale",
        "category": "trust",
        "surface_objection": "Je suis prof titulaire, j'ai le droit ? Et mes collègues vont voir ma pub ?",
        "underlying_reason": "Peur d'avoir des ennuis avec sa hiérarchie",
        "typical_trigger": "Discussion sur la publicité",
        "frequency": null,
        "treatment_elements": {
          "reframe": "Oui, sans autorisation, dans sa discipline, sur son temps libre",
          "proof_to_use": "Article L.123-3 du code général de la fonction publique, avis 2023-003 du collège de déontologie, Conseil d'État juillet 2024 ; réserves : pas de promotion dans son établissement, pas de cours à ses propres élèves",
          "question_to_ask": "Tu veux que je t'envoie le document « Enseignants et cours particuliers, ce que dit la loi » ?"
        }
      },
      {
        "id": "temps-deux-heures",
        "category": "time",
        "surface_objection": "J'ai deux heures par semaine, pas plus.",
        "underlying_reason": "Emploi du temps déjà plein (cours, préparations, copies)",
        "typical_trigger": "Qualification du temps disponible",
        "frequency": null,
        "treatment_elements": {
          "reframe": "4 h par semaine minimum, 5 à 6 recommandées : sinon ce n'est pas le bon moment",
          "proof_to_use": "4 mois à 4 h par semaine, c'est le rythme qui donne des résultats",
          "question_to_ask": "Ces 2 h, c'est une vraie limite, ou ça change pendant les vacances ?"
        }
      },
      {
        "id": "vente-nulle",
        "category": "competence",
        "surface_objection": "Moi la vente, je suis nulle, j'ai jamais rien vendu de ma vie.",
        "underlying_reason": "Ne pas oser dire son prix",
        "typical_trigger": "Présentation de la méthode",
        "frequency": null,
        "treatment_elements": {
          "reframe": "C'est précisément ce qu'on apprend ; le parent a rempli un formulaire, il cherche un prof",
          "proof_to_use": "Vidéos (appel de setting, appel diagnostic, 20 règles d'or), roleplays avec un prof qui joue le parent",
          "question_to_ask": "Qu'est-ce que tu en penses ?"
        }
      },
      {
        "id": "conjoint",
        "category": "spouse",
        "surface_objection": "Mon mari va me demander : et si ça marche pas ?",
        "underlying_reason": "Besoin de pouvoir répéter une réponse claire",
        "typical_trigger": "Moment de la décision",
        "frequency": null,
        "treatment_elements": {
          "reframe": "Une phrase simple qu'elle peut répéter mot pour mot",
          "proof_to_use": "La garantie, telle qu'écrite au contrat",
          "question_to_ask": "Est-ce que ça répond à ce qu'il va te demander ?"
        }
      },
      {
        "id": "plus-tard",
        "category": "timing",
        "surface_objection": "Je reviens vers vous en avril, là c'est pas le moment.",
        "underlying_reason": "Budget ou doute non dit",
        "typical_trigger": "Fin de l'appel",
        "frequency": null,
        "treatment_elements": {
          "reframe": "Les tarifs vont augmenter : le prix d'aujourd'hui est celui en vigueur (jamais de rareté inventée)",
          "proof_to_use": "R2 calée à une date précise, plaquette et témoignages adaptés envoyés d'ici là",
          "question_to_ask": "Au-delà du prix, qu'est-ce qui te fait attendre ?"
        }
      },
      {
        "id": "concurrent",
        "category": "trust",
        "surface_objection": "J'ai un rendez-vous avec un autre programme lundi. Eux, c'est 6 mois.",
        "underlying_reason": "Peur de se tromper de programme",
        "typical_trigger": "Comparaison avec la concurrence",
        "frequency": null,
        "treatment_elements": {
          "reframe": "Jamais de dénigrement : « tu es en finale »",
          "proof_to_use": "La garantie prolonge jusqu'à 6 mois ; 4 mois à 4 h/semaine, c'est le rythme qui donne des résultats ; les coachs sont des profs ; 250 profs dans la communauté",
          "question_to_ask": "Les personnes qui t'accompagnent ont-elles fait ce métier ? Que se passe-t-il si ça ne marche pas ? Montre-moi les preuves."
        }
      }
    ]
  },
  "buyer_journey": {
    "_meta": {
      "confidence": 80,
      "source": "explicit",
      "needs_review": false,
      "review_reason": null
    },
    "entry_points": [
      {
        "channel": "Conférence du dimanche, en direct",
        "percentage_estimate": null,
        "knowledge_level": "Connaît Antoine et la promesse de la conférence (plus de 3 000 € par mois possibles)"
      },
      {
        "channel": "Le guide",
        "percentage_estimate": null,
        "knowledge_level": "N'a pas vu la conférence et ne connaît pas Antoine"
      },
      {
        "channel": "Email",
        "percentage_estimate": null,
        "knowledge_level": "N'a pas vu la conférence"
      }
    ],
    "pre_call_knowledge": {
      "definitely_knows": [
        "Antoine a donné plus de 4 500 heures de cours particuliers",
        "On aide des profs à trouver leurs propres élèves"
      ],
      "probably_knows": [
        "À la conférence, on a parlé de plus de 3 000 € par mois",
        "Il y a une garantie",
        "L'accompagnement dure 4 mois avec un coach"
      ],
      "unclear_points": [
        "La garantie : sur quel montant, et à quelles conditions ?",
        "Est-ce que j'ai le droit, en étant prof titulaire ?",
        "Qui sera mon coach ?",
        "Il se passe quoi après les 4 mois ?",
        "La pub, c'est vous qui la faites ?"
      ],
      "main_concerns": [
        "Mettre 3 000 € sans résultat",
        "Ne pas avoir le temps",
        "Ne pas savoir vendre"
      ]
    },
    "admission_process": [
      {
        "step": 1,
        "name": "R1",
        "description": "Appel en visio : diagnostic, présentation de l'offre, annonce du prix"
      },
      {
        "step": 2,
        "name": "R2",
        "description": "Calée à une date précise quand la décision est différée ; plaquette et témoignages envoyés entre les deux"
      },
      {
        "step": 3,
        "name": "Paiement",
        "description": "Par carte ; le coach contacte le prof sous 24 h"
      }
    ],
    "decision_factors": {
      "typical_decision_time": null,
      "stakeholders": [
        "Conjoint"
      ],
      "key_validation_points": [
        "La garantie et ses critères",
        "Le droit de donner des cours en étant prof",
        "Le temps disponible (4 h par semaine)"
      ]
    }
  },
  "sales_context": {
    "_meta": {
      "confidence": 70,
      "source": "explicit",
      "needs_review": false,
      "review_reason": null
    },
    "call_type": "R1 en visio (diagnostic, présentation, prix), R2 si la décision est différée",
    "call_duration": null,
    "methodology": null,
    "key_phases": [],
    "typical_gap_range": null,
    "critical_moments": [
      {
        "moment": "Annonce du prix",
        "what_happens": "Starter à 3 000 € annoncé en premier, Signature montrée en entier",
        "success_indicator": "Le prospect demande les facilités au lieu de dire non"
      },
      {
        "moment": "La garantie",
        "what_happens": "Le prospect demande s'il récupère sa mise",
        "success_indicator": "Il peut répéter la garantie mot pour mot"
      },
      {
        "moment": "Décision différée",
        "what_happens": "Le prospect veut réfléchir",
        "success_indicator": "R2 calée à une date précise"
      }
    ]
  },
  "content_for_simulation": {
    "_meta": {
      "confidence": 95,
      "source": "explicit",
      "needs_review": false,
      "review_reason": null
    },
    "prospect_already_knows": [
      "Antoine a donné plus de 4 500 heures de cours particuliers",
      "L'accompagnement dure 4 mois avec un coach dédié",
      "À la conférence, on a dit qu'on pouvait dépasser 3 000 € par mois",
      "Il y a une garantie si on n'a pas récupéré sa mise"
    ],
    "prospect_unclear_about": [
      "Si au bout de 4 mois j'ai rien, je récupère mes sous ?",
      "Je suis prof titulaire, j'ai le droit ?",
      "La pub, c'est vous qui la faites pour moi ?",
      "Il se passe quoi après les 4 mois ?",
      "Le coach, il me répond en combien de temps ?",
      "Il y a des frais cachés, des modules à débloquer en plus ?"
    ],
    "key_numbers_to_remember": [
      {
        "number": "4 mois",
        "context": "durée de l'accompagnement",
        "full_phrase": "L'accompagnement dure 4 mois"
      },
      {
        "number": "250",
        "context": "profs dans la communauté",
        "full_phrase": "Il y a 250 profs dans la communauté"
      },
      {
        "number": "4 500 h",
        "context": "cours donnés par Antoine",
        "full_phrase": "Antoine a donné plus de 4 500 heures de cours particuliers"
      },
      {
        "number": "4 h",
        "context": "temps par semaine",
        "full_phrase": "Il faut compter 4 heures par semaine minimum"
      }
    ],
    "founder_mentions": {
      "name": "Antoine",
      "credibility_hook": "Plus de 4 500 h de cours particuliers, tarif passé de 20 à 80 €/h",
      "story_hook": "Trois ans de galère à 25 €/h, puis le déclic en se rendant visible"
    },
    "vocabulary": {
      "terms_prospects_use": [
        "cours particuliers",
        "élèves",
        "complément de revenu",
        "plateforme",
        "organisme",
        "taux horaire"
      ],
      "terms_offer_uses": [
        "avatar",
        "offre premium",
        "roadmap",
        "appel de setting",
        "appel diagnostic",
        "roleplay",
        "flash coaching",
        "salon d'échange d'élèves"
      ],
      "terms_to_avoid": [
        "quoi qu'il arrive",
        "zéro risque",
        "tu n'as rien à perdre",
        "places limitées",
        "ça n'a jamais été activé"
      ]
    },
    "emotional_hooks": {
      "fear_of_missing_out": "Les tarifs vont augmenter (jamais de rareté inventée)",
      "aspiration": "Trouver ses propres élèves et ne dépendre de personne",
      "pain_point": "Des cours peu payés, des demandes en baisse, dépendre d'une plateforme ou d'un organisme"
    }
  },
  "extraction_summary": {
    "overall_confidence": 90,
    "sections_complete": [
      "identity",
      "value_proposition",
      "target_audience",
      "offer_structure",
      "pricing",
      "social_proof",
      "common_objections",
      "buyer_journey",
      "sales_context",
      "content_for_simulation"
    ],
    "sections_needing_review": [],
    "critical_missing": [],
    "ready_for_persona_generation": true,
    "blocking_issues": [],
    "source": "app/training/academie_contenu.json (fiche mémo et cas de l'Académie sales LNP)"
  },
  "regles_lnp": {
    "education_nationale": "Droit de donner des cours particuliers sans autorisation : article L.123-3 du code général de la fonction publique, avis 2023-003 du collège de déontologie, Conseil d'État juillet 2024. Réserves : pas de promotion auprès de son établissement, pas de cours à ses propres élèves. Moins de 1 000 €/mois visés : l'accompagnement ne se justifie pas, on le lui dit.",
    "fiscalite": "TVA : cours particuliers exonérés même au-delà du seuil de la micro-entreprise (BOI-TVA-CHAMP-30-10-20-50). Réduction d'impôt : présentiel au domicile de l'élève seulement ; une coopérative de services à la personne recommandée dans les bonus de l'offre.",
    "resultats": "Aucune moyenne, aucun plancher. Ceux qui bossent : mois 1, 2-3 élèves ; mois 2, 3-4 ; mois 3, 4-5 ; fin des 4 mois, 40-50 €/h ; 5 000 €/mois et plus atteignable. Pub : à partir de 180 €/mois ; lead ≈ 10 €, client ≈ 30 €.",
    "paiement": "Tout par carte. Plafond de carte : lien 2 × 1 500 € sans frais, et seulement dans ce cas. Virement seulement après 2 échecs de carte.",
    "concurrents": "Jamais de dénigrement. Trois questions : les personnes qui t'accompagnent ont-elles fait ce métier ? Que se passe-t-il si ça ne marche pas ? Montre-moi les preuves. 6 mois contre 4 : la garantie prolonge jusqu'à 6 mois, et 4 mois à 4 h/semaine, c'est le rythme qui donne des résultats.",
    "decision_differee": "Annoncer la hausse de tarif, jamais de rareté inventée. Caler la R2 à une date précise. Envoyer plaquette et témoignages adaptés entre R1 et R2."
  },
  "offer_identity": {
    "company_name": "Les Nouveaux Profs",
    "main_promise": "Apprendre à trouver ses propres élèves et à vendre une offre premium de cours particuliers, en 4 mois, avec un coach dédié et une communauté de profs, jusqu'à ne plus avoir besoin de nous.",
    "positioning": "Apprendre à pêcher plutôt que recevoir du poisson : le prof apprend à trouver ses propres élèves, à se positionner en spécialiste et à vendre une offre premium, pour sortir de la course au prix."
  },
  "offer_details": {
    "main_offer": {
      "price": "3 000 €",
      "duration": "4 mois",
      "financing_options": [
        "3 000 € en une fois",
        "2 × 1 600 €",
        "3 × 1 100 €",
        "4 × 850 €",
        "2 × 1 500 € sans frais",
        "Acompte de 1 490 € puis le reste en 3 fois"
      ]
    }
  },
  "tools_taught": [
    {
      "name": "Première publicité image (ciblage large, formulaire instantané)"
    },
    {
      "name": "Appel de setting"
    },
    {
      "name": "Appel diagnostic"
    },
    {
      "name": "Les 20 règles d'or de la vente"
    },
    {
      "name": "Scripts pour augmenter ses tarifs"
    },
    {
      "name": "Cours en groupe (une salle par élève, puis groupes de même niveau)"
    },
    {
      "name": "Techniques sans budget pub (réseau, groupes en ligne)"
    }
  ]
}$lnp$::jsonb,
  $lnp$[{"type": "txt", "filename": "app/training/academie_contenu.json", "note": "Offre écrite à la main d'après la fiche mémo et les cas de l'Académie sales LNP ; pas de texte à ré-analyser."}]$lnp$::jsonb,
  'lnp:accompagnement-les-nouveaux-profs',
  'ready',
  false)
on conflict do nothing;
