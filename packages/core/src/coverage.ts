/**
 * Liftoff's supported launch coverage.
 *
 * Keep the product's regional scope in one place so the web and mobile
 * clients can share the same state list and labels.
 */
export const TRACKED_STATES = ["FL", "CA", "VA", "TX"] as const

export type TrackedState = (typeof TRACKED_STATES)[number]

export const STATE_NAMES: Record<TrackedState, string> = {
  FL: "Florida",
  CA: "California",
  VA: "Virginia",
  TX: "Texas",
}

export const DEFAULT_STATE: TrackedState = "FL"

export function isTrackedState(value: string): value is TrackedState {
  return (TRACKED_STATES as readonly string[]).includes(value.toUpperCase())
}

/**
 * Launch Library location names commonly end with ", ST, USA".
 * Return null for locations outside the supported US state format.
 */
export function stateCodeFromLocation(locationName = ""): string | null {
  const match = locationName.match(/,\s*([A-Z]{2}),\s*USA\s*$/i)
  return match?.[1]?.toUpperCase() ?? null
}
