import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'GET') {
    return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: corsHeaders })
  }

  const launchId = new URL(request.url).searchParams.get('launch_id')
  if (!launchId || launchId.length > 100) {
    return Response.json({ error: 'A valid launch_id is required.' }, { status: 400, headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: 'History service is not configured.' }, { status: 500, headers: corsHeaders })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabase
    .from('launch_history')
    .select('id, event_type, previous_net, current_net, previous_status, current_status, detected_at, details')
    .eq('launch_id', launchId)
    .order('detected_at', { ascending: false })
    .limit(30)

  if (error) {
    console.error('Public launch history lookup failed', error)
    return Response.json({ error: 'Unable to load mission history.' }, { status: 500, headers: corsHeaders })
  }

  return Response.json({ events: data ?? [] }, {
    headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=60' },
  })
})
