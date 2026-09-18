import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const env = fs.readFileSync(".env.local", "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const t = "a";
const r = await supabase.from("candidates").select("*, jobs(title), evaluations(id, candidate_id, reviewer_name, recommendation, aggregate_score, notes, created_at)").or(`first_name.ilike.%${t}%`).limit(1);
const row = r.data?.[0];
for (const [k,v] of Object.entries(row ?? {})) {
  console.log(k, "=>", typeof v, Array.isArray(v) ? "ARRAY["+v.length+"]" : JSON.stringify(v)?.slice(0,80));
}
