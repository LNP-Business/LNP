// sendblue-in: stores the raw sendblue webhook in crm_webhook_log, answers 200 (docs/crm/04-event-pipeline.md §1).
import { makeHandler } from "../_shared/ingest.ts";
import { sendblue } from "../_shared/sources.ts";

Deno.serve(makeHandler(sendblue));
