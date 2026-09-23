import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase env vars. Copy .env.example to .env and fill in your values.')
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  realtime: { params: { eventsPerSecond: 10 } },
})

export function generateSessionCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export async function createSession() {
  const code = generateSessionCode()
  const { data, error } = await supabase
    .from('sessions')
    .insert({ code, status: 'waiting' })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getSession(code) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('code', code.toUpperCase())
    .single()

  if (error) throw error
  return data
}

export async function submitPreferences(sessionId, partner, prefs) {
  const { error } = await supabase
    .from('preferences')
    .upsert({ session_id: sessionId, partner, ...prefs }, { onConflict: 'session_id,partner' })

  if (error) throw error
}

export async function getPreferences(sessionId) {
  const { data, error } = await supabase
    .from('preferences')
    .select('*')
    .eq('session_id', sessionId)

  if (error) throw error
  return data || []
}

export async function storeTitles(sessionId, round, titles) {
  const rows = titles.map((t, i) => ({
    session_id: sessionId,
    round,
    tmdb_id: t.tmdbId,
    title: t.title,
    year: t.year,
    rating: t.rating,
    synopsis: t.synopsis,
    poster_url: t.posterUrl,
    ott_platforms: t.ottPlatforms || [],
    position: i,
  }))

  const { data, error } = await supabase
    .from('session_titles')
    .insert(rows)
    .select()

  if (error) throw error
  return data
}

export async function getTitles(sessionId, round) {
  const { data, error } = await supabase
    .from('session_titles')
    .select('*')
    .eq('session_id', sessionId)
    .eq('round', round)
    .order('position')

  if (error) throw error
  return data || []
}

export async function recordSwipe(sessionId, partner, titleId, liked) {
  const { error } = await supabase
    .from('swipes')
    .upsert({ session_id: sessionId, partner, title_id: titleId, liked }, { onConflict: 'session_id,partner,title_id' })

  if (error) throw error
}

export async function checkForMatch(sessionId, titleId) {
  // Compare on tmdb_id rather than the row id: a session can hold more than
  // one row for the same film, and liking it from two different rows is
  // still both partners agreeing on the same film.
  const { data: row, error: rowErr } = await supabase
    .from('session_titles')
    .select('tmdb_id')
    .eq('id', titleId)
    .single()

  if (rowErr) throw rowErr

  const { data, error } = await supabase
    .from('swipes')
    .select('partner, session_titles!inner(tmdb_id)')
    .eq('session_id', sessionId)
    .eq('liked', true)
    .eq('session_titles.tmdb_id', row.tmdb_id)

  if (error) throw error
  return new Set((data || []).map(s => s.partner)).size === 2
}

export async function getSwipes(sessionId, partner) {
  const { data, error } = await supabase
    .from('swipes')
    .select('*, session_titles(*)')
    .eq('session_id', sessionId)
    .eq('partner', partner)

  if (error) throw error
  return data || []
}

export async function updateSessionStatus(sessionId, status, extra = {}) {
  const { error } = await supabase
    .from('sessions')
    .update({ status, ...extra })
    .eq('id', sessionId)

  if (error) throw error
}

export async function setMatch(sessionId, titleId) {
  const { error } = await supabase
    .from('sessions')
    .update({ status: 'matched', match_title_id: titleId })
    .eq('id', sessionId)

  if (error) throw error
}

export async function getMatchTitle(sessionId) {
  const { data: session } = await supabase
    .from('sessions')
    .select('match_title_id')
    .eq('id', sessionId)
    .single()

  if (!session?.match_title_id) return null

  const { data, error } = await supabase
    .from('session_titles')
    .select('*')
    .eq('id', session.match_title_id)
    .single()

  if (error) return null
  return data
}
