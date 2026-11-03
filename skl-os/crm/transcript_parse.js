/* LNP CRM — reads a pasted or dropped call transcript into speaker turns (call analysis, "Add transcript").
   Formats: the engine's own ("[T001 00:06] SALES: text", "[00:06] Name: text"), "00:06 Name: text", "Name (00:06): text",
   blocks with a header line ("Name  0:06", "0:06 - Name", "Name: 0:06") followed by the text, WebVTT / SRT, and the JSON
   of a Fathom meeting (transcript[] with speaker.display_name, text, timestamp). Consecutive lines of one speaker are joined.
   toEngine() writes the engine format "[mm:ss] Speaker: text" that crm_ca_add_transcript stores. Pure functions. */
(function (root) {
  var TS = "(\\d{1,2}:\\d{2}(?::\\d{2})?)(?:[.,]\\d+)?";
  var R_ENGINE = new RegExp("^\\[(?:T\\d+[a-z]?\\s+)?" + TS + "\\]\\s*([^:\\[\\]]{1,80}?)\\s*:\\s*(.*)$");
  var R_TS_NAME = new RegExp("^" + TS + "\\s*[-–—|]?\\s*([^:]{1,80}?)\\s*:\\s*(.+)$");
  var R_NAME_TS = new RegExp("^([^:()\\[\\]]{1,80}?)\\s*[(\\[]" + TS + "[)\\]]\\s*:?\\s*(.*)$");
  var H_TS_NAME = new RegExp("^" + TS + "\\s*[-–—|:]?\\s*([^\\d:][^:]{0,79})$");
  var H_NAME_TS = new RegExp("^([^:\\d][^:]{0,79}?)\\s*(?:[-–—|:]|\\s{2,}|\\t)\\s*" + TS + "$");
  var VTT_CUE = new RegExp("^" + TS + "\\s*-->\\s*" + TS);

  function clean(s) { return String(s || "").replace(/\s+/g, " ").trim(); }
  function speakerName(s) { return clean(String(s || "").replace(/:/g, " ").replace(/\s*\(.*?\)\s*$/, "")) || "Inconnu"; }
  function normTs(t) {
    var p = String(t || "").split(".")[0].split(",")[0].split(":").map(function (x) { return parseInt(x, 10) || 0; });
    if (p.length === 2) p.unshift(0);
    var h = p[0], m = p[1], s = p[2];
    var two = function (n) { return (n < 10 ? "0" : "") + n; };
    return h ? h + ":" + two(m) + ":" + two(s) : two(m) + ":" + two(s);
  }
  function push(out, ts, speaker, text) {
    text = clean(text);
    if (!text) return;
    var last = out[out.length - 1];
    if (last && last.speaker === speaker) { last.text += " " + text; return; }
    out.push({ ts: ts, speaker: speaker, text: text });
  }

  function fromJson(raw) {
    var j;
    try { j = JSON.parse(raw); } catch (e) { return null; }
    var segs = Array.isArray(j) ? j : (j && (j.transcript || (j.meeting && j.meeting.transcript))) || null;
    if (!Array.isArray(segs)) return null;
    var out = [];
    segs.forEach(function (s) {
      var name = speakerName((s.speaker && (s.speaker.display_name || s.speaker.name)) || s.speaker_name || s.speaker);
      push(out, normTs(s.timestamp || s.start || s.ts || "0:00"), name, s.text);
    });
    return { turns: out, format: "json" };
  }

  function fromVtt(lines) {
    var out = [], ts = null, any = false;
    lines.forEach(function (l) {
      var m = l.match(VTT_CUE);
      if (m) { ts = normTs(m[1]); any = true; return; }
      if (!ts || !l || /^WEBVTT/.test(l) || /^\d+$/.test(l)) return;
      var v = l.match(/^<v\s+([^>]+)>(.*?)(<\/v>)?$/);
      if (v) return push(out, ts, speakerName(v[1]), v[2]);
      var n = l.match(/^([^:]{1,80}):\s*(.+)$/);
      if (n) return push(out, ts, speakerName(n[1]), n[2]);
      if (out.length) out[out.length - 1].text += " " + clean(l);
    });
    return any ? { turns: out, format: "vtt" } : null;
  }

  function parse(raw) {
    raw = String(raw || "").replace(/\r\n?/g, "\n").replace(/ /g, " ");
    var t = raw.trim();
    if (!t) return { turns: [], speakers: [], format: "empty", warnings: ["La transcription est vide."] };
    var res = (t[0] === "[" || t[0] === "{") && /"text"\s*:/.test(t) ? fromJson(t) : null;
    var lines = raw.split("\n").map(function (l) { return l.trim(); });
    if (!res && lines.some(function (l) { return VTT_CUE.test(l); })) res = fromVtt(lines);
    if (!res) {
      var out = [], cur = null, fmt = "lines";
      lines.forEach(function (l) {
        if (!l) return;
        var m;
        if ((m = l.match(R_ENGINE))) { cur = null; fmt = "engine"; return push(out, normTs(m[1]), speakerName(m[2]), m[3]); }
        if ((m = l.match(R_NAME_TS)) && m[3]) { cur = null; return push(out, normTs(m[2]), speakerName(m[1]), m[3]); }
        if ((m = l.match(R_TS_NAME))) { cur = null; return push(out, normTs(m[1]), speakerName(m[2]), m[3]); }
        if ((m = l.match(H_NAME_TS))) { cur = { ts: normTs(m[2]), speaker: speakerName(m[1]) }; fmt = "blocks"; return; }
        if ((m = l.match(H_TS_NAME))) { cur = { ts: normTs(m[1]), speaker: speakerName(m[2]) }; fmt = "blocks"; return; }
        if ((m = l.match(R_NAME_TS))) { cur = { ts: normTs(m[2]), speaker: speakerName(m[1]) }; fmt = "blocks"; return; }
        if (cur) return push(out, cur.ts, cur.speaker, l);
        if (out.length) out[out.length - 1].text += " " + clean(l);
      });
      res = { turns: out, format: fmt };
    }
    var stats = {};
    res.turns.forEach(function (x) {
      var s = stats[x.speaker] || (stats[x.speaker] = { name: x.speaker, turns: 0, words: 0 });
      s.turns++; s.words += x.text.split(/\s+/).length;
    });
    res.speakers = Object.keys(stats).map(function (k) { return stats[k]; }).sort(function (a, b) { return b.words - a.words; });
    res.warnings = [];
    if (!res.turns.length) res.warnings.push("Aucune prise de parole trouvée : chaque prise de parole a besoin d'une heure et du nom de la personne qui parle.");
    else if (res.speakers.length < 2) res.warnings.push("Un seul intervenant trouvé : le commercial et le prospect doivent être nommés tous les deux.");
    if (res.turns.length && res.turns.every(function (x) { return x.ts === "00:00"; })) res.warnings.push("Aucune heure trouvée : les chronologies de l'appel seront vides.");
    return res;
  }

  // a first guess of who is who: the sales rep's name → SALES; then the speaker with the most words among the others → PROSPECT
  function guessMap(speakers, salesName) {
    var map = {}, first = String(salesName || "").toLowerCase().split(/\s+/)[0];
    speakers.forEach(function (s) { if (first && s.name.toLowerCase().indexOf(first) >= 0) map[s.name] = "SALES"; });
    var rest = speakers.filter(function (s) { return !map[s.name]; });
    if (rest.length) map[rest[0].name] = "PROSPECT";
    rest.slice(1).forEach(function (s) { map[s.name] = Object.keys(map).some(function (k) { return map[k] === "SALES"; }) ? "OTHER" : "SALES"; });
    return map;
  }

  function toEngine(turns) {
    return turns.map(function (x) { return "[" + x.ts + "] " + x.speaker + ": " + x.text; }).join("\n");
  }

  var api = { parse: parse, guessMap: guessMap, toEngine: toEngine, normTs: normTs };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SKL_TRANSCRIPT = api;
})(typeof window !== "undefined" ? window : this);
