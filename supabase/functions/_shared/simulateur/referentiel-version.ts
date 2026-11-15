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
/**
 * v0.13 (14/11/2026, Romain : « le simulateur parle très peu par rapport à la réalité des appels ») : longueurs de réponse
 * calibrées sur 549 vrais appels R1 de LNP (46 % de parole pour le prospect, 55 mots par réponse, un quart des réponses
 * au-delà de 80 mots, une réponse sur quatre avec une question), le prospect parle le plus en début d'appel, trait de
 * loquacité par prospect, questions du prospect tirées de l'offre, contradictions des prospects difficiles, la difficulté
 * joue sur le contenu et plus sur la longueur. Les simulations v0.12 et v0.13 ne se comparent pas.
 */
export const VERSION_REFERENTIEL_SIMULATION = "v0.13";
