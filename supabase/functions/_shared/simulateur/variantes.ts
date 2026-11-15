// Simulateur · la variante du jour (Romain, 2026-11-15) : à chaque simulation, le prospect généré reçoit une humeur, un contexte,
// parfois une objection de plus et une loquacité tirés au sort, pour qu'un commercial ne puisse pas apprendre les six prospects
// d'une offre par cœur et rencontre les prospects pressés, méfiants ou dérangés des vrais appels. Tirée dans routes.ts à la
// création (`tirerVariante`), copiée dans crm_sim_simulations.persona_data.variante (`appliquerVariante`), lue par les consignes
// du prospect (`blocVariante`) et affichée après l'appel (le commercial ne la connaît pas avant, comme dans la vraie vie).
import type { Persona } from "./types.ts";
import type { Loquacite } from "./build-gated-prompt.ts";

export type ObjectionSupplementaire = { texte: string; vraie_raison: string; declencheur: string };
export type Variante = {
  humeur: string | null;            // libellé lu par une personne
  humeur_consigne: string | null;   // la consigne donnée au prospect
  contexte: string | null;
  contexte_consigne: string | null;
  objection: ObjectionSupplementaire | null;
  loquacite: Loquacite;
  libelle: string;                  // « Manque de temps · Dans la voiture · Une objection de plus »
};

export const HUMEURS: { libelle: string; consigne: string }[] = [
  { libelle: "Manque de temps", consigne: "Tu n'as que 25 minutes au lieu de 45 (un rendez-vous juste après) : tu le dis dans les deux premières minutes, tu relances quand le commercial s'étale (« et concrètement ? »), et tu demandes à aller au concret." },
  { libelle: "Journée épuisante", consigne: "Tu sors d'une journée difficile en classe : au début tes réponses sont plus courtes et sans entrain, tu soupires ; tu te réchauffes seulement si le commercial s'intéresse vraiment à toi." },
  { libelle: "Une formation déjà payée pour rien", consigne: "Tu as déjà payé une formation en ligne qui n'a rien donné (tu ne dis pas laquelle) : tu le dis quand on parle du prix ou de la garantie, et tu demandes des preuves concrètes (des chiffres, des profs comme toi)." },
  { libelle: "Enthousiasme", consigne: "Tu as beaucoup aimé la conférence et tu arrives chaud : tu parles beaucoup, tu poses des questions sur l'offre dès le début, tu peux te précipiter ; mais le prix te refroidit d'un coup, et tu redeviens prudent." },
  { libelle: "Interruptions", consigne: "Tu es dérangé une ou deux fois pendant l'appel (un enfant, une sonnerie, quelqu'un qui entre) : tu demandes de répéter la dernière question, tu perds le fil une fois et tu reviens dessus." },
  { libelle: "Doute sur soi", consigne: "Tu doutes de toi plus que de l'offre : « je suis pas commerciale », « je sais pas me vendre », « les autres y arrivent peut-être » reviennent dès qu'on parle de trouver des élèves ou de fixer un prix." },
];

export const CONTEXTES: { libelle: string; consigne: string }[] = [
  { libelle: "Dans la voiture", consigne: "Tu es dans ta voiture, garé sur un parking entre deux endroits : tu le dis au début, tu n'as rien pour noter, tu demandes qu'on t'envoie les chiffres par écrit." },
  { libelle: "En salle des profs", consigne: "Tu es en salle des profs pendant une heure de trou : tu parles bas, tu fais attention à ce que tu dis devant des collègues, tu peux dire « attends, il y a du monde » une fois." },
  { libelle: "Le conjoint à côté", consigne: "Ton conjoint est à côté de toi et écoute : tu lui rapportes parfois ce que dit le commercial (« il dit que... »), tu dis « on » plus souvent que « je », et au moment du prix tu lui demandes son avis à voix haute." },
  { libelle: "Dix minutes de retard", consigne: "Tu as dix minutes de retard : tu commences par t'excuser (une réunion qui a débordé), tu n'as plus que 35 minutes, et tu le rappelles si le commercial traîne." },
];

export const OBJECTIONS_SUPPLEMENTAIRES: ObjectionSupplementaire[] = [
  { texte: "Une collègue a fait une formation du même genre et ça n'a rien donné.", vraie_raison: "Peur de payer pour rien, comme elle", declencheur: "présentation de l'offre ou prix" },
  { texte: "Je préfère attendre la rentrée de septembre pour me lancer.", vraie_raison: "Peur de ne pas tenir en cours d'année", declencheur: "demande de décision" },
  { texte: "J'ai lu des avis mitigés sur Internet.", vraie_raison: "Besoin d'être rassuré par quelqu'un comme soi", declencheur: "prix ou garantie" },
  { texte: "Quatre heures par semaine, je ne les ai pas.", vraie_raison: "Peur d'échouer par manque de temps", declencheur: "présentation du programme" },
  { texte: "Est-ce que je peux commencer par un mois, pour voir ?", vraie_raison: "Veut limiter le risque, pas s'engager quatre mois", declencheur: "prix" },
  { texte: "Je ne suis pas sûre d'avoir le droit, avec mon statut.", vraie_raison: "Cherche une raison de ne pas décider aujourd'hui", declencheur: "présentation de l'offre" },
];

const LOQUACITES: Loquacite[] = ["bref", "moyen", "bavard"];

/** Tire la variante d'une simulation. `alea` rend des nombres dans [0, 1[ (Math.random en production, fixé dans les tests). */
export function tirerVariante(alea: () => number = Math.random, base: { loquacite?: Loquacite } = {}): Variante {
  const choisir = <T>(liste: T[], u: number) => liste[Math.min(liste.length - 1, Math.floor(u * liste.length))];
  const u1 = alea(), u2 = alea(), u3 = alea(), u4 = alea();
  const humeur = u1 < 0.35 ? null : choisir(HUMEURS, (u1 - 0.35) / 0.65);
  const contexte = u2 < 0.5 ? null : choisir(CONTEXTES, (u2 - 0.5) / 0.5);
  const objection = u3 < 0.4 ? null : choisir(OBJECTIONS_SUPPLEMENTAIRES, (u3 - 0.4) / 0.6);
  const reglee: Loquacite = base.loquacite && LOQUACITES.includes(base.loquacite) ? base.loquacite : "moyen";
  const autres = LOQUACITES.filter((l) => l !== reglee);
  const loquacite = u4 < 0.6 ? reglee : u4 < 0.8 ? autres[0] : autres[1];
  const v: Variante = {
    humeur: humeur?.libelle ?? null, humeur_consigne: humeur?.consigne ?? null,
    contexte: contexte?.libelle ?? null, contexte_consigne: contexte?.consigne ?? null,
    objection, loquacite, libelle: "",
  };
  v.libelle = libelleVariante(v, reglee);
  return v;
}

export function libelleVariante(v: Variante, loquaciteReglee?: Loquacite): string {
  const parts = [v.humeur, v.contexte, v.objection ? "Une objection de plus" : null,
    v.loquacite !== (loquaciteReglee ?? v.loquacite) ? ({ bref: "Plutôt bref", moyen: "Loquacité moyenne", bavard: "Plutôt bavard" } as Record<Loquacite, string>)[v.loquacite] : null];
  return parts.filter(Boolean).join(" · ") || "Prospect tel quel";
}

/** Le prospect de la simulation : une copie avec la loquacité tirée, l'objection de plus et la variante elle-même. */
export function appliquerVariante(persona: Persona, v: Variante): Persona {
  const objections = [...(persona.objections ?? [])];
  if (v.objection && !objections.some((o) => o.texte === v.objection!.texte)) objections.push({ ...v.objection } as any);
  return { ...persona, objections, loquacite: v.loquacite, variante: v } as Persona;
}

/** Le bloc « AUJOURD'HUI » des consignes du prospect ; vide sans variante ou sans rien de particulier. */
export function blocVariante(persona: Persona): string {
  const v = (persona as any).variante as Variante | undefined;
  if (!v) return "";
  const lignes: string[] = [];
  if (v.humeur_consigne) lignes.push(`- ${v.humeur_consigne}`);
  if (v.contexte_consigne) lignes.push(`- ${v.contexte_consigne}`);
  if (v.objection) lignes.push(`- Une objection de plus, à sortir comme les autres quand son déclencheur arrive (${v.objection.declencheur}) : "${v.objection.texte}"`);
  if (!lignes.length) return "";
  return `AUJOURD'HUI (ce qui change pour cet appel, en plus de tout le reste ; tu ne l'annonces pas comme une consigne, tu le vis) :\n${lignes.join("\n")}\n`;
}
