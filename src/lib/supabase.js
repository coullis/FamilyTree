import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// null when the keys are missing, so the site still loads without a backend
export const supabase = url && key ? createClient(url, key) : null;
