import type { Launch } from './types'

const LOCATIONS_URL = 'https://ll.thespacedevs.com/2.3.0/locations/?format=json&limit=100&country_code=USA'
const LAUNCHES_URL = 'https://ll.thespacedevs.com/2.3.0/launches/upcoming/?format=json&limit=100&mode=detailed'
const CACHE_KEY = 'liftoff.us-launches.v2'
const CACHE_TTL = 10 * 60 * 1000

type CacheRecord = { savedAt: number; launches: Launch[]; stateCodes: string[] }
type ApiList<T> = { results?: T[] } | T[]

export async function getUSLaunches(force = false): Promise<{ launches: Launch[]; stateCodes: string[]; cached: boolean }> {
  if (!force) {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) {
        const cache = JSON.parse(raw) as CacheRecord
        if (Date.now() - cache.savedAt < CACHE_TTL && Array.isArray(cache.launches)) return { launches: cache.launches, stateCodes: Array.isArray(cache.stateCodes) ? cache.stateCodes : [], cached: true }
      }
    } catch { /* Ignore invalid browser cache. */ }
  }

  const locationsResponse = await fetch(LOCATIONS_URL, { headers: { Accept: 'application/json' } })
  if (!locationsResponse.ok) throw new Error(`Launch location service returned ${locationsResponse.status}.`)
  const locationPayload = await locationsResponse.json() as (ApiList<{ id: number; name?: string }> & { next?: string | null })
  let locations = Array.isArray(locationPayload) ? locationPayload : (locationPayload.results ?? [])
  let nextPage = Array.isArray(locationPayload) ? null : locationPayload.next ?? null
  while (nextPage) {
    const pageResponse = await fetch(nextPage, { headers: { Accept: 'application/json' } })
    if (!pageResponse.ok) throw new Error(`Launch location service returned ${pageResponse.status}.`)
    const page = await pageResponse.json() as { results?: Array<{ id: number; name?: string }>; next?: string | null }
    locations = locations.concat(page.results ?? [])
    nextPage = page.next ?? null
  }
  if (!locations.length) throw new Error('No United States launch locations were returned.')

  const stateCodes = [...new Set(locations.map(location => {
    const match = (location.name ?? '').match(/,\s*([A-Z]{2}),\s*USA\s*$/i)
    return match?.[1]?.toUpperCase() ?? ''
  }).filter(code => /^[A-Z]{2}$/.test(code)))].sort()
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
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), launches, stateCodes } satisfies CacheRecord)) } catch { /* Storage may be unavailable. */ }
  return { launches, stateCodes, cached: false }
}
