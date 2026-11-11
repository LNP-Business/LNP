export type SimulationModeId = 'full' | 'diagnostic' | 'objections';

export interface SimulationMode {
  id: SimulationModeId;
  name: string;
  description: string;
  criteria: number[];
  startPhase: number;
  preContext?: string;
}

export const SIMULATION_MODES: Record<string, SimulationMode> = {
  full: {
    id: 'full',
    name: 'Appel complet',
    description: 'Parcours complet',
    criteria: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30],
    startPhase: 1,
  },
  diagnostic: {
    id: 'diagnostic',
    name: 'Mode Diagnostic',
    description: 'Entrainement sur la decouverte et creation du GAP - 6 criteres',
    criteria: [7, 8, 9, 10, 11, 12, 13],
    startPhase: 3,
    preContext: 'Ice Breaker et Cadrage valides'
  },
  objections: {
    id: 'objections', 
    name: 'Mode Objections',
    description: 'Entrainement au traitement des objections (methode AIC) - 2 criteres',
    criteria: [24, 25],
    startPhase: 6,
    preContext: 'Phases 1-5 validees, prix annonce'
  }
};

export const simulationModes = Object.values(SIMULATION_MODES);
export const getSimulationModeById = (id: SimulationModeId): SimulationMode => SIMULATION_MODES[id] || SIMULATION_MODES.full;

export interface ConversationHistorySummary {
  douleurIdentifiee: string;
  objectifIdentifie: string;
  urgence: string;
  disponibilite: string;
  gap: {
    pointA: string;
    pointB: string;
    coutInaction: {
      financier: string | null;
      temps: string | null;
      total: string | null;
    };
  };
}

export interface ConversationHistory {
  summary: ConversationHistorySummary;
}
