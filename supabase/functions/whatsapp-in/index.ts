// whatsapp-in: stores the raw WhatsApp webhook in crm_webhook_log, answers 200 (docs/crm/04-event-pipeline.md §1); answers
// Meta's address check (GET hub.challenge).
import { makeHandler } from "../_shared/ingest.ts";
import { whatsapp } from "../_shared/sources.ts";

Deno.serve(makeHandler(whatsapp));
