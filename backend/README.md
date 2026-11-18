# Liftoff backend foundation

This directory contains the first server-side piece of Liftoff's notification system.

## What this first slice does

- Pulls the upcoming manifest from Launch Library 2.
- Keeps only launches in FL, CA, VA, and TX.
- Stores normalized launch records in Supabase.
- Preserves a history row when a launch first appears, its scheduled time changes, or its reported status changes.
- Creates private device-preference and notification-job tables for the next implementation step.

It does **not** send push notifications yet. The next slice will register Expo push tokens, schedule 24-hour and 1-hour reminders, and deliver schedule/status change alerts.

## Supabase setup

1. Create a Supabase project.
2. In the SQL Editor, run the migration in `supabase/migrations/20261118000000_notification_foundation.sql`.
3. Deploy the Edge Function:
   ```sh
   supabase functions deploy sync-launches --no-verify-jwt
   ```
4. Set function secrets:
   ```sh
   supabase secrets set SYNC_SECRET="a-long-random-secret"
   ```
   Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions.
5. Optionally set `SPACEDEVS_API_TOKEN` if you obtain an API token from The Space Devs.

The function accepts a POST request with the matching `x-sync-secret` header. Keep the secret private; do not put it in the mobile app or commit it to GitHub.

## Scheduling

After deployment, schedule a POST to the function every 5–10 minutes using Supabase Cron / pg_net or an external scheduler. The request must include the `x-sync-secret` header. We will add the actual scheduled notification dispatcher after push-token registration is implemented.

## Security notes

- The sync function is protected by a server-only secret and uses the Supabase service role only inside the Edge Function.
- Launch data is readable; client roles cannot write launch records or history.
- Notification preferences are scoped to the owning Supabase Auth user, including anonymous users.
- Enable anonymous sign-ins in Supabase Auth before implementing account-free device registration.
- Never expose the service-role key or sync secret in the app bundle.
