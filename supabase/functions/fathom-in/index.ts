// fathom-in: stores the raw fathom webhook in crm_webhook_log, answers 200 (docs/crm/04-event-pipeline.md §1).
import { makeHandler } from "../_shared/ingest.ts";
import { fathom } from "../_shared/sources.ts";

Deno.serve(makeHandler(fathom));
