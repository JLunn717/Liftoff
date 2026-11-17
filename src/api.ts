import type { Launch } from './types'

const API_URL = 'https://ll.thespacedevs.com/2.3.0/launches/upcoming/?format=json&limit=100&mode=detailed&location__ids=12,27'
const CACHE_KEY = 'liftoff.launches.v1'
const CACHE_TTL = 10 * 60 * 1000

type CacheRecord = { savedAt: number; launches: Launch[] }

export async function getFloridaLaunches(force = false): Promise<{ launches: Launch[]; cached: boolean }> {
  if (!force) {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) {
        const cache = JSON.parse(raw) as CacheRecord
        if (Date.now() - cache.savedAt < CACHE_TTL && Array.isArray(cache.launches)) return { launches: cache.launches, cached: true }
      }
    } catch { /* Ignore invalid browser cache. */ }
  }
  const response = await fetch(API_URL, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Launch data service returned ${response.status}. Please try again shortly.`)
  const payload = await response.json()
  const results = Array.isArray(payload) ? payload : payload.results
  if (!Array.isArray(results)) throw new Error('The launch data service returned an unexpected response.')
  const launches = (results as Launch[]).filter((launch) => {
    const location = launch.pad?.location?.name?.toLowerCase() ?? ''
    return location.includes('fl') || location.includes('florida') || location.includes('cape canaveral') || location.includes('kennedy')
  }).sort((a, b) => new Date(a.net ?? a.window_start ?? '2999-01-01').getTime() - new Date(b.net ?? b.window_start ?? '2999-01-01').getTime())
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), launches } satisfies CacheRecord)) } catch { /* Storage may be unavailable. */ }
  return { launches, cached: false }
}