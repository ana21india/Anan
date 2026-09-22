import { buildPrompt, callGemini, fetchFromTMDB, getOTTAvailability, normalizeTMDB, processChunked } from '../functions/_lib.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { prefA, prefB, seenTitleIds = [] } = req.body
    if (!prefA || !prefB) return res.status(400).json({ error: 'Both preference sets required' })

    const prompt = buildPrompt(prefA, prefB, 1)
    const brief = await callGemini(process.env.GEMINI_API_KEY, prompt)
    const rawTitles = await fetchFromTMDB(brief, process.env.TMDB_API_KEY, seenTitleIds)

    const titles = await processChunked(rawTitles.slice(0, 30), async (t) => {
      const normalized = normalizeTMDB(t, brief.contentType)
      const ott = await getOTTAvailability(t.id, brief.contentType, process.env.RAPIDAPI_KEY, process.env.RAPID_API_HOST)
      return { ...normalized, ottPlatforms: ott }
    })

    return res.json({ titles: titles.slice(0, 30), brief: brief.summary })
  } catch (err) {
    console.error('generate-titles:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
