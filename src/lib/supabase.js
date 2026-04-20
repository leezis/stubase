import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
export const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

export const missingSupabaseEnvKeys = [
  !supabaseUrl ? 'VITE_SUPABASE_URL' : null,
  !supabaseAnonKey ? 'VITE_SUPABASE_ANON_KEY' : null,
].filter(Boolean)

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey)

function getSupabaseEnvTargetLabel() {
  if (typeof window === 'undefined') {
    return '환경 설정'
  }

  const hostname = window.location.hostname

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return '.env.local'
  }

  return '배포 환경'
}

export function getSupabaseEnvHelpMessage() {
  if (hasSupabaseEnv) {
    return ''
  }

  const envKeys = missingSupabaseEnvKeys.join(', ')
  return `${getSupabaseEnvTargetLabel()}에서 ${envKeys} 값을 확인해 주세요.`
}

export const supabase = hasSupabaseEnv
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
      },
    })
  : null
