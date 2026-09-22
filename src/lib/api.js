const BASE = '/api'

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Server error' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function generateTitles(prefA, prefB, seenTitleIds = []) {
  return post('/generate-titles', { prefA, prefB, seenTitleIds })
}

export async function generateRound2Titles(prefA, prefB, likedA, likedB, seenTitleIds = []) {
  return post('/generate-round2', { prefA, prefB, likedA, likedB, seenTitleIds })
}
