import { createClient } from "@supabase/supabase-js";

// These two values come from your Supabase project settings (Project Settings > API).
// They live in a .env file locally, and as Environment Variables in Vercel for deployment.
// Never put your actual keys directly in this file — always through env vars.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
