import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let clientInstance: SupabaseClient | null = null;
let configWarningLogged = false;

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
      supabaseAnonKey &&
      supabaseUrl !== 'https://your-project.supabase.co' &&
      supabaseAnonKey !== 'your-anon-key'
  );
};

export const getSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) {
    if (!configWarningLogged && import.meta.env.DEV) {
      console.info(
        '[ShareWise] Supabase credentials (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are not set. Running in Mock Data mode for hackathon presentation.'
      );
      configWarningLogged = true;
    }
    return null;
  }

  if (!clientInstance) {
    clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return clientInstance;
};
