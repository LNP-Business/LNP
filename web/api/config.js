// Public browser configuration: the project URL and the anon key (both are meant to be public;
// the data is protected by row-level security). Loaded by index.html before the app starts.
import { SUPABASE_URL, ANON_KEY } from "./_lib.js";

export default function handler(req, res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end("window.SKL_WEB_CONFIG = " + JSON.stringify({ url: SUPABASE_URL || "", anonKey: ANON_KEY || "" }) + ";\n");
}
