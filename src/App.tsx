import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, CalendarDays, ChevronRight, Clock3, ExternalLink, MapPin, Radio, RefreshCw, Rocket, Satellite, Signal, Wifi } from 'lucide-react'
import { getUSLaunches } from './api'
import type { Launch } from './types'
import { DEFAULT_STATE, TRACKED_STATES, stateCodeFromLocation } from '../packages/core/src/coverage'

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
const STATE_NAMES: Record<string,string> = { AL:'Alabama', AK:'Alaska', AZ:'Arizona', AR:'Arkansas', CA:'California', CO:'Colorado', CT:'Connecticut', DE:'Delaware', FL:'Florida', GA:'Georgia', HI:'Hawaii', ID:'Idaho', IL:'Illinois', IN:'Indiana', IA:'Iowa', KS:'Kansas', KY:'Kentucky', LA:'Louisiana', ME:'Maine', MD:'Maryland', MA:'Massachusetts', MI:'Michigan', MN:'Minnesota', MS:'Mississippi', MO:'Missouri', MT:'Montana', NE:'Nebraska', NV:'Nevada', NH:'New Hampshire', NJ:'New Jersey', NM:'New Mexico', NY:'New York', NC:'North Carolina', ND:'North Dakota', OH:'Ohio', OK:'Oklahoma', OR:'Oregon', PA:'Pennsylvania', RI:'Rhode Island', SC:'South Carolina', SD:'South Dakota', TN:'Tennessee', TX:'Texas', UT:'Utah', VT:'Vermont', VA:'Virginia', WA:'Washington', WV:'West Virginia', WI:'Wisconsin', WY:'Wyoming', DC:'District of Columbia' }
function stateCode(launch: Launch) { return stateCodeFromLocation(launch.pad?.location?.name ?? '') ?? '' }
function tone(status = '') {
  const s = status.toLowerCase()
  return s.includes('go') || s.includes('success') ? 'green' : s.includes('hold') || s.includes('tbd') || s.includes('tentative') ? 'amber' : s.includes('fail') || s.includes('scrub') ? 'red' : 'blue'
}
function LaunchCard({ launch, now, onSelect }: { launch: Launch; now: number; onSelect: (launch: Launch) => void }) {
  const status = launch.status?.name ?? 'Status unavailable'
  const site = launch.pad?.location?.name?.replace(', USA', '') ?? 'United States launch complex'
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
  const [availableStates,setAvailableStates] = useState<string[]>([])
  const [loading,setLoading] = useState(true)
  const [refreshing,setRefreshing] = useState(false)
  const [error,setError] = useState('')
  const [cached,setCached] = useState(false)
  const [selected,setSelected] = useState<Launch|null>(null)
  const [stateFilter,setStateFilter] = useState<string>(DEFAULT_STATE)
  const [visibleCount,setVisibleCount] = useState(5)
  const [lastUpdated,setLastUpdated] = useState<Date|null>(null)
  async function load(force = false) {
    force ? setRefreshing(true) : setLoading(true); setError('')
    try { const result = await getUSLaunches(force); setLaunches(result.launches); setAvailableStates(result.stateCodes); setCached(result.cached); setLastUpdated(new Date()) }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load launch data.') }
    finally { setLoading(false); setRefreshing(false) }
  }
  useEffect(() => { void load() }, [])
  const states = useMemo(() => TRACKED_STATES.filter(code => availableStates.includes(code)), [availableStates])
  const filtered = useMemo(() => launches.filter(launch => stateFilter === 'ALL' || stateCode(launch) === stateFilter), [launches,stateFilter])
  useEffect(() => { setVisibleCount(5) }, [stateFilter])
  const visibleLaunches = filtered.slice(0, visibleCount)
  const next = filtered.find(l => new Date(l.net ?? l.window_start ?? 0).getTime() > now) ?? filtered[0]
  const live = launches.filter(l => l.webcast_live || l.status?.name?.toLowerCase().includes('live')).length
  const site = next?.pad?.location?.name?.replace(', USA','') ?? 'Awaiting next mission'
  return <div className="shell">
    <aside className="sidebar"><div className="brand"><div className="brand-icon"><Rocket size={20}/></div><div><b>LIFTOFF</b><small>FLIGHT OPERATIONS</small></div></div><div className="side-label">OPERATIONS</div><nav><a className="active"><Activity size={17}/> Mission control</a><a href="#schedule"><CalendarDays size={17}/> Launch schedule</a><a href="#sites"><MapPin size={17}/> Launch sites</a></nav><div className="side-bottom"><span className="pulse"/><div><b>DATA LINK ACTIVE</b><small>LAUNCH LIBRARY 2</small></div><p>UNITED STATES<br/>NATIONAL LAUNCH NETWORK</p></div></aside>
    <main className="main"><header className="topbar"><span>FLIGHT OPERATIONS <i>/</i> <b>OVERVIEW</b></span><div><span className="pulse"/> EASTERN TIME <i/> <Wifi size={14}/> SYSTEM ONLINE</div></header>
      <section className="heading"><div><div className="eyebrow"><span/> UNITED STATES LAUNCH OPERATIONS CENTER</div><h1>MISSION CONTROL<span>.</span></h1><p>Tracking America's launch activity, state by state.</p></div><button className="refresh" onClick={() => void load(true)} disabled={refreshing}><RefreshCw size={15} className={refreshing?'spin':''}/>{refreshing?'SYNCING':'SYNC DATA'}</button></section>
      <section className="hero"><div className="hero-copy"><div className="kicker"><span className="pulse"/> NEXT SCHEDULED LAUNCH</div><h2>{loading && !next ? 'ACQUIRING FLIGHT DATA...' : next?.name ?? (error?'SIGNAL UNAVAILABLE':'NO UPCOMING MISSIONS')}<span>.</span></h2><p className="mission-name">{next?.mission?.name ?? next?.rocket?.configuration?.full_name ?? 'US launch window'}</p><small>T-MINUS</small><div className="countdown">{next ? countdown(next.net ?? next.window_start,now) : '--:--:--'}</div><div className="hero-meta"><div><small>LAUNCH SITE</small><b><MapPin size={14}/>{site}</b></div><div><small>LAUNCH DATE / TIME</small><b><CalendarDays size={14}/>{dateLabel(next?.net ?? next?.window_start ?? null)}</b></div><div><small>MISSION STATUS</small><b><i className={`dot ${tone(next?.status?.name)}`}/>{next?.status?.name ?? 'Awaiting data'}</b></div></div></div><div className="orbit"><div/><div/><Rocket size={35}/></div><footer><span><Signal size={13}/> LIVE MISSION FEED</span><span>ALL TIMES EASTERN</span></footer></section>
      <section className="stats"><article><div>UPCOMING MISSIONS <CalendarDays size={16}/></div><b>{loading?'—':String(launches.length).padStart(2,'0')}</b><small>US LAUNCH MANIFEST</small></article><article><div>ACTIVE WEBCASTS <Radio size={16}/></div><b>{String(live).padStart(2,'0')}</b><small>LIVE BROADCASTS</small></article><article><div>TRACKED LAUNCH SITES <MapPin size={16}/></div><b>{states.length}</b><small>ACTIVE LAUNCH STATES</small></article><article><div>DATA CONNECTION <Satellite size={16}/></div><b className="online">{error?'DEGRADED':'ONLINE'}</b><small>{cached?'CACHED DATA':'LAUNCH LIBRARY 2 API'}</small></article></section>
      <section id="schedule" className="schedule"><div className="section-head"><div><div className="eyebrow">NATIONAL FLIGHT MANIFEST</div><h2>UPCOMING LAUNCHES</h2></div><div className="filters"><label htmlFor="state-filter">STATE</label><select id="state-filter" value={stateFilter} onChange={event=>setStateFilter(event.target.value)}><option value="ALL">ALL STATES</option>{states.map(code=><option key={code} value={code}>{STATE_NAMES[code]}</option>)}</select></div></div>
        {error && <div className="error"><AlertTriangle size={17}/><span>{error}</span><button onClick={()=>void load(true)}>RETRY</button></div>}
        <div className="launch-list">{loading&&!launches.length?<div className="empty"><Clock3 size={22}/><b>ESTABLISHING DATA LINK</b><span>Requesting US launch manifest...</span></div>:filtered.length?visibleLaunches.map(l=><LaunchCard key={l.id} launch={l} now={now} onSelect={setSelected}/>):<div className="empty"><Rocket size={22}/><b>NO MISSIONS IN THIS VIEW</b><span>No upcoming launches are currently listed for this selection.</span></div>}</div>
        <div className="list-footer"><span>SHOWING {Math.min(visibleCount,filtered.length)} OF {filtered.length} {stateFilter==='ALL'?'US':STATE_NAMES[stateFilter].toUpperCase()} MISSIONS</span><span>{lastUpdated? `LAST SYNC ${lastUpdated.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}${cached?' · CACHE':''}`:'AWAITING FIRST SYNC'}</span></div>{filtered.length>visibleCount&&<button className="refresh" style={{margin:"18px auto 0",display:"flex"}} onClick={()=>setVisibleCount(n=>Math.min(n+20,filtered.length))}>SHOW NEXT {Math.min(20,filtered.length-visibleCount)} LAUNCHES <ChevronRight size={14}/></button>}
      </section>
      <section id="sites" className="sites"><div className="eyebrow">NATIONAL SPACE INFRASTRUCTURE</div><h2>TRACKED LAUNCH STATES</h2><div className="state-grid">{states.map(code=><button key={code} className="state-card" onClick={()=>{setStateFilter(code);document.getElementById("schedule")?.scrollIntoView({behavior:"smooth"})}}><span>{code}</span><b>{STATE_NAMES[code]}</b><small>{launches.filter(launch=>stateCode(launch)===code).length} upcoming missions</small></button>)}</div></section>
      <footer className="page-footer">© {new Date().getFullYear()} LIFTOFF FLIGHT OPERATIONS <span>DATA PROVIDED BY <a href="https://thespacedevs.com/llapi" target="_blank" rel="noreferrer">THE SPACE DEVS <ExternalLink size={11}/></a></span><span>BUILT FOR THE SPACE COAST ✦</span></footer>
    </main>
    {selected&&<div className="backdrop" onClick={()=>setSelected(null)}><div className="modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setSelected(null)}>×</button><div className="eyebrow">MISSION DOSSIER / {selected.id.slice(0,8).toUpperCase()}</div><h2>{selected.name}</h2><p className="modal-status"><i className={`dot ${tone(selected.status?.name)}`}/>{selected.status?.name??'Status unavailable'}</p><div className="modal-count">{countdown(selected.net??selected.window_start,now)}</div><div className="modal-grid">{[['ROCKET',selected.rocket?.configuration?.full_name??'Not announced'],['PROVIDER',selected.launch_service_provider?.name??'Not announced'],['LAUNCH PAD',selected.pad?.name??'Not announced'],['LAUNCH SITE',selected.pad?.location?.name??'United States'],['MISSION',selected.mission?.name??'Not announced'],['ORBIT',selected.mission?.orbit?.name??'Not announced']].map(([k,v])=><div key={k}><small>{k}</small><b>{v}</b></div>)}</div>{selected.mission?.description&&<p className="description">{selected.mission.description}</p>}<div className="modal-links">{selected.vid_urls?.[0]?.url&&<a href={selected.vid_urls[0].url} target="_blank" rel="noreferrer"><Radio size={14}/> WATCH WEBCAST</a>}{selected.infoURLs?.filter(item=>item.url).map((item,index)=><a key={index} href={item.url} target="_blank" rel="noreferrer">{item.title??'MISSION SOURCE'} <ExternalLink size={13}/></a>)}</div></div></div>}
  </div>
}