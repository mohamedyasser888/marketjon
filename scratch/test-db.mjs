import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Load env
const raw = readFileSync(".env.local", "utf8");
const vars = {};
for (const line of raw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const value = trimmed.slice(eq + 1).trim();
  vars[key] = value;
}

const supabase = createClient(vars.NEXT_PUBLIC_SUPABASE_URL, vars.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  for (const table of ["profiles", "collections", "products", "cart", "tickets"]) {
    const { data, error } = await supabase.from(table).select("*").limit(1);
    console.log(`Table '${table}':`, error ? `Error: ${error.message}` : `Exists (count: ${data.length})`);
  }
}

test();
