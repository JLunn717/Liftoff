import { TRACKED_STATES, stateCodeFromLocation } from './coverage'
import type { Launch, LaunchPayload } from './launch'

const LAUNCHES_URL =
  'https://lldev.thespacedevs.com/2.3.0/launches/upcoming/?format=json&limit=100&mode=detailed'

type ProviderAgency = { name?: string }
type ProviderPayload = {
  name?: string
  description?: string | null
  manufacturer?: { name?: string } | string | null
  orbit?: { name?: string } | null
  agencies?: ProviderAgency[] | null
  customer?: string | null
}
type ProviderMission = {
  name?: string
  description?: string
  type?: string | null
  orbit?: { name?: string } | null
  agencies?: ProviderAgency[] | null
  payloads?: ProviderPayload[] | null
}
type ProviderLaunch = {
  id: string
  name?: string
  net?: string | null
  window_start?: string | null
  status?: { name?: string; abbrev?: string; description?: string } | null
  launch_service_provider?: { name?: string } | null
  rocket?: {
    configuration?: {
      name?: string
      full_name?: string
      family?: string
      variant?: string
      manufacturer?: { name?: string } | null
    }
  } | null
  mission?: ProviderMission | null
  pad?: { name?: string; location?: { name?: string } | null } | null
  webcast_live?: boolean
  vid_urls?: Array<{ url?: string; title?: string }>
  infoURLs?: Array<{ url?: string; title?: string }>
  updated_at?: string | null
}

type ProviderResponse = { results?: ProviderLaunch[] } | ProviderLaunch[]

function normalizePayload(payload: ProviderPayload): LaunchPayload {
  const manufacturer = typeof payload.manufacturer === 'string'
    ? payload.manufacturer
    : payload.manufacturer?.name ?? null
  const customers = [
    ...(payload.agencies ?? []).map((agency) => agency.name).filter((name): name is string => Boolean(name)),
    ...(payload.customer ? [payload.customer] : []),
  ]
  return {
    name: payload.name ?? 'Unidentified payload',
    description: payload.description ?? null,
    customer: [...new Set(customers)],
    manufacturer,
    orbit: payload.orbit?.name ?? null,
  }
}

function normalizeLaunch(item: ProviderLaunch): Launch {
  const locationName = item.pad?.location?.name ?? ''
  const videos = (item.vid_urls ?? []).filter((entry) => Boolean(entry.url))
  const info = (item.infoURLs ?? []).filter((entry) => Boolean(entry.url))
  const configuration = item.rocket?.configuration
  return {
    id: item.id,
    name: item.name ?? 'Unnamed mission',
    net: item.net ?? null,
    windowStart: item.window_start ?? null,
    status: item.status
      ? {
          name: item.status.name ?? 'Status unknown',
          abbreviation: item.status.abbrev,
          description: item.status.description,
        }
      : null,
    providerName: item.launch_service_provider?.name ?? null,
    vehicleName: configuration?.full_name ?? configuration?.name ?? null,
    vehicleManufacturer: configuration?.manufacturer?.name ?? null,
    vehicleFamily: configuration?.family ?? null,
    vehicleVariant: configuration?.variant ?? null,
    missionName: item.mission?.name ?? null,
    missionDescription: item.mission?.description ?? null,
    missionType: item.mission?.type ?? null,
    missionAgencies: (item.mission?.agencies ?? [])
      .map((agency) => agency.name)
      .filter((name): name is string => Boolean(name)),
    payloads: (item.mission?.payloads ?? []).map(normalizePayload),
    orbitName: item.mission?.orbit?.name ?? null,
    launchSiteName: item.pad?.name ?? null,
    launchLocationName: locationName || null,
    stateCode: stateCodeFromLocation(locationName),
    webcastUrl: videos[0]?.url ?? null,
    infoUrls: [
      ...videos.map((entry) => ({ title: entry.title ?? 'Webcast', url: entry.url! })),
      ...info.map((entry) => ({ title: entry.title ?? 'Mission information', url: entry.url! })),
    ],
    sourceUpdatedAt: item.updated_at ?? null,
  }
}

/** Fetch and normalize upcoming launches for Liftoff's supported states. */
export async function getUpcomingLaunches(force = false): Promise<Launch[]> {
  if (!force && memoryCache && Date.now() - memoryCache.savedAt < CACHE_TTL) {
    return memoryCache.launches
  }

  const response = await fetch(LAUNCHES_URL, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`Launch data service returned ${response.status}. Please try again shortly.`)
  }

  const payload = (await response.json()) as ProviderResponse
  const records = Array.isArray(payload) ? payload : payload.results
  if (!Array.isArray(records)) {
    throw new Error('The launch data service returned an unexpected response.')
  }

  const launches = records
    .map(normalizeLaunch)
    .filter((launch) => launch.stateCode && TRACKED_STATES.includes(launch.stateCode as (typeof TRACKED_STATES)[number]))
    .sort((a, b) => {
      const aTime = new Date(a.net ?? a.windowStart ?? '2999-01-01').getTime()
      const bTime = new Date(b.net ?? b.windowStart ?? '2999-01-01').getTime()
      return aTime - bTime
    })

  memoryCache = { savedAt: Date.now(), launches }
  return launches
}

let memoryCache: { savedAt: number; launches: Launch[] } | null = null
const CACHE_TTL = 5 * 60 * 1000
