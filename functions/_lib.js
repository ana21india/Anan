// Shared helpers for all Pages Functions — pure Web APIs, no Node.js

const ERA_DATES = {
  'Classic (pre-2000)': { movieLte: '1999-12-31', tvLte: '1999-12-31' },
  '2000–2020': { movieGte: '2000-01-01', movieLte: '2020-12-31', tvGte: '2000-01-01', tvLte: '2020-12-31' },
  'Recent (2021–2026)': { movieGte: '2021-01-01', tvGte: '2021-01-01' },
}

export function buildPrompt(prefA, prefB, round = 1, likedA = [], likedB = []) {
  if (round === 1) {
    return `You are a movie/TV recommendation engine. Given two people's preferences, generate optimal TMDB API search parameters.

Partner A:
- Mood tags: ${prefA.moodTags?.join(', ') || 'none'}
- Mood description: "${prefA.moodText || 'not specified'}"
- Languages: ${prefA.languages?.join(', ') || 'Any'}
- Content: ${prefA.contentType || 'movies'}
- Min IMDb rating: ${prefA.minRating || 6}+
- Era: ${prefA.era?.join(', ') || 'Any'}

Partner B:
- Mood tags: ${prefB.moodTags?.join(', ') || 'none'}
- Mood description: "${prefB.moodText || 'not specified'}"
- Languages: ${prefB.languages?.join(', ') || 'Any'}
- Content: ${prefB.contentType || 'movies'}
- Min IMDb rating: ${prefB.minRating || 6}+
- Era: ${prefB.era?.join(', ') || 'Any'}

TMDB Movie Genre IDs: Action:28, Adventure:12, Animation:16, Comedy:35, Crime:80, Documentary:99, Drama:18, Family:10751, Fantasy:14, Horror:27, Music:10402, Mystery:9648, Romance:10749, SciFi:878, Thriller:53
TMDB TV Genre IDs: Action&Adventure:10759, Animation:16, Comedy:35, Crime:80, Drama:18, Family:10751, Mystery:9648, SciFi&Fantasy:10765
Language codes: Hindi=hi, English=en, Tamil=ta, Telugu=te, Kannada=kn
Mood mappings: "Light & fun"->Comedy(35), "Intense & gripping"->Drama(18)+Thriller(53), "Scary"->Horror(27), "Romantic"->Romance(10749)

Return ONLY valid JSON (no markdown fences):
{
  "summary": "one-line description of the ideal watch tonight",
  "genres": [2-4 TMDB genre IDs satisfying both moods],
  "languages": [ISO codes — intersection, or all if one says Any],
  "minRating": number (higher of the two),
  "contentType": "movie" or "tv",
  "eras": ["era string — only from: Classic (pre-2000), 2000–2020, Recent (2021–2026)"] or []
}`
  }

  return `Based on what both partners actually liked in round 1, generate better TMDB search params for round 2.

Partner A liked: ${likedA.map(t => t.title).join(', ') || 'nothing'}
Partner B liked: ${likedB.map(t => t.title).join(', ') || 'nothing'}

Find the common thread and lean into it. If very different, find the middle ground.

Return ONLY valid JSON (no markdown):
{
  "summary": "one-line description based on actual round 1 taste",
  "genres": [2-4 TMDB genre IDs],
  "languages": ["en", "hi"],
  "minRating": 6.5,
  "contentType": "movie",
  "eras": []
}`
}

export async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      // Budget covers thinking tokens as well as the answer, so it needs
      // far more headroom than the ~200-token JSON brief alone suggests.
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Gemini returned no JSON block')
  return JSON.parse(match[0])
}

export async function fetchFromTMDB(brief, tmdbKey, seenIds = []) {
  const isTV = brief.contentType === 'tv'
  const endpoint = isTV ? 'discover/tv' : 'discover/movie'
  const seen = new Set(seenIds.map(String))
  const results = []

  const langs = brief.languages?.length ? brief.languages.slice(0, 3) : ['en', 'hi']
  const eras = brief.eras?.length ? brief.eras : [null]

  for (const lang of langs) {
    for (const era of eras) {
      const p = new URLSearchParams({
        api_key: tmdbKey,
        sort_by: 'vote_count.desc',
        'vote_average.gte': String(brief.minRating || 6),
        'vote_count.gte': '150',
        with_original_language: lang,
        page: '1',
      })
      // '|' is OR in TMDB; ',' is AND. The two partners' moods map to
      // different genres, so AND would demand one title be all of them.
      if (brief.genres?.length) p.set('with_genres', brief.genres.slice(0, 3).join('|'))
      if (era) {
        const d = ERA_DATES[era] || {}
        if (isTV) {
          if (d.tvGte) p.set('first_air_date.gte', d.tvGte)
          if (d.tvLte) p.set('first_air_date.lte', d.tvLte)
        } else {
          if (d.movieGte) p.set('primary_release_date.gte', d.movieGte)
          if (d.movieLte) p.set('primary_release_date.lte', d.movieLte)
        }
      }
      try {
        const r = await fetch(`https://api.themoviedb.org/3/${endpoint}?${p}`)
        const data = await r.json()
        results.push(...(data.results || []).filter(t => !seen.has(String(t.id)) && t.poster_path))
      } catch {}
    }
  }

  return [...new Map(results.map(t => [t.id, t])).values()].slice(0, 35)
}

export async function getOTTAvailability(tmdbId, contentType, rapidKey, ottHost) {
  if (!rapidKey) return []
  const host = (ottHost || 'ott-details.p.rapidapi.com').trim()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const p = new URLSearchParams({ tmdb_id: `${contentType === 'tv' ? 'tv' : 'movie'}/${tmdbId}` })
    const res = await fetch(`https://${host}/imdbv3?${p}`, {
      headers: { 'X-RapidAPI-Key': rapidKey, 'X-RapidAPI-Host': host },
      signal: controller.signal,
    })
    const data = await res.json()

    // ott-details shape
    const services = data?.streamingAvailability?.country?.IN || []
    if (Array.isArray(services) && services.length) {
      return services
        .map(s => ({ platform: s.platform, link: s.url || null, type: 'subscription' }))
        .filter((v, i, arr) => arr.findIndex(x => x.platform === v.platform) === i)
    }

    // streaming-availability fallback shape
    const opts = data?.streamingOptions?.in || []
    return opts
      .filter(o => o.type === 'subscription' || o.type === 'free')
      .map(o => ({ platform: o.service?.name || 'Unknown', link: o.link || null, type: o.type }))
      .filter((v, i, arr) => arr.findIndex(x => x.platform === v.platform) === i)
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

export function normalizeTMDB(t, contentType) {
  const isTV = contentType === 'tv'
  const rawDate = isTV ? t.first_air_date : t.release_date
  return {
    tmdbId: t.id,
    title: isTV ? (t.name || t.original_name) : (t.title || t.original_title),
    year: rawDate ? new Date(rawDate).getFullYear() : null,
    rating: Math.round((t.vote_average || 0) * 10) / 10,
    synopsis: t.overview || '',
    posterUrl: t.poster_path ? `https://image.tmdb.org/t/p/w500${t.poster_path}` : null,
    contentType,
  }
}

export async function processChunked(items, fn, size = 4) {
  const out = []
  for (let i = 0; i < items.length; i += size) {
    const chunk = await Promise.all(items.slice(i, i + size).map(fn))
    out.push(...chunk)
    if (i + size < items.length) await new Promise(r => setTimeout(r, 200))
  }
  return out
}

export function cors(response) {
  const h = new Headers(response.headers)
  h.set('Access-Control-Allow-Origin', '*')
  h.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  h.set('Access-Control-Allow-Headers', 'Content-Type')
  return new Response(response.body, { status: response.status, headers: h })
}
