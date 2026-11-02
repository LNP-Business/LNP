const FAKE = new URL("./fake_supabase.js", import.meta.url).href;
export async function resolve(spec, ctx, next) {
  if (spec === "@supabase/supabase-js") return { url: FAKE, shortCircuit: true };
  return next(spec, ctx);
}
