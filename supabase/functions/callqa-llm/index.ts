// callqa-llm: the model gateway of the call analysis worker (functions/_shared/callqa_llm.ts). POST, bearer = service role key.
import { handleLlm } from "../_shared/callqa_llm.ts";

Deno.serve((req) => handleLlm(req, {
  anthropicKey: Deno.env.get("ANTHROPIC_API_KEY") ?? "",
  serviceKeys: [Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", Deno.env.get("SUPABASE_SECRET_KEY") ?? ""],
}));
