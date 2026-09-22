import { buildPrompt, callGemini, fetchFromTMDB, getOTTAvailability, normalizeTMDB, processChunked, cors } from '../_lib.js'

export async function onRequestOptions() {
  return cors(new Response(null, { status: 204 }))
}

export async function onRequestPost({ request, env }) {
  try {
    const { prefA, prefB, seenTitleIds = [] } = await request.json()
    if (!prefA || !prefB) return cors(Response.json({ error: 'Both preference sets required' }, { status: 400 }))

    const prompt = buildPrompt(prefA, prefB, 1)
    const brief = await callGemini(env.GEMINI_API_KEY, prompt)

    const rawTitles = await fetchFromTMDB(brief, env.TMDB_API_KEY, seenTitleIds)

    const titles = await processChunked(rawTitles.slice(0, 30), async (t) => {
      const normalized = normalizeTMDB(t, brief.contentType)
      const ott = await getOTTAvailability(t.id, brief.contentType, env.RAPIDAPI_KEY, env.RAPID_API_HOST)
      return { ...normalized, ottPlatforms: ott }
    })

    return cors(Response.json({ titles: titles.slice(0, 30), brief: brief.summary }))
  } catch (err) {
    console.error('generate-titles error:', err)
    return cors(Response.json({ error: err.message }, { status: 500 }))
  }
}
