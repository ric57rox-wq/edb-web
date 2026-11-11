import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Non-fatal in the scaffold so the shell still renders; real values are
  // wired in the backend phase.
  console.warn(
    '[EDB] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — auth and sync will not work until set.',
  )
}

export const isSupabaseConfigured =
  !!url && !!anonKey && !url.includes('placeholder')

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  },
)
