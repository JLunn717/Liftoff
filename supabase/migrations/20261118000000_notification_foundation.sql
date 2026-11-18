-- Liftoff notification foundation: normalized launch state and change history.
create extension if not exists pgcrypto;

create table if not exists public.launches (
  id text primary key,
  name text not null,
  state_code text not null check (state_code in ('FL', 'CA', 'VA', 'TX')),
  net timestamptz,
  window_start timestamptz,
  status_name text,
  status_abbrev text,
  status_description text,
  launch_location_name text,
  launch_site_name text,
  provider_name text,
  source_updated_at timestamptz,
  raw_data jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

create index if not exists launches_net_idx on public.launches (net);
create index if not exists launches_state_net_idx on public.launches (state_code, net);

create table if not exists public.launch_history (
  id uuid primary key default gen_random_uuid(),
  launch_id text not null references public.launches(id) on delete cascade,
  event_type text not null check (event_type in ('first_seen', 'schedule_changed', 'status_changed')),
  previous_net timestamptz,
  current_net timestamptz,
  previous_status text,
  current_status text,
  detected_at timestamptz not null default now(),
  source_updated_at timestamptz,
  details jsonb not null default '{}'::jsonb
);

create index if not exists launch_history_launch_detected_idx
  on public.launch_history (launch_id, detected_at desc);

-- A device can subscribe without creating a traditional account. Supabase
-- anonymous auth supplies a private user_id so one device cannot edit another.
create table if not exists public.notification_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  states text[] not null default array['FL']::text[],
  alert_24h boolean not null default true,
  alert_1h boolean not null default true,
  alert_schedule_changes boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_devices_states_valid
    check (states <@ array['FL', 'CA', 'VA', 'TX']::text[])
);

create index if not exists notification_devices_user_idx
  on public.notification_devices (user_id) where active = true;

create table if not exists public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.notification_devices(id) on delete cascade,
  launch_id text not null references public.launches(id) on delete cascade,
  job_type text not null check (job_type in ('reminder_24h', 'reminder_1h', 'schedule_changed', 'status_changed')),
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'sent', 'cancelled', 'failed')),
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  unique (device_id, launch_id, job_type, scheduled_for)
);

create index if not exists notification_jobs_due_idx
  on public.notification_jobs (scheduled_for) where status = 'pending';

alter table public.launches enable row level security;
alter table public.launch_history enable row level security;
alter table public.notification_devices enable row level security;
alter table public.notification_jobs enable row level security;

-- Public launch information can be read by the app. Writes are service-role only.
drop policy if exists "Anyone can read launches" on public.launches;
create policy "Anyone can read launches" on public.launches for select using (true);
drop policy if exists "Anyone can read launch history" on public.launch_history;
create policy "Anyone can read launch history" on public.launch_history for select using (true);

-- Device preferences are private to the signed-in (including anonymous) owner.
drop policy if exists "Owners can read their notification devices" on public.notification_devices;
create policy "Owners can read their notification devices" on public.notification_devices
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Owners can add their notification devices" on public.notification_devices;
create policy "Owners can add their notification devices" on public.notification_devices
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Owners can update their notification devices" on public.notification_devices;
create policy "Owners can update their notification devices" on public.notification_devices
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Owners can delete their notification devices" on public.notification_devices;
create policy "Owners can delete their notification devices" on public.notification_devices
  for delete to authenticated using (auth.uid() = user_id);

-- Jobs are intentionally not exposed to client roles; Edge Functions use service role.
