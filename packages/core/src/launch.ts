/**
 * Provider-independent launch model.
 *
 * Provider adapters normalize upstream launch records into this shape before
 * the web or mobile UI consumes them. Optional enrichment is kept nullable:
 * payload and vehicle metadata are not published for every mission.
 */
export type LaunchStatus = {
  name: string
  abbreviation?: string
  description?: string
}

export type LaunchPayload = {
  name: string
  description: string | null
  customer: string[]
  manufacturer: string | null
  orbit: string | null
}

export type Launch = {
  id: string
  name: string
  net: string | null
  windowStart: string | null
  status: LaunchStatus | null
  providerName: string | null
  vehicleName: string | null
  vehicleManufacturer: string | null
  vehicleFamily: string | null
  vehicleVariant: string | null
  missionName: string | null
  missionDescription: string | null
  missionType: string | null
  missionAgencies: string[]
  payloads: LaunchPayload[]
  orbitName: string | null
  launchSiteName: string | null
  launchLocationName: string | null
  stateCode: string | null
  webcastUrl: string | null
  infoUrls: Array<{ title: string; url: string }>
  sourceUpdatedAt: string | null
}
