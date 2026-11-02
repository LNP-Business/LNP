// node --import ./tests/register.mjs --test tests/ : the API sees tests/fake_supabase.js as @supabase/supabase-js.
import { register } from "node:module";
register("./loader.mjs", import.meta.url);
