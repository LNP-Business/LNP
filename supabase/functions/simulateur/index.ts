// simulateur : Entraînement › Simulateur (Romain 2026-11-11). L'appel de vente simulé avec un prospect joué par Claude, en texte
// ou à la voix ; l'analyse de fin d'appel ; les offres et leurs prospects. Chaque appel porte le jeton de la personne (vérifié
// ici : un membre actif de l'équipe), la fonction écrit avec la clé de service. Secrets : ANTHROPIC_API_KEY (obligatoire),
// ELEVENLABS_API_KEY (facultatif : sans elle, le navigateur prête sa voix au prospect).
import { appelant, dbRest } from "../_shared/simulateur/base.ts";
import { app } from "../_shared/simulateur/routes.ts";
import { elevenLabs } from "../_shared/simulateur/voix.ts";
import { creerAnalyse } from "../_shared/simulateur/grille/index.ts";

const base = Deno.env.get("SUPABASE_URL") ?? "";
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const eleven = Deno.env.get("ELEVENLABS_API_KEY") ?? "";
const db = dbRest(base, service);
// deno-lint-ignore no-explicit-any
const waitUntil = (p: Promise<unknown>) => { try { (globalThis as any).EdgeRuntime?.waitUntil(p); } catch { /* hors Supabase */ } };

Deno.serve(app({
  db,
  anthropicKey,
  // la clé de service (tâche planifiée qui relance les analyses en attente) agit en administrateur ; sinon le jeton d'une personne
  auth: (jeton) => jeton && (jeton === service || jeton === Deno.env.get("SUPABASE_SECRET_KEY"))
    ? Promise.resolve({ id: "00000000-0000-0000-0000-000000000000", email: "", role: "admin", admin: true })
    : appelant(base, service, jeton, db),
  tts: eleven ? (p) => elevenLabs(eleven, p) : null,
  // l'analyse de fin d'appel (grille d'analyse), en arrière-plan après la réponse
  analyse: creerAnalyse({ db, anthropicKey, waitUntil }),
  waitUntil,
}));
