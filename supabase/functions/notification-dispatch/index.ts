import { createClient } from 'npm:@supabase/supabase-js@2'

type Device = {
  id: string
  expo_push_token: string
  states: string[]
  alert_24h: boolean
  alert_1h: boolean
  alert_schedule_changes: boolean
  active: boolean
}

type Launch = {
  id: string
  name: string
  state_code: string
  net: string | null
  window_start: string | null
  status_name: string | null
}

type Job = {
  id: string
  device_id: string
  launch_id: string
  job_type: 'reminder_24h' | 'reminder_1h' | 'schedule_changed' | 'status_changed'
  scheduled_for: string
}

const reminderOffsets = {
  reminder_24h: 24 * 60 * 60 * 1000,
  reminder_1h: 60 * 60 * 1000,
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const secret = Deno.env.get('SYNC_SECRET')
  if (!secret || request.headers.get('x-sync-secret') !== secret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const url = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceRoleKey) {
    return Response.json({ error: 'Supabase environment is not configured.' }, { status: 500 })
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const now = new Date()
    const nowIso = now.toISOString()
    const { data: devicesData, error: devicesError } = await supabase
      .from('notification_devices')
      .select('id, expo_push_token, states, alert_24h, alert_1h, alert_schedule_changes, active')
      .eq('active', true)
    if (devicesError) throw devicesError
    const devices = (devicesData ?? []) as Device[]
    const activeDeviceById = new Map(devices.map((device) => [device.id, device]))

    if (!devices.length) {
      return Response.json({ ok: true, devices: 0, scheduled: 0, sent: 0, message: 'No active notification devices.' })
    }

    const { data: launchesData, error: launchesError } = await supabase
      .from('launches')
      .select('id, name, state_code, net, window_start, status_name')
      .order('net', { ascending: true })
      .limit(1000)
    if (launchesError) throw launchesError
    const allLaunches = (launchesData ?? []) as Launch[]
    const launchById = new Map(allLaunches.map((launch) => [launch.id, launch]))
    const launches = allLaunches.filter((launch) => {
      const scheduledAt = launch.net ?? launch.window_start
      return scheduledAt !== null && Date.parse(scheduledAt) >= now.getTime()
    })

    // Cancel reminders that no longer match the current launch time after a delay or reschedule.
    const { data: pendingReminders, error: pendingError } = await supabase
      .from('notification_jobs')
      .select('id, device_id, launch_id, job_type, scheduled_for')
      .eq('status', 'pending')
      .in('job_type', ['reminder_24h', 'reminder_1h'])
      .limit(5000)
    if (pendingError) throw pendingError
    for (const job of pendingReminders ?? []) {
      const launch = launchById.get(job.launch_id)
      const device = activeDeviceById.get(job.device_id)
      const offset = reminderOffsets[job.job_type as keyof typeof reminderOffsets]
      const enabled = job.job_type === 'reminder_24h' ? device?.alert_24h : device?.alert_1h
      const scheduledAt = launch?.net ?? launch?.window_start
      const expected = scheduledAt ? new Date(Date.parse(scheduledAt) - offset).toISOString() : null
      if (!expected || !device || !device.states.includes(launch?.state_code ?? '') || !enabled || expected !== job.scheduled_for) {
        await supabase.from('notification_jobs').update({ status: 'cancelled' }).eq('id', job.id)
      }
    }

    const reminderJobs: Array<Record<string, unknown>> = []
    for (const device of devices) {
      for (const launch of launches) {
        const scheduledAt = launch.net ?? launch.window_start
        if (!device.states.includes(launch.state_code) || !scheduledAt) continue
        const launchTime = Date.parse(scheduledAt)
        const reminders: Array<{ enabled: boolean; type: 'reminder_24h' | 'reminder_1h'; offset: number }> = [
          { enabled: device.alert_24h, type: 'reminder_24h', offset: reminderOffsets.reminder_24h },
          { enabled: device.alert_1h, type: 'reminder_1h', offset: reminderOffsets.reminder_1h },
        ]
        for (const reminder of reminders) {
          const scheduled = launchTime - reminder.offset
          if (reminder.enabled && scheduled > now.getTime()) {
            reminderJobs.push({
              device_id: device.id,
              launch_id: launch.id,
              job_type: reminder.type,
              scheduled_for: new Date(scheduled).toISOString(),
            })
          }
        }
      }
    }

    if (reminderJobs.length) {
      const { error } = await supabase.from('notification_jobs').upsert(reminderJobs, {
        onConflict: 'device_id,launch_id,job_type,scheduled_for',
        ignoreDuplicates: true,
      })
      if (error) throw error
    }

    // Convert recent launch history into one-time change alerts. The unique job key
    // prevents the same event from being queued twice on later dispatcher runs.
    const historySince = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
    const { data: history, error: historyError } = await supabase
      .from('launch_history')
      .select('launch_id, event_type, detected_at')
      .in('event_type', ['schedule_changed', 'status_changed'])
      .gte('detected_at', historySince)
      .limit(1000)
    if (historyError) throw historyError

    const changeJobs: Array<Record<string, unknown>> = []
    for (const event of history ?? []) {
      const launch = launchById.get(event.launch_id)
      if (!launch) continue
      for (const device of devices) {
        if (!device.alert_schedule_changes || !device.states.includes(launch.state_code)) continue
        changeJobs.push({
          device_id: device.id,
          launch_id: launch.id,
          job_type: event.event_type === 'schedule_changed' ? 'schedule_changed' : 'status_changed',
          scheduled_for: event.detected_at,
        })
      }
    }
    if (changeJobs.length) {
      const { error } = await supabase.from('notification_jobs').upsert(changeJobs, {
        onConflict: 'device_id,launch_id,job_type,scheduled_for',
        ignoreDuplicates: true,
      })
      if (error) throw error
    }

    // If a user re-enables an alert before its scheduled time, restore the
    // matching cancelled job instead of leaving the unique-key conflict dormant.
    const desiredJobs = [...reminderJobs, ...changeJobs]
    if (desiredJobs.length) {
      const desiredKeys = new Set(desiredJobs.map((job) =>
        `${job.device_id}|${job.launch_id}|${job.job_type}|${Date.parse(String(job.scheduled_for))}`
      ))
      const deviceIds = [...new Set(desiredJobs.map((job) => String(job.device_id)))]
      const launchIds = [...new Set(desiredJobs.map((job) => String(job.launch_id)))]
      const { data: cancelledJobs, error: cancelledError } = await supabase
        .from('notification_jobs')
        .select('id, device_id, launch_id, job_type, scheduled_for')
        .eq('status', 'cancelled')
        .in('device_id', deviceIds)
        .in('launch_id', launchIds)
        .limit(5000)
      if (cancelledError) throw cancelledError
      for (const job of cancelledJobs ?? []) {
        const key = `${job.device_id}|${job.launch_id}|${job.job_type}|${Date.parse(job.scheduled_for)}`
        if (desiredKeys.has(key)) {
          const { error } = await supabase.from('notification_jobs').update({
            status: 'pending',
            sent_at: null,
            attempt_count: 0,
            last_error: null,
          }).eq('id', job.id)
          if (error) throw error
        }
      }
    }

    const { data: dueData, error: dueError } = await supabase
      .from('notification_jobs')
      .select('id, device_id, launch_id, job_type, scheduled_for')
      .eq('status', 'pending')
      .lte('scheduled_for', nowIso)
      .order('scheduled_for', { ascending: true })
      .limit(100)
    if (dueError) throw dueError
    const due = (dueData ?? []) as Job[]
    if (!due.length) {
      return Response.json({ ok: true, devices: devices.length, scheduled: reminderJobs.length + changeJobs.length, sent: 0 })
    }

    const deviceById = activeDeviceById
    const dueLaunchIds = [...new Set(due.map((job) => job.launch_id))]
    const { data: dueLaunchesData, error: dueLaunchesError } = await supabase
      .from('launches')
      .select('id, name, state_code, net, window_start, status_name')
      .in('id', dueLaunchIds)
    if (dueLaunchesError) throw dueLaunchesError
    const dueLaunchById = new Map(((dueLaunchesData ?? []) as Launch[]).map((launch) => [launch.id, launch]))

    const messages: Array<{ job: Job; device: Device; launch: Launch; payload: Record<string, unknown> }> = []
    for (const job of due) {
      const device = deviceById.get(job.device_id)
      const launch = dueLaunchById.get(job.launch_id)
      const preferenceEnabled = job.job_type === 'reminder_24h'
        ? device?.alert_24h
        : job.job_type === 'reminder_1h'
          ? device?.alert_1h
          : device?.alert_schedule_changes
      if (!device || !launch || !device.states.includes(launch.state_code) || !preferenceEnabled) {
        await supabase.from('notification_jobs').update({ status: 'cancelled' }).eq('id', job.id)
        continue
      }
      const title = job.job_type === 'reminder_24h'
        ? 'Launch in about 24 hours'
        : job.job_type === 'reminder_1h'
          ? 'Launch in about 1 hour'
          : job.job_type === 'schedule_changed'
            ? 'Launch schedule updated'
            : 'Launch status changed'
      const body = job.job_type === 'reminder_24h'
        ? `${launch.name} is scheduled for tomorrow. Check the countdown in Liftoff.`
        : job.job_type === 'reminder_1h'
          ? `${launch.name} is scheduled to launch in about an hour.`
          : job.job_type === 'schedule_changed'
            ? `${launch.name} has a new launch time. Open Liftoff for the latest countdown.`
            : `${launch.name}: ${launch.status_name ?? 'mission status updated'}. Open Liftoff for details.`
      messages.push({ job, device, launch, payload: {
        to: device.expo_push_token,
        title,
        body,
        sound: 'default',
        priority: 'high',
        channelId: 'launch-alerts',
        data: { launchId: launch.id, stateCode: launch.state_code, screen: 'mission' },
      } })
    }

    let sent = 0
    for (let index = 0; index < messages.length; index += 100) {
      const batch = messages.slice(index, index + 100)
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch.map((item) => item.payload)),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(`Expo Push Service returned HTTP ${response.status}: ${JSON.stringify(result)}`)
      const tickets = Array.isArray(result.data) ? result.data : [result.data]
      for (let ticketIndex = 0; ticketIndex < batch.length; ticketIndex++) {
        const item = batch[ticketIndex]
        const ticket = tickets[ticketIndex]
        const ticketError = ticket?.status === 'error' ? ticket.message ?? ticket.details?.error ?? 'Expo rejected this notification.' : null
        if (!ticketError) {
          await supabase.from('notification_jobs').update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            attempt_count: 1,
            last_error: null,
          }).eq('id', item.job.id)
          sent++
        } else {
          await supabase.from('notification_jobs').update({
            status: 'failed',
            attempt_count: 1,
            last_error: String(ticketError).slice(0, 1000),
          }).eq('id', item.job.id)
          if (String(ticketError).includes('DeviceNotRegistered')) {
            await supabase.from('notification_devices').update({ active: false }).eq('id', item.device.id)
          }
        }
      }
    }

    return Response.json({
      ok: true,
      devices: devices.length,
      launches: launches.length,
      scheduled: reminderJobs.length + changeJobs.length,
      due: due.length,
      sent,
    })
  } catch (error) {
    console.error('Notification dispatch failed', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown notification error.' },
      { status: 500 },
    )
  }
})
