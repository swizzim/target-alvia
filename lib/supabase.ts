import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

// Lazy initialize Supabase only when called in the browser/runtime
export function getSupabase(): SupabaseClient {
  if (browserClient) return browserClient
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  browserClient = createClient(supabaseUrl, supabaseAnonKey)
  return browserClient
}

// Database types
export interface Lobby {
  id: string
  code: string
  host_id: string
  status: 'waiting' | 'active' | 'finished'
  created_at: string
  updated_at: string
}

export interface Player {
  id: string
  lobby_id: string
  name: string
  is_host: boolean
  is_alive: boolean
  target_id?: string
  created_at: string
}

export interface GameState {
  id: string
  lobby_id: string
  current_phase: 'waiting' | 'active' | 'finished'
  winner_id?: string
  created_at: string
  updated_at: string
}
