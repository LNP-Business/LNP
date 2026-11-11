// ============================================
// NOUVEAUX TYPES POUR PERSONAS GÉNÉRÉS
// ============================================

export interface MessagesInitiaux {
  diagnostic: string; // Message d'ouverture en mode diagnostic
  objections: string; // Réaction après l'annonce du prix en mode objections
}

export interface OfferContext {
  source: string; // Comment il a connu l'offre (ex: 'Webinaire live')
  ce_qui_attire: string; // Ce qui l'a accroché
  ce_qui_retenu: string; // Ce qu'il a retenu (fondateur, chiffres...)
  ce_qui_pas_compris: string; // Zones de flou, questions
  action_deja_faite: string; // Ce qu'il a déjà fait (téléchargé brochure, etc.)
}

// ============================================
// TYPES EXISTANTS
// ============================================

export interface Objection {
  texte: string;
  vraie_raison: string;
  declencheur: string;
}

export interface ObjectionPrix {
  surface: string;
  vraie_objection: string;
}

export interface ObjectionsModeData {
  prixOffre: string;
  gap: {
    financier: string;
    temps: string;
    total: string;
  };
  objectionPrix: ObjectionPrix;
  historique?: string;
}

export interface AttentesAppel {
  pourquoi_appel: string;
  attentes_echange: string;
}

export interface NiveauConscience {
  niveau: 1 | 2 | 3 | 4 | 5;
  label:
    | "UNAWARE"
    | "PROBLEM AWARE"
    | "SOLUTION AWARE"
    | "PRODUCT AWARE"
    | "MOST AWARE";
  description: string;
  objectif_progression: string;
}

export interface DiagnosticComplet {
  situation_actuelle: {
    situation_negative: string;
    consequences: string;
    emotion_negative: string;
    problem_aware: string;
  };
  situation_desiree: {
    objectif_chiffre: string;
    timeline: string;
    vision_concrete: string;
    emotion_positive: string;
  };
  gap: {
    actuel: number;
    cible: number;
    ecart_mensuel: number;
    cout_annuel_inaction: number;
    validation_prospect: string;
  };
}

export interface Engagement {
  opportunity_aware: string;
  engagement_verbal: string;
  validation_candidature: string;
}

export interface PitchInfo {
  prix_annonce: number;
}

export interface BriefingContextuel {
  attentes_appel: AttentesAppel;
  niveau_conscience: NiveauConscience;
  diagnostic?: DiagnosticComplet;
  engagement?: Engagement;
  pitch?: PitchInfo;
}

export interface Douleurs {
  surface: string[];
  consequences: string[];
  emotionnel: string[];
  identitaire: string[];
}

export interface StyleLinguistique {
  vocabulaire: string[];
  tics: string[];
  phrasesType: string;
  emotionVisible: string;
}

export interface ComportementsUniques {
  siMentionFormation: string;
  siPromesseResultat: string;
  siPrixAvantPhase7: string;
  siConseilNonSollicite: string;
  siReformulationJuste: string;
}

export interface TriggersPositifs {
  reformulationParfaite: { exemple: string };
  silenceApresGAP: { exemple: string };
  empathieAuthentique: { exemple: string };
}

export interface Identite {
  prenom: string;
  gender: "M" | "F";
  age: number;
  ville: string;
  metier: string;
  situation: string;
  ca_actuel: string | null;
  objectif_ca: string | null;
}

export interface EtatsInitiaux {
  conscience: number;
  confiance: number;
  engagement: number;
  etat_emotionnel: string;
}

export interface Persona {
  id: string;

  // ========== NOUVEAU : référence à l'offre ==========
  offer_id?: string;
  
  // ========== Voice assignment (ElevenLabs voice_id) ==========
  voice_id?: string;

  difficulte: 1 | 2 | 3 | 4 | 5;
  identite: Identite;
  etatsInitiaux: EtatsInitiaux;

  // ========== CONTEXTE OFFRE ==========
  // Pour les personas générés dynamiquement (NOUVEAU)
  offerContext?: OfferContext;

  backstory: string;
  douleurs: Douleurs;
  objections: Objection[];
  styleLinguistique: StyleLinguistique;
  comportementsUniques: ComportementsUniques;
  triggersPositifs: TriggersPositifs;
  objectionsMode?: ObjectionsModeData;
  briefing?: BriefingContextuel;

  // ========== NOUVEAU : messages initiaux pour les modes ==========
  pcmType?: 'travaillomane' | 'empathique' | 'promoteur' | 'perseverant';
  messagesInitiaux?: MessagesInitiaux;
}
