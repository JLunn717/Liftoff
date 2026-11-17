import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, CalendarDays, ChevronRight, Clock3, ExternalLink, MapPin, Radio, RefreshCw, Rocket, Satellite, Signal, Wifi } from 'lucide-react'
import { getFloridaLaunches } from './api'
import type { Launch } from './types'

function useNow() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id) }, [])
  return now
}
function countdown(date: string | null, now: number) {
  if (!date) return 'TIME TBD'
  const diff = new Date(date).getTime() - now
  if (!Number.isFinite(diff)) return 'TIME TBD'
  if (diff <= 0) return 'T−00:00:00'
  const d = Math.floor(diff / 86400000), h = Math.floor(diff % 86400000 / 3600000), m = Math.floor(diff % 3600000 / 60000), s = Math.floor(diff % 60000 / 1000)
  return d ? `T−${d}D ${String(h).padStart(2,'0')}H ${String(m).padStart(2,'0')}M` : `T−${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}
function dateLabel(date: string | null) {
  if (!date) return 'Launch time not announced'
  const d = new Date(date)
  return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat('en-US', { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit', timeZoneName:'short', timeZone:'America/New_York' }).format(d) : 'Launch time not announced'
}
function tone(status = '') {
  const s = status.toLowerCase()
  return s.includes('go') || s.includes('success') ? 'green' : s.includes('hold') || s.includes('tbd') || s.includes('tentative') ? 'amber' : s.includes('fail') || s.includes('scrub') ? 'red' : 'blue'
}
function LaunchCard({ launch, now, onSelect }: { launch: Launch; now: number; onSelect: (launch: Launch) => void }) {
  const status = launch.status?.name ?? 'Status unavailable'
  const site = launch.pad?.location?.name?.replace(', USA', '') ?? 'Florida launch complex'
  const rocket = launch.rocket?.configuration?.full_name ?? launch.rocket?.configuration?.name ?? 'Launch vehicle TBA'
  return <button className="launch-card" onClick={() => onSelect(launch)}>
    <div className="date-block"><span>{launch.net ? new Date(launch.net).toLocaleDateString('en-US',{month:'short',timeZone:'America/New_York'}).toUpperCase() : 'TBD'}</span><b>{launch.net ? new Date(launch.net).toLocaleDateString('en-US',{day:'2-digit',timeZone:'America/New_York'}) : '—'}</b></div>
    <div className="launch-info"><div className="tags"><i className={`dot ${tone(status)}`}/><span className={tone(status)}>{status}</span><em>/</em>{launch.launch_service_provider?.name ?? 'Provider TBA'}</div><h3>{launch.name}</h3><p><Rocket size={13}/>{rocket}<MapPin size={13}/>{site}</p></div>
    <div className="launch-count"><small>COUNTDOWN</small><b>{countdown(launch.net ?? launch.window_start, now)}</b><ChevronRight size={17}/></div>
  </button>
}
export default function App() {
  const now = useNow()
  const [launches,setLaunches] = useState<Launch[]>([])
  const [loading,setLoading] = useState(true)
  const [refreshing,setRefreshing] = useState(false)
  const [error,setError] = useState('')
  const [cached,setCached] = useState(false)
  const [selected,setSelected] = useState<Launch|null>(null)
  const [filter,setFilter] = useState<'all'|'kennedy'|'cape'>('all')
  const [lastUpdated,setLastUpdated] = useState<Date|null>(null)
  async function load(force = false) {
    force ? setRefreshing(true) : setLoading(true); setError('')
    try { const result = await getFloridaLaunches(force); setLaunches(result.launches); setCached(result.cached); setLastUpdated(new Date()) }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load launch data.') }
    finally { setLoading(false); setRefreshing(false) }
  }
  useEffect(() => { void load() }, [])
  const filtered = useMemo(() => launches.filter(l => {
    const loc = (l.pad?.location?.name ?? '').toLowerCase()
    return filter === 'all' || (filter === 'kennedy' ? loc.includes('kennedy') : loc.includes('cape canaveral'))
  }),[launches,filter])
  const next = filtered.find(l => new Date(l.net ?? l.window_start ?? 0).getTime() > now) ?? filtered[0]
  const live = launches.filter(l => l.webcast_live || l.status?.name?.toLowerCase().includes('live')).length
  const site = next?.pad?.location?.name?.replace(', USA','') ?? 'Awaiting next mission'
  return <div className="shell">
    <aside className="sidebar"><div className="brand"><div className="brand-icon"><Rocket size={20}/></div><div><b>LIFTOFF</b><small>FLIGHT OPERATIONS</small></div></div><div className="side-label">OPERATIONS</div><nav><a className="active"><Activity size={17}/> Mission control</a><a href="#schedule"><CalendarDays size={17}/> Launch schedule</a><a href="#sites"><MapPin size={17}/> Launch sites</a></nav><div className="side-bottom"><span className="pulse"/><div><b>DATA LINK ACTIVE</b><small>LAUNCH LIBRARY 2</small></div><p>FLORIDA SPACE COAST<br/>28° 33′ N / 80° 34′ W</p></div></aside>
    <main className="main"><header className="topbar"><span>FLIGHT OPERATIONS <i>/</i> <b>OVERVIEW</b></span><div><span className="pulse"/> EASTERN TIME <i/> <Wifi size={14}/> SYSTEM ONLINE</div></header>
      <section className="heading"><div><div className="eyebrow"><span/> FLORIDA LAUNCH OPERATIONS CENTER</div><h1>MISSION CONTROL<span>.</span></h1><p>Tracking the next chapter in spaceflight from Florida's Space Coast.</p></div><button className="refresh" onClick={() => void load(true)} disabled={refreshing}><RefreshCw size={15} className={refreshing?'spin':''}/>{refreshing?'SYNCING':'SYNC DATA'}</button></section>
      <section className="hero"><div className="hero-copy"><div className="kicker"><span className="pulse"/> NEXT SCHEDULED LAUNCH</div><h2>{loading && !next ? 'ACQUIRING FLIGHT DATA...' : next?.name ?? (error?'SIGNAL UNAVAILABLE':'NO UPCOMING MISSIONS')}<span>.</span></h2><p className="mission-name">{next?.mission?.name ?? next?.rocket?.configuration?.full_name ?? 'Florida launch window'}</p><small>T-MINUS</small><div className="countdown">{next ? countdown(next.net ?? next.window_start,now) : '--:--:--'}</div><div className="hero-meta"><div><small>LAUNCH SITE</small><b><MapPin size={14}/>{site}</b></div><div><small>LAUNCH DATE / TIME</small><b><CalendarDays size={14}/>{dateLabel(next?.net ?? next?.window_start ?? null)}</b></div><div><small>MISSION STATUS</small><b><i className={`dot ${tone(next?.status?.name)}`}/>{next?.status?.name ?? 'Awaiting data'}</b></div></div></div><div className="orbit"><div/><div/><Rocket size={35}/></div><footer><span><Signal size={13}/> LIVE MISSION FEED</span><span>ALL TIMES EASTERN</span></footer></section>
      <section className="stats"><article><div>UPCOMING MISSIONS <CalendarDays size={16}/></div><b>{loading?'—':String(launches.length).padStart(2,'0')}</b><small>FLORIDA MANIFEST</small></article><article><div>ACTIVE WEBCASTS <Radio size={16}/></div><b>{String(live).padStart(2,'0')}</b><small>LIVE BROADCASTS</small></article><article><div>TRACKED LAUNCH SITES <MapPin size={16}/></div><b>02</b><small>KENNEDY + CAPE CANAVERAL</small></article><article><div>DATA CONNECTION <Satellite size={16}/></div><b className="online">{error?'DEGRADED':'ONLINE'}</b><small>{cached?'CACHED DATA':'LAUNCH LIBRARY 2 API'}</small></article></section>
      <section id="schedule" className="schedule"><div className="section-head"><div><div className="eyebrow">FLIGHT MANIFEST</div><h2>UPCOMING LAUNCHES</h2></div><div className="filters">{(['all','kennedy','cape'] as const).map(f=><button key={f} className={filter===f?'chosen':''} onClick={()=>setFilter(f)}>{f==='all'?'ALL SITES':f.toUpperCase()}</button>)}</div></div>
        {error && <div className="error"><AlertTriangle size={17}/><span>{error}</span><button onClick={()=>void load(true)}>RETRY</button></div>}
        <div className="launch-list">{loading&&!launches.length?<div className="empty"><Clock3 size={22}/><b>ESTABLISHING DATA LINK</b><span>Requesting Florida launch manifest...</span></div>:filtered.length?filtered.map(l=><LaunchCard key={l.id} launch={l} now={now} onSelect={setSelected}/>):<div className="empty"><Rocket size={22}/><b>NO MISSIONS IN THIS VIEW</b><span>No upcoming launches are currently listed for this selection.</span></div>}</div>
        <div className="list-footer"><span>SHOWING {filtered.length} OF {launches.length} FLORIDA MISSIONS</span><span>{lastUpdated? `LAST SYNC ${lastUpdated.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}${cached?' · CACHE':''}`:'AWAITING FIRST SYNC'}</span></div>
      </section>
      <section id="sites" className="sites"><div className="eyebrow">SPACE COAST INFRASTRUCTURE</div><h2>TRACKED LAUNCH SITES</h2><div className="site-grid"><article><span>SITE 01 / KSC</span><div className="site-art"><div className="tower"/></div><div><b>Kennedy Space Center</b><p>NASA's historic launch complex · Merritt Island, FL</p><small>28.57° N / 80.65° W</small></div></article><article><span>SITE 02 / CCSFS</span><div className="site-art cape"><div className="tower"/></div><div><b>Cape Canaveral SFS</b><p>Commercial and military launch range · Cape Canaveral, FL</p><small>28.49° N / 80.58° W</small></div></article></div></section>
      <footer className="page-footer">© {new Date().getFullYear()} LIFTOFF FLIGHT OPERATIONS <span>DATA PROVIDED BY <a href="https://thespacedevs.com/llapi" target="_blank" rel="noreferrer">THE SPACE DEVS <ExternalLink size={11}/></a></span><span>BUILT FOR THE SPACE COAST ✦</span></footer>
    </main>
    {selected&&<div className="backdrop" onClick={()=>setSelected(null)}><div className="modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setSelected(null)}>×</button><div className="eyebrow">MISSION DOSSIER / {selected.id.slice(0,8).toUpperCase()}</div><h2>{selected.name}</h2><p className="modal-status"><i className={`dot ${tone(selected.status?.name)}`}/>{selected.status?.name??'Status unavailable'}</p><div className="modal-count">{countdown(selected.net??selected.window_start,now)}</div><div className="modal-grid">{[['ROCKET',selected.rocket?.configuration?.full_name??'Not announced'],['PROVIDER',selected.launch_service_provider?.name??'Not announced'],['LAUNCH PAD',selected.pad?.name??'Not announced'],['LAUNCH SITE',selected.pad?.location?.name??'Florida'],['MISSION',selected.mission?.name??'Not announced'],['ORBIT',selected.mission?.orbit?.name??'Not announced']].map(([k,v])=><div key={k}><small>{k}</small><b>{v}</b></div>)}</div>{selected.mission?.description&&<p className="description">{selected.mission.description}</p>}<div className="modal-links">{selected.vid_urls?.[0]?.url&&<a href={selected.vid_urls[0].url} target="_blank" rel="noreferrer"><Radio size={14}/> WATCH WEBCAST</a>}{selected.infoURLs?.filter(item=>item.url).map((item,index)=><a key={index} href={item.url} target="_blank" rel="noreferrer">{item.title??'MISSION SOURCE'} <ExternalLink size={13}/></a>)}</div></div></div>}
  </div>
}