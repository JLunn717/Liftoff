export type Launch = {
  id: string; name: string; net: string | null; window_start: string | null
  status?: { name?: string; abbrev?: string; description?: string }
  rocket?: { configuration?: { name?: string; full_name?: string } }
  launch_service_provider?: { name?: string }
  pad?: { name?: string; location?: { name?: string }; map_url?: string }
  mission?: { name?: string; description?: string; orbit?: { name?: string } }
  webcast_live?: boolean; vid_urls?: Array<{ url?: string; title?: string }>; url?: string
}