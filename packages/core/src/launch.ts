/**
 * Provider-independent launch model.
 *
 * Provider adapters should normalize upstream launch records into this shape
 * before the web or mobile UI consumes them.
 */
export type LaunchStatus = {
  name: string
  abbreviation?: string
  description?: string
}

export type Launch = {
  id: string
  name: string
  net: string | null
  windowStart: string | null
  status: LaunchStatus | null
  providerName: string | null
  vehicleName: string | null
  missionName: string | null
  missionDescription: string | null
  orbitName: string | null
  launchSiteName: string | null
  launchLocationName: string | null
  stateCode: string | null
  webcastUrl: string | null
  infoUrls: Array<{ title: string; url: string }>
  sourceUpdatedAt: string | null
}
