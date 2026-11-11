// Simulateur · écrit prompts.ts (les consignes en chaînes TypeScript) à partir des fichiers .md de ce dossier, qui restent la
// source. Les fonctions Edge sont empaquetées : des chaînes dans le code se déploient toujours, un fichier lu au démarrage pas
// forcément. À relancer après chaque changement d'un .md : `node supabase/functions/_shared/simulateur/prompts/build.mjs`.
// Découpage identique au chargeur d'origine : « ## SYSTEM PROMPT » + bloc ``` et « ## USER PROMPT TEMPLATE » + bloc ```, sinon
// les lignes « SYSTEM PROMPT » et « USER PROMPT TEMPLATE » sans balisage. Les consignes d'extraction sont envoyées entières.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ici = dirname(fileURLToPath(import.meta.url));

function decouper(nom, texte) {
  const sys = texte.match(/## SYSTEM PROMPT\s*```[\w]*\s*([\s\S]*?)```/);
  const usr = texte.match(/## USER PROMPT(?: TEMPLATE)?\s*```[\w]*\s*([\s\S]*?)```/);
  if (sys && usr) return { system: sys[1].trim(), user: usr[1].trim() };
  const sys2 = texte.match(/(?:^|\n)SYSTEM PROMPT\s*\n([\s\S]*?)(?=\nUSER PROMPT)/);
  const usr2 = texte.match(/(?:^|\n)USER PROMPT(?: TEMPLATE)?\s*\n([\s\S]*?)$/);
  const system = sys?.[1]?.trim() ?? sys2?.[1]?.trim() ?? "";
  const user = usr?.[1]?.trim() ?? usr2?.[1]?.trim();
  if (!user) throw new Error(`${nom} : pas de partie USER PROMPT`);
  return { system, user };
}

const lire = (f) => readFileSync(join(ici, f), "utf8");
const extraction = readdirSync(ici).filter((f) => /^extraction-\d+-.+\.md$/.test(f))
  .sort((a, b) => Number(a.split("-")[1]) - Number(b.split("-")[1]));
if (extraction.length !== 10) throw new Error(`10 consignes d'extraction attendues, ${extraction.length} trouvées`);

const lignes = [
  "// Généré par build.mjs à partir des fichiers .md de ce dossier : ne pas modifier à la main.",
  "",
  "// Les 10 modules d'extraction de l'offre : le texte entier est le message ; « ${content} » reçoit les sources.",
  "export const EXTRACTION: Record<string, string> = {",
  ...extraction.map((f) => `  ${JSON.stringify(f.replace(/\.md$/, ""))}: ${JSON.stringify(lire(f))},`),
  "};",
  "",
  "// La matrice des 6 prospects (variables ${offerData}, ${targetAudience})",
  `export const PERSONA_MATRICE = ${JSON.stringify(decouper("persona-matrix.md", lire("persona-matrix.md")), null, 2)};`,
  "",
  "// Un prospect complet (27 variables, voir offres.ts)",
  `export const PERSONA_COMPLET = ${JSON.stringify(decouper("persona-complete.md", lire("persona-complete.md")), null, 2)};`,
  "",
];
writeFileSync(join(ici, "prompts.ts"), lignes.join("\n"));
console.log(`prompts.ts écrit (${extraction.length} extractions + 2 consignes de prospects)`);
