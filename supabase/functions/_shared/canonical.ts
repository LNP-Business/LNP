// The canonical item every mapper produces (docs/crm/04-event-pipeline.md §2).
export type Canonical = {
  source: "iclosed" | "fathom" | "sendblue" | "whop";
  source_id: string;
  type: string;
  occurred_at: string;
  actor: "sales" | "prospect" | "auto" | "system";
  channel: string;
  content?: string;
  identity: { email?: string; phone?: string; iclosed_contact_id?: string; whop_user_id?: string; whop_member_id?: string; name?: string;
              emails?: string[] };   // emails: every candidate email of a Fathom recording (025, FL-2 a)
  refs?: Record<string, string | number>;
  data: Record<string, unknown>;
};

// A mapper returns items to apply, or a reason to keep the row as "ignored". It throws when the payload cannot be read.
export type MapResult = { items: Canonical[] } | { ignored: string };
