// node app/crm/transcript_parse.test.js — formats read by "Add transcript" (fictional speakers only)
const assert = require("assert");
const T = require("./transcript_parse.js");
const eng = T.parse("[T001 00:06] SALES: Hello there\n[T002 00:09] PROSPECT: Yep.\n[T003 00:10] SALES: Great");
assert.deepStrictEqual(eng.turns.map(x => [x.ts, x.speaker]), [["00:06", "SALES"], ["00:09", "PROSPECT"], ["00:10", "SALES"]]);
assert.strictEqual(eng.format, "engine");
const blocks = T.parse("Sam Rep  0:06\nHello, can you hear me?\nStill me.\n\nAlex Lead  0:09\nYes I can.\n1:02:03 - Sam Rep\nGreat.");
assert.deepStrictEqual(blocks.turns.map(x => [x.ts, x.speaker, x.text]),
  [["00:06", "Sam Rep", "Hello, can you hear me? Still me."], ["00:09", "Alex Lead", "Yes I can."], ["1:02:03", "Sam Rep", "Great."]]);
const inline = T.parse("Sam Rep (00:06): Hi\nAlex Lead (00:08): Hello\n00:10 Sam Rep: How are you?\n00:12 - Alex Lead: Fine");
assert.deepStrictEqual(inline.turns.map(x => x.speaker), ["Sam Rep", "Alex Lead", "Sam Rep", "Alex Lead"]);
const vtt = T.parse("WEBVTT\n\n1\n00:00:06.000 --> 00:00:08.000\n<v Sam Rep>Hello</v>\n\n2\n00:00:09.500 --> 00:00:11.000\nAlex Lead: Hi there");
assert.deepStrictEqual(vtt.turns.map(x => [x.ts, x.speaker, x.text]), [["00:06", "Sam Rep", "Hello"], ["00:09", "Alex Lead", "Hi there"]]);
const js = T.parse(JSON.stringify({ transcript: [{ speaker: { display_name: "Sam Rep" }, text: "Hi", timestamp: "00:00:05" },
  { speaker: { display_name: "Sam Rep" }, text: "again", timestamp: "00:00:06" }, { speaker: { display_name: "Alex Lead" }, text: "Hello", timestamp: "00:00:08" }] }));
assert.deepStrictEqual(js.turns.map(x => [x.ts, x.speaker, x.text]), [["00:05", "Sam Rep", "Hi again"], ["00:08", "Alex Lead", "Hello"]]);
assert.ok(T.parse("just some words").warnings.length, "nothing recognised is said");
assert.ok(T.parse("[00:01] Sam Rep: hi\n[00:02] Sam Rep: hi").warnings[0].includes("Un seul intervenant"));
assert.strictEqual(T.parse("").warnings[0], "La transcription est vide.");
assert.ok(T.parse("just some words").warnings[0].startsWith("Aucune prise de parole"));
// French exports: accented names, "Intervenant 1", French text with colons inside the turn
const frBlocks = T.parse("Élodie Martin  0:06\nBonjour, vous m'entendez ?\n\nIntervenant 2  0:09\nOui : très bien.");
assert.deepStrictEqual(frBlocks.turns.map(x => [x.ts, x.speaker, x.text]),
  [["00:06", "Élodie Martin", "Bonjour, vous m'entendez ?"], ["00:09", "Intervenant 2", "Oui : très bien."]]);
const frInline = T.parse("Élodie Martin (00:06): Bonjour\n00:08 - Intervenant 2: Bonjour à vous\n[00:10] Élodie Martin: Ça va ?");
assert.deepStrictEqual(frInline.turns.map(x => x.speaker), ["Élodie Martin", "Intervenant 2", "Élodie Martin"]);
const frVtt = T.parse("WEBVTT\n\n00:00:06.000 --> 00:00:08.000\n<v Élodie Martin>Bonjour</v>\n\n00:00:09.000 --> 00:00:10.000\nIntervenant 2: Salut");
assert.deepStrictEqual(frVtt.turns.map(x => [x.speaker, x.text]), [["Élodie Martin", "Bonjour"], ["Intervenant 2", "Salut"]]);
assert.deepStrictEqual(T.guessMap(frBlocks.speakers, "Élodie"), { "Élodie Martin": "SALES", "Intervenant 2": "PROSPECT" });
const map = T.guessMap([{ name: "Valentino Dooneson-Pereira", words: 900 }, { name: "Alex Lead", words: 700 }, { name: "Partner", words: 20 }], "Valentino");
assert.deepStrictEqual(map, { "Valentino Dooneson-Pereira": "SALES", "Alex Lead": "PROSPECT", Partner: "OTHER" });
assert.strictEqual(T.toEngine(blocks.turns).split("\n")[0], "[00:06] Sam Rep: Hello, can you hear me? Still me.");
// the engine's own parser reads what toEngine writes (same line pattern as call-analysis/engine core/foundation.py LINE)
const LINE = /^\[?(?:T\d+\s+)?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*([^:]{1,80}):\s*(.*)$/;
T.toEngine(blocks.turns).split("\n").forEach(l => assert.ok(LINE.test(l), l));
console.log("transcript parse: all passed");
