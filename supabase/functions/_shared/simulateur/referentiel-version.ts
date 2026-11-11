/**
 * Version du référentiel de simulation, gardée sur chaque simulation à sa création.
 *
 * v0.12 (19/08/2026) : le prospect simulé cesse de récompenser les questions
 * en « pourquoi » (il se justifie au lieu de s'ouvrir) ; le commercial simulé
 * parle d'impact, plus d'« implications », et ne pose jamais de « pourquoi ».
 * Les simulations créées sans version (NULL) précèdent cette doctrine et ne
 * se comparent pas à celles créées sous v0.12.
 *
 * À incrémenter à CHAQUE changement de doctrine des prompts de simulation
 * qui rend les populations avant/après non comparables.
 */
export const VERSION_REFERENTIEL_SIMULATION = "v0.12";
