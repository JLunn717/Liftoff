import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = request.headers.get('Authorization')
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    return Response.json({ error: 'Notification test is not configured.' }, { status: 500 })
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return Response.json({ error: 'Sign in to Liftoff before testing alerts.' }, { status: 401 })

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const { data: devices, error: deviceError } = await admin
      .from('notification_devices')
      .select('expo_push_token')
      .eq('user_id', userData.user.id)
      .eq('active', true)
    if (deviceError) throw deviceError
    if (!devices?.length) return Response.json({ error: 'This device is not registered for launch alerts yet.' }, { status: 404 })

    const messages = devices.map((device) => ({
      to: device.expo_push_token,
      title: 'Liftoff communications check',
      body: 'Your launch alert connection is working. Eyes on the sky. 🚀',
      sound: 'default',
      priority: 'high',
      channelId: 'launch-alerts',
      data: { screen: 'notifications-test' },
    }))

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    })
    const result = await response.json()
    if (!response.ok) {
      return Response.json({ error: 'Expo Push Service could not accept the test alert.', details: result }, { status: 502 })
    }
    const tickets = Array.isArray(result.data) ? result.data : [result.data]
    const failed = tickets.find((ticket: { status?: string; message?: string }) => ticket?.status === 'error')
    if (failed) {
      return Response.json({ error: failed.message ?? 'Expo could not deliver the test alert.', details: result }, { status: 502 })
    }

    return Response.json({ ok: true, sent: messages.length })
  } catch (error) {
    console.error('Test notification failed', error)
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to send test alert.' }, { status: 500 })
  }
})
