import type { Launch } from './types'

const LAUNCHES_URL = 'https://lldev.thespacedevs.com/2.3.0/launches/upcoming/?format=json&limit=100&mode=detailed'
const CACHE_KEY = 'liftoff.us-launches.v5'
const TRACKED_STATES = ['FL', 'CA', 'VA', 'TX']
const CACHE_TTL = 30 * 60 * 1000
const MIN_REFRESH_INTERVAL = 4 * 60 * 1000

type CacheRecord = { savedAt: number; launches: Launch[]; stateCodes: string[] }
type ApiList<T> = { results?: T[] } | T[]

export async function getUSLaunches(force = false): Promise<{ launches: Launch[]; stateCodes: string[]; cached: boolean }> {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const cache = JSON.parse(raw) as CacheRecord
      const age = Date.now() - cache.savedAt
      if (Array.isArray(cache.launches) && (age < MIN_REFRESH_INTERVAL || (!force && age < CACHE_TTL))) {
        return { launches: cache.launches, stateCodes: Array.isArray(cache.stateCodes) ? cache.stateCodes : TRACKED_STATES, cached: true }
      }
    }
  } catch { /* Ignore invalid browser cache. */ }

  // Use the unthrottled development API directly. Its detailed launch records
  // already include the launch location, so a separate locations lookup is unnecessary.
  const response = await fetch(LAUNCHES_URL, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Launch data service returned ${response.status}. Please try again shortly.`)
  const payload = await response.json() as ApiList<Launch>
  const results = Array.isArray(payload) ? payload : payload.results
  if (!Array.isArray(results)) throw new Error('The launch data service returned an unexpected response.')

  const stateCodeForLocation = (name = '') => name.match(/,\\s*([A-Z]{2}),\\s*USA\\s*$/i)?.[1]?.toUpperCase() ?? ''
  const launches = results
    .filter(launch => TRACKED_STATES.includes(stateCodeForLocation(launch.pad?.location?.name ?? '')))
    .sort((a, b) =>
      new Date(a.net ?? a.window_start ?? '2999-01-01').getTime() - new Date(b.net ?? b.window_start ?? '2999-01-01').getTime()
    )

  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), launches, stateCodes: TRACKED_STATES } satisfies CacheRecord)) } catch { /* Storage may be unavailable. */ }
  return { launches, stateCodes: TRACKED_STATES, cached: false }
}
