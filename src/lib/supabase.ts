import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Supabase env vars missing. Expected VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env"
  );
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const DB = {
  fileTypes: "boh_file_types",
  imports: "boh_imports",
  mappings: "boh_mappings",
  summary: "boh_department_summary",
  indicatorSources: "boh_indicator_sources",
} as const;
