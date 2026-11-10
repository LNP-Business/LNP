// deno test --allow-env --allow-read supabase/tests
// Fathom recordings (docs/crm/06 §0, 025_crm_fathom_calls.sql): the mapper, the history reader and the worker's routing.
import { engineTranscript, mapFathom, titleNames } from "../functions/_shared/mappers/fathom.ts";
import { fathomHistoryItems, fathomMeetings } from "../functions/_shared/importers/fathom.ts";
import { processPending, Rpc } from "../functions/_shared/worker.ts";

function eq<T>(a: T, b: T, msg = "") {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

const fixture = Deno.readTextFileSync(new URL("../../docs/crm/fixtures/fathom-new_meeting_content_ready.json", import.meta.url));

Deno.test("fathom: a meeting becomes one call_recorded item (fixture)", () => {
  const r = mapFathom(fixture, "2026-10-27T15:50:00Z");
  if (!("items" in r)) throw new Error("not mapped");
  const it = r.items[0];
  eq(it.type, "call_recorded");
  eq(it.source_id, "fathom:recorded:123456789");
  eq(it.occurred_at, "2026-10-27T15:02:00.000Z");
  eq(it.refs, { fathom_recording_id: 123456789, recorder_email: "sales@example.com" });
  eq(it.identity, { emails: ["test.prospect@example.com"] }, "external invitee, never the recorder:");
  eq(it.data.end, "2026-10-27T15:47:00.000Z");
  eq(it.data.names, ["Test Prospect"]);
  eq(it.data.speakers, [{ name: "Sales Rep", email: "sales@example.com" }, { name: "Test Prospect", email: "test.prospect@example.com" }]);
  eq(it.data.transcript_raw, "[00:00:04] Sales Rep: Thanks for joining.\n[00:00:07] Test Prospect: Happy to be here.");
  eq(it.data.summary_md, "## Summary\n- ...");
});

Deno.test("fathom: a recording with no invitee keeps its speakers and the name of its title", () => {
  const r = mapFathom(JSON.stringify({
    recording_id: 42, title: "Updated - Jane  Roe x Design Career Roadmap Call on 28 Oct 2026 with Valentino D",
    recording_start_time: "2026-10-28T20:01:00Z", recorded_by: { name: "Valentino D", email: "Valentino@TheInteriorAcademy.com" },
    calendar_invitees: [],
    transcript: [{ speaker: { display_name: "Valentino D" }, text: "Hi Jane!", timestamp: "00:00:02" },
                 { speaker: { display_name: "Jane" }, text: "Hello:  there", timestamp: "00:00:05" },
                 { speaker: { display_name: "Jane" }, text: " ", timestamp: "00:00:09" }],
  }), "2026-10-28T21:00:00Z");
  if (!("items" in r)) throw new Error("not mapped");
  const it = r.items[0];
  eq(it.identity, { emails: [] });
  eq(it.refs!.recorder_email, "valentino@theinterioracademy.com");
  eq(it.data.names, ["Jane Roe"], "one-word speaker names are not names:");
  eq(it.data.transcript_raw, "[00:00:02] Valentino D: Hi Jane!\n[00:00:05] Jane: Hello: there", "empty line dropped:");
});

Deno.test("fathom: names of titles", () => {
  eq(titleNames("Ann Prospect x Design Career Roadmap Call on 27 Oct 2026 with Valentino D"), ["Ann Prospect"]);
  eq(titleNames(" Jacqueline: your Design Career Roadmap Call"), [], "one word:");
  eq(titleNames("Updated - Vanessa Danis Crook: your Design Career Roadmap Call (+ your personal link)"), ["Vanessa Danis Crook"]);
  eq(titleNames("Jaci & Anthony Sung | LNP Roadmap Call 2."), ["Jaci & Anthony Sung"]);
  eq(titleNames("Design Career Roadmap Call"), []);
  eq(titleNames("Training w/ Tristan"), []);
});

Deno.test("fathom: engine transcript format", () => {
  eq(engineTranscript([{ speaker: { display_name: "Dr: Who" }, text: "a\nb", timestamp: "1:02:03" }, { speaker: {}, text: "x", timestamp: "bad" }]),
    "[1:02:03] Dr Who: a b\n[00:00:00] Unknown: x");
});

Deno.test("fathom: no recording id is ignored", () => {
  eq(mapFathom('{"_test": true}', "2026-10-24T13:43:18Z"), { ignored: "fathom event without a recording id" });
});

Deno.test("fathom: history pages by cursor, every meeting the key sees", async () => {
  const urls: string[] = [];
  const fetchFn = ((url: string, init: RequestInit) => {
    urls.push(url);
    eq((init.headers as Record<string, string>)["X-Api-Key"], "k");
    const page = url.includes("cursor=c2")
      ? { items: [{ recording_id: 2 }, { recording_id: 3 }], next_cursor: null }
      : { items: [{ recording_id: 1 }, { recording_id: 2 }], next_cursor: "c2" };
    return Promise.resolve(new Response(JSON.stringify(page), { status: 200 }));
  }) as typeof fetch;
  const waits: number[] = [];
  const ms = await fathomMeetings("k", "2026-09-01T00:00:00Z", fetchFn, undefined, (n) => { waits.push(n); return Promise.resolve(); });
  eq(ms.map((m) => m.recording_id), [1, 2, 3], "duplicates dropped:");
  eq(urls.length, 2);
  eq(waits, [1100], "one gap between the two pages:");
  if (!urls[0].includes("created_after=2026-09-01T00%3A00%3A00Z") || !urls[0].includes("include_transcript=true")) throw new Error(urls[0]);
  const { items, ignored } = fathomHistoryItems([...ms, { title: "no id" }]);
  eq(items.length, 3); eq(ignored, 1);
});

Deno.test("fathom: the worker sends recordings to crm_apply_recordings", async () => {
  const calls: string[] = [];
  const rpc: Rpc = (fn, args) => {
    calls.push(fn);
    if (fn === "crm_inbox_pending") {
      eq((args.p_sources as string[]).includes("fathom"), true, "fathom polled:");
      return Promise.resolve([{ id: 9, source: "fathom", body: fixture, auth_ok: true, received_at: "2026-10-27T15:50:00Z" }]);
    }
    return Promise.resolve("processed");
  };
  eq(await processPending(rpc), { rows: 1, processed: 1 });
  eq(calls, ["crm_inbox_pending", "crm_apply_recordings"]);
});

Deno.test("fathom: a 429 waits (Retry-After, else 5 s doubling) and asks the same page again", async () => {
  let n = 0;
  const fetchFn = (() => {
    n++;
    if (n === 1) return Promise.resolve(new Response("slow down", { status: 429, headers: { "retry-after": "3" } }));
    if (n === 2) return Promise.resolve(new Response("slow down", { status: 429 }));
    return Promise.resolve(new Response(JSON.stringify({ items: [{ recording_id: 7 }], next_cursor: null }), { status: 200 }));
  }) as typeof fetch;
  const waits: number[] = [];
  const ms = await fathomMeetings("k", "2026-09-01T00:00:00Z", fetchFn, undefined, (w) => { waits.push(w); return Promise.resolve(); });
  eq(ms.map((m) => m.recording_id), [7]);
  eq(waits, [3000, 10000]);
  const always429 = (() => Promise.resolve(new Response("", { status: 429 }))) as typeof fetch;
  let err = "";
  try { await fathomMeetings("k", "2026-09-01T00:00:00Z", always429, undefined, () => Promise.resolve()); } catch (e) { err = String(e); }
  if (!err.includes("HTTP 429")) throw new Error("gives up after 6 retries: " + err);
});
