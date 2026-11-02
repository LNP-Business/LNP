// process-inbox: turns raw crm_webhook_log rows into CRM facts (docs/crm/04-event-pipeline.md §2). Called every minute by
// pg_cron (006_crm_cron.sql). It takes no input: whoever calls it only makes the queue move, so it needs no JWT.
import { makeWorker } from "../_shared/worker.ts";

Deno.serve(makeWorker());
