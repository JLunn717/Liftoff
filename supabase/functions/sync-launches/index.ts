import { createClient } from 'npm:@supabase/supabase-js@2'

const trackedStates = new Set(['FL', 'CA', 'VA', 'TX'])
const launchLibraryUrl =
  'https://ll.thespacedevs.com/2.3.0/launches/upcoming/?format=json&limit=100&mode=detailed'

type ProviderLaunch = {
  id: string
  name?: string
  net?: string | null
  window_start?: string | null
  updated_at?: string | null
  status?: { name?: string; abbrev?: string; description?: string } | null
  pad?: { name?: string; location?: { name?: string } | null } | null
  launch_service_provider?: { name?: string } | null
}

type ExistingLaunch = {
  id: string
  net: string | null
  window_start: string | null
  status_name: string | null
  status_abbrev: string | null
}

function stateFromLocation(location = ''): string | null {
  const match = location.match(/,\s*([A-Z]{2}),\s*USA\s*$/i)
  const code = match?.[1]?.toUpperCase() ?? null
  return code && trackedStates.has(code) ? code : null
}

function sameInstant(a: string | null, b: string | null): boolean {
  if (!a || !b) return a === b
  const aTime = Date.parse(a)
  const bTime = Date.parse(b)
  return Number.isFinite(aTime) && Number.isFinite(bTime) && aTime === bTime
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const syncSecret = Deno.env.get('SYNC_SECRET')
  if (!syncSecret || request.headers.get('x-sync-secret') !== syncSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: 'Supabase environment is not configured.' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const headers = new Headers({ Accept: 'application/json' })
    const providerToken = Deno.env.get('SPACEDEVS_API_TOKEN')
    if (providerToken) headers.set('Authorization', `Token ${providerToken}`)

    const upstream = await fetch(launchLibraryUrl, { headers })
    if (!upstream.ok) {
      return Response.json(
        { error: `Launch Library returned HTTP ${upstream.status}.` },
        { status: 502 },
      )
    }

    const payload = await upstream.json()
    const providerRecords = Array.isArray(payload) ? payload : payload.results
    if (!Array.isArray(providerRecords)) {
      return Response.json({ error: 'Unexpected Launch Library response.' }, { status: 502 })
    }

    const normalized = (providerRecords as ProviderLaunch[]).flatMap((item) => {
      const location = item.pad?.location?.name ?? ''
      const stateCode = stateFromLocation(location)
      if (!stateCode) return []

      return [{
        id: item.id,
        name: item.name ?? 'Unnamed launch',
        state_code: stateCode,
        net: item.net ?? null,
        window_start: item.window_start ?? null,
        status_name: item.status?.name ?? null,
        status_abbrev: item.status?.abbrev ?? null,
        status_description: item.status?.description ?? null,
        launch_location_name: location || null,
        launch_site_name: item.pad?.name ?? null,
        provider_name: item.launch_service_provider?.name ?? null,
        source_updated_at: item.updated_at ?? null,
        raw_data: item,
        last_seen_at: new Date().toISOString(),
        synced_at: new Date().toISOString(),
      }]
    })

    const ids = normalized.map((item) => item.id)
    let existingById = new Map<string, ExistingLaunch>()
    if (ids.length) {
      const { data, error } = await supabase
        .from('launches')
        .select('id, net, window_start, status_name, status_abbrev')
        .in('id', ids)
      if (error) throw error
      existingById = new Map((data ?? []).map((item) => [item.id, item as ExistingLaunch]))
    }

    const history: Array<Record<string, unknown>> = []
    for (const launch of normalized) {
      const previous = existingById.get(launch.id)
      if (!previous) {
        history.push({
          launch_id: launch.id,
          event_type: 'first_seen',
          current_net: launch.net,
          current_status: launch.status_name,
          source_updated_at: launch.source_updated_at,
        })
        continue
      }

      const previousScheduledAt = previous.net ?? previous.window_start
      const currentScheduledAt = launch.net ?? launch.window_start
      if (!sameInstant(previousScheduledAt, currentScheduledAt)) {
        history.push({
          launch_id: launch.id,
          event_type: 'schedule_changed',
          previous_net: previous.net,
          current_net: launch.net,
          previous_status: previous.status_name,
          current_status: launch.status_name,
          source_updated_at: launch.source_updated_at,
          details: {
            previous_scheduled_at: previousScheduledAt,
            current_scheduled_at: currentScheduledAt,
            previous_time_source: previous.net ? 'net' : 'window_start',
            current_time_source: launch.net ? 'net' : 'window_start',
          },
        })
      }

      const oldStatus = previous.status_abbrev ?? previous.status_name
      const newStatus = launch.status_abbrev ?? launch.status_name
      if (oldStatus !== newStatus) {
        history.push({
          launch_id: launch.id,
          event_type: 'status_changed',
          previous_net: previous.net,
          current_net: launch.net,
          previous_status: previous.status_name,
          current_status: launch.status_name,
          source_updated_at: launch.source_updated_at,
        })
      }
    }

    if (normalized.length) {
      const { error } = await supabase.from('launches').upsert(normalized, { onConflict: 'id' })
      if (error) throw error
    }

    if (history.length) {
      const { error } = await supabase.from('launch_history').insert(history)
      if (error) throw error
    }

    return Response.json({
      ok: true,
      fetched: providerRecords.length,
      tracked: normalized.length,
      firstSeen: history.filter((event) => event.event_type === 'first_seen').length,
      scheduleChanges: history.filter((event) => event.event_type === 'schedule_changed').length,
      statusChanges: history.filter((event) => event.event_type === 'status_changed').length,
      syncedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Launch sync failed', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown launch sync error.' },
      { status: 500 },
    )
  }
})
