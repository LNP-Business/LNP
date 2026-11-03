# 09 — Call analysis with Claude

When a Fathom recording with a transcript is attached to a call, the CRM asks Claude to analyse
it with the LNP method and fills the lead record tabs "Prospect analysis" and "Next call".

This is the Agent System agent **Post-call analyst** (Sales). Every run writes a `crm_agent_runs`
row (trigger `call_recorded`, status, duration, tokens, cost) so it shows in Agent System › Log;
its output is a proposal shown in the lead record and never changes a status.

The analysis grid itself is **DEFERRED** (F9). Build the pipeline with a versioned prompt file so
the grid can change without code changes.

## 1. Pipeline (`claude-analyze`)

1. Triggered by `call_recorded` when `crm_calls.transcript` is not empty → insert
   `crm_call_analyses(status = 'queued', method_version = <current>, model = <crm_settings.analysis_model>)`.
2. Build the input: call metadata (rank, duration, product), previous analyses of the cycle,
   transcript with speakers marked SALES / PROSPECT (team member vs external invitee).
3. Call the Anthropic Messages API with the system prompt from
   `supabase/functions/claude-analyze/prompts/<method_version>.md` and a **tool / JSON schema** for
   the output (structured output, no free text parsing).
4. Validate the JSON against the schema. Invalid → one retry, then `failed`.
5. Store `result`, token counts, `completed_at`; write `analysis_ready` event.

Model: configurable in `crm_settings.analysis_model` (proposal: `claude-sonnet-5-5`). Never hard-code.

## 2. Output schema (v0 skeleton — the grid content is DEFERRED)

```json
{
  "method_version": "v0",
  "quality": "ok | insufficient",
  "insufficient_reason": "string | null",
  "prospect": {
    "situation": [{ "claim": "string", "evidence": [{ "quote": "string", "timestamp": "HH:MM:SS" }] }],
    "pains":     [{ "claim": "string", "evidence": [ ... ] }],
    "stakes":    [{ "claim": "string", "quantified": true, "evidence": [ ... ] }],
    "decision_process": { "decider": "string", "others_involved": ["string"], "evidence": [ ... ] },
    "objections": [{ "type": "string", "handled": "yes | partly | no", "evidence": [ ... ] }]
  },
  "grid": {},                       // DEFERRED: SPIN levels, registers, depth… per the final grid
  "next_call": {
    "goals": ["string"],
    "questions_to_ask": ["string"],
    "risks": ["string"]
  }
}
```

## 3. Guardrails

- **No conclusion without evidence**: every claim carries at least one verbatim quote with its
  timestamp; the validator rejects claims with empty `evidence`.
- Thin or partial transcripts → `quality = "insufficient"`; the UI shows "Not enough material".
- Claude never changes a status, an outcome or a stage.
- The transcript is personal data: send only what is needed, never store prompts with secrets,
  respect the retention policy (12).
- Review loop: the sales lead rates a weekly sample (`review_score`, `review_note`). Reviews feed
  the next prompt version.
