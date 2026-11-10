// lead-in: stores the raw lead of a funnel (quiz, VSL, webinar) in crm_webhook_log, answers 200; process-inbox turns it into a
// setter's « Lead à contacter » (crm_apply_leads, migration 054).
import { makeHandler } from "../_shared/ingest.ts";
import { funnel } from "../_shared/sources.ts";

Deno.serve(makeHandler(funnel));
