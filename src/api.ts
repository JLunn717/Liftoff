import type { Launch } from './types'

const LOCATIONS_URL = 'https://ll.thespacedevs.com/2.3.0/locations/?format=json&limit=100&country_code=USA'
const LAUNCHES_URL = 'https://ll.thespacedevs.com/2.3.0/launches/upcoming/?format=json&limit=100&mode=detailed'
const CACHE_KEY = 'liftoff.us-launches.v1'
const CACHE_TTL = 10 * 60 * 1000

type CacheRecord = { savedAt: number; launches: Launch[] }
type ApiList<T> = { results?: T[] } | T[]

export async function getUSLaunches(force = false): Promise<{ launches: Launch[]; cached: boolean }> {
  if (!force) {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) {
        const cache = JSON.parse(raw) as CacheRecord
        if (Date.now() - cache.savedAt < CACHE_TTL && Array.isArray(cache.launches)) return { launches: cache.launches, cached: true }
      }
    } catch { /* Ignore invalid browser cache. */ }
  }

  const locationsResponse = await fetch(LOCATIONS_URL, { headers: { Accept: 'application/json' } })
  if (!locationsResponse.ok) throw new Error(`Launch location service returned ${locationsResponse.status}.`)
  const locationPayload = await locationsResponse.json() as ApiList<{ id: number }>
  const locations = Array.isArray(locationPayload) ? locationPayload : locationPayload.results
  if (!Array.isArray(locations) || !locations.length) throw new Error('No United States launch locations were returned.')

  const ids = locations.map(location => location.id).filter(Number.isFinite)
  const launchesUrl = `${LAUNCHES_URL}&location__ids=${ids.join(',')}`
  const response = await fetch(launchesUrl, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Launch data service returned ${response.status}. Please try again shortly.`)
  const payload = await response.json() as ApiList<Launch>
  const results = Array.isArray(payload) ? payload : payload.results
  if (!Array.isArray(results)) throw new Error('The launch data service returned an unexpected response.')

  const launches = results.sort((a, b) =>
    new Date(a.net ?? a.window_start ?? '2999-01-01').getTime() - new Date(b.net ?? b.window_start ?? '2999-01-01').getTime()
  )
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), launches } satisfies CacheRecord)) } catch { /* Storage may be unavailable. */ }
  return { launches, cached: false }
}
