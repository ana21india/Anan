import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { GoogleGenerativeAI } from '@google/generative-ai'
import axios from 'axios'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
const TMDB_KEY = process.env.TMDB_API_KEY
const RAPID_KEY = process.env.RAPIDAPI_KEY
const TMDB_BASE = 'https://api.themoviedb.org/3'
const OTT_HOST = process.env.RAPID_API_HOST?.trim() || 'ott-details.p.rapidapi.com'

const LANG_MAP = { Hindi: 'hi', English: 'en', Tamil: 'ta', Telugu: 'te', Kannada: 'kn' }

const ERA_DATES = {
  'Classic (pre-2000)': { 'primary_release_date.lte': '1999-12-31', 'first_air_date.lte': '1999-12-31' },
  '2000–2020': { 'primary_release_date.gte': '2000-01-01', 'primary_release_date.lte': '2020-12-31', 'first_air_date.gte': '2000-01-01', 'first_air_date.lte': '2020-12-31' },
  'Recent (2021–2026)': { 'primary_release_date.gte': '2021-01-01', 'first_air_date.gte': '2021-01-01' },
}

async function generateSearchBrief(prefA, prefB, round = 1, likedA = [], likedB = []) {
  let prompt

  if (round === 1) {
    prompt = `You are a movie/TV recommendation engine. Given two people's preferences, generate optimal TMDB API search parameters.

Partner A:
- Mood tags: ${prefA.moodTags.join(', ') || 'none'}
- Mood description: "${prefA.moodText || 'not specified'}"
- Languages: ${prefA.languages.join(', ') || 'Any'}
- Content: ${prefA.contentType}
- Min IMDb rating: ${prefA.minRating}+
- Era: ${prefA.era.join(', ') || 'Any'}

Partner B:
- Mood tags: ${prefB.moodTags.join(', ') || 'none'}
- Mood description: "${prefB.moodText || 'not specified'}"
- Languages: ${prefB.languages.join(', ') || 'Any'}
- Content: ${prefB.contentType}
- Min IMDb rating: ${prefB.minRating}+
- Era: ${prefB.era.join(', ') || 'Any'}

TMDB Movie Genre IDs: Action:28, Adventure:12, Animation:16, Comedy:35, Crime:80, Documentary:99, Drama:18, Family:10751, Fantasy:14, Horror:27, Music:10402, Mystery:9648, Romance:10749, SciFi:878, Thriller:53
TMDB TV Genre IDs: Action&Adventure:10759, Animation:16, Comedy:35, Crime:80, Drama:18, Family:10751, Mystery:9648, SciFi&Fantasy:10765, Reality:10764
Language codes: Hindi=hi, English=en, Tamil=ta, Telugu=te, Kannada=kn

Mood tag mappings: "Light & fun" → Comedy(35), "Intense & gripping" → Drama(18)+Thriller(53), "Scary" → Horror(27), "Romantic" → Romance(10749)

Return ONLY valid JSON (no markdown), finding the intersection/compromise:
{
  "summary": "one-line description of the ideal watch tonight",
  "genres": [array of 2-4 TMDB genre IDs that satisfy both moods],
  "languages": [ISO codes — intersection, or all if one says Any],
  "minRating": number (higher of the two ratings),
  "contentType": "movie" or "tv" (movie if either wants movies only),
  "eras": ["era string from this list only: Classic (pre-2000), 2000–2020, Recent (2021–2026)"] or [] for any
}`
  } else {
    prompt = `Based on what both partners actually liked in round 1, generate better TMDB search parameters for round 2.

Partner A liked: ${likedA.map(t => t.title).join(', ') || 'nothing'}
Partner B liked: ${likedB.map(t => t.title).join(', ') || 'nothing'}

Find the common thread — genre, tone, era, themes — and generate search params that lean into it.
If they liked very different things, look for the middle ground.

Return ONLY valid JSON:
{
  "summary": "one-line description based on actual round 1 taste",
  "genres": [2-4 TMDB genre IDs],
  "languages": [ISO codes],
  "minRating": number between 6-8,
  "contentType": "movie" or "tv",
  "eras": []
}`
  }

  const result = await geminiModel.generateContent(prompt)
  const text = result.response.text().trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Gemini returned no JSON')
  return JSON.parse(jsonMatch[0])
}

async function fetchTMDBPage(params, page = 1) {
  const isTV = params.contentType === 'tv'
  const endpoint = isTV ? '/discover/tv' : '/discover/movie'
  const dateGte = isTV ? 'first_air_date.gte' : 'primary_release_date.gte'
  const dateLte = isTV ? 'first_air_date.lte' : 'primary_release_date.lte'

  const query = {
    api_key: TMDB_KEY,
    sort_by: 'vote_count.desc',
    'vote_average.gte': params.minRating,
    'vote_count.gte': 200,
    page,
  }

  if (params.genres?.length) query.with_genres = params.genres.slice(0, 3).join(',')

  return query
}

async function fetchFromTMDB(brief, seenIds = []) {
  const isTV = brief.contentType === 'tv'
  const endpoint = isTV ? '/discover/tv' : '/discover/movie'
  const results = []
  const seen = new Set(seenIds)

  const langs = brief.languages?.length ? brief.languages : ['en', 'hi']
  const eras = brief.eras?.length ? brief.eras : [null]

  for (const lang of langs.slice(0, 3)) {
    for (const era of eras.length ? eras : [null]) {
      try {
        const params = {
          api_key: TMDB_KEY,
          sort_by: 'vote_count.desc',
          'vote_average.gte': brief.minRating || 6,
          'vote_count.gte': 150,
          with_original_language: lang,
          page: 1,
        }

        if (brief.genres?.length) params.with_genres = brief.genres.slice(0, 3).join(',')

        if (era && ERA_DATES[era]) {
          const dates = ERA_DATES[era]
          if (isTV) {
            if (dates['first_air_date.gte']) params['first_air_date.gte'] = dates['first_air_date.gte']
            if (dates['first_air_date.lte']) params['first_air_date.lte'] = dates['first_air_date.lte']
          } else {
            if (dates['primary_release_date.gte']) params['primary_release_date.gte'] = dates['primary_release_date.gte']
            if (dates['primary_release_date.lte']) params['primary_release_date.lte'] = dates['primary_release_date.lte']
          }
        }

        const r = await axios.get(`${TMDB_BASE}${endpoint}`, { params })
        results.push(...(r.data.results || []).filter(t => !seen.has(t.id) && t.poster_path))
      } catch (e) {
        console.error('TMDB fetch error:', e.message)
      }
    }
  }

  const unique = [...new Map(results.map(t => [t.id, t])).values()]
  return unique.slice(0, 35)
}

async function getOTTAvailability(tmdbId, contentType) {
  if (!RAPID_KEY) return []
  try {
    const response = await axios.get(`https://${OTT_HOST}/imdbv3`, {
      headers: { 'X-RapidAPI-Key': RAPID_KEY, 'X-RapidAPI-Host': OTT_HOST },
      params: { tmdb_id: `${contentType === 'tv' ? 'tv' : 'movie'}/${tmdbId}` },
      timeout: 6000,
    })

    // ott-details response shape
    const services = response.data?.streamingAvailability?.country?.IN || []
    if (Array.isArray(services) && services.length) {
      return services
        .map(s => ({ platform: s.platform, link: s.url || null, type: 'subscription' }))
        .filter((v, i, arr) => arr.findIndex(x => x.platform === v.platform) === i)
    }

    // Fallback: streaming-availability shape
    const streamOpts = response.data?.streamingOptions?.in || []
    return streamOpts
      .filter(o => o.type === 'subscription' || o.type === 'free')
      .map(o => ({ platform: o.service?.name || 'Unknown', link: o.link || null, type: o.type }))
      .filter((v, i, arr) => arr.findIndex(x => x.platform === v.platform) === i)
  } catch {
    return []
  }
}

async function processChunked(items, fn, chunkSize = 4) {
  const results = []
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    const chunkResults = await Promise.all(chunk.map(fn))
    results.push(...chunkResults)
    if (i + chunkSize < items.length) await new Promise(r => setTimeout(r, 200))
  }
  return results
}

function normalizeTMDB(t, contentType) {
  const isTV = contentType === 'tv'
  const rawDate = isTV ? t.first_air_date : t.release_date
  return {
    tmdbId: t.id,
    title: isTV ? (t.name || t.original_name) : (t.title || t.original_title),
    year: rawDate ? new Date(rawDate).getFullYear() : null,
    rating: Math.round((t.vote_average || 0) * 10) / 10,
    synopsis: t.overview || '',
    posterUrl: t.poster_path ? `https://image.tmdb.org/t/p/w500${t.poster_path}` : null,
    backdropUrl: t.backdrop_path ? `https://image.tmdb.org/t/p/w780${t.backdrop_path}` : null,
    contentType,
  }
}

// POST /api/generate-titles
app.post('/api/generate-titles', async (req, res) => {
  try {
    const { prefA, prefB, seenTitleIds = [] } = req.body
    if (!prefA || !prefB) return res.status(400).json({ error: 'Both preference sets required' })

    const brief = await generateSearchBrief(prefA, prefB, 1)
    const rawTitles = await fetchFromTMDB(brief, seenTitleIds)

    const titles = await processChunked(rawTitles.slice(0, 30), async (t) => {
      const normalized = normalizeTMDB(t, brief.contentType)
      const ott = await getOTTAvailability(t.id, brief.contentType)
      return { ...normalized, ottPlatforms: ott }
    })

    res.json({ titles: titles.slice(0, 30), brief: brief.summary })
  } catch (error) {
    console.error('generate-titles error:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// POST /api/generate-round2
app.post('/api/generate-round2', async (req, res) => {
  try {
    const { prefA, prefB, likedA = [], likedB = [], seenTitleIds = [] } = req.body

    const brief = await generateSearchBrief(prefA, prefB, 2, likedA, likedB)
    const rawTitles = await fetchFromTMDB(brief, seenTitleIds)

    const titles = await processChunked(rawTitles.slice(0, 30), async (t) => {
      const normalized = normalizeTMDB(t, brief.contentType)
      const ott = await getOTTAvailability(t.id, brief.contentType)
      return { ...normalized, ottPlatforms: ott }
    })

    res.json({ titles: titles.slice(0, 30), brief: brief.summary })
  } catch (error) {
    console.error('generate-round2 error:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// GET /api/ott/:type/:id — standalone OTT check
app.get('/api/ott/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params
    const ott = await getOTTAvailability(parseInt(id), type)
    res.json({ platforms: ott })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`WatchMatch server running on port ${PORT}`))
