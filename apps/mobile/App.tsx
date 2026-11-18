import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { DEFAULT_STATE, STATE_NAMES, TRACKED_STATES, getUpcomingLaunches } from '@liftoff/core'
import type { Launch } from '@liftoff/core'

const colors = {
  background: '#07111d',
  panel: '#0d1b2a',
  panelRaised: '#122438',
  border: '#20364b',
  text: '#f2f6fa',
  muted: '#91a4b7',
  dim: '#63788d',
  accent: '#ff9d3d',
  green: '#54d6a0',
  red: '#ff7777',
}

function formatLaunchDate(value: string | null): string {
  if (!value) return 'SCHEDULE TO BE CONFIRMED'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'SCHEDULE TO BE CONFIRMED'
  return date.toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).toUpperCase()
}

function formatCountdown(value: string | null): string {
  if (!value) return 'COUNTDOWN PENDING'
  const target = new Date(value).getTime()
  if (Number.isNaN(target)) return 'COUNTDOWN PENDING'
  const remaining = target - Date.now()
  if (remaining <= 0) return 'LAUNCH WINDOW OPEN / TIME PASSED'
  const days = Math.floor(remaining / 86400000)
  const hours = Math.floor((remaining % 86400000) / 3600000)
  const minutes = Math.floor((remaining % 3600000) / 60000)
  return days > 0 ? `T−${days}D ${hours}H ${minutes}M` : `T−${hours}H ${minutes}M`
}

function statusColor(status: string): string {
  const value = status.toLowerCase()
  if (value.includes('success') || value.includes('go')) return colors.green
  if (value.includes('fail') || value.includes('scrub') || value.includes('hold')) return colors.red
  return colors.accent
}

function openUrl(url: string | null) {
  if (url) void Linking.openURL(url).catch(() => undefined)
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  )
}

function Accordion({ title, children, open, onPress }: {
  title: string; children: React.ReactNode; open: boolean; onPress: () => void
}) {
  return (
    <View style={styles.accordion}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onPress} style={styles.accordionHeader}>
        <Text style={styles.accordionTitle}>{title}</Text>
        <Text style={styles.accordionToggle}>{open ? '−' : '+'}</Text>
      </Pressable>
      {open ? <View style={styles.accordionBody}>{children}</View> : null}
    </View>
  )
}

function FeaturedMission({ launch }: { launch: Launch }) {
  const [expanded, setExpanded] = useState<string[]>(['mission'])
  const toggle = (key: string) => setExpanded((current) =>
    current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
  )
  const status = launch.status?.name ?? 'Status unknown'
  const launchTime = launch.net ?? launch.windowStart
  const payloadSummary = launch.payloads?.map((payload) => payload.name).filter(Boolean).join(', ')
  const customerSummary = launch.payloads?.flatMap((payload) => payload.customer ?? []).filter(Boolean).join(', ')

  return (
    <View style={styles.featuredCard}>
      <View style={styles.featuredTop}>
        <Text style={styles.featuredEyebrow}>SELECTED MISSION · {launch.stateCode ?? 'USA'}</Text>
        <View style={styles.statusPill}>
          <View style={[styles.statusDot, { backgroundColor: statusColor(status) }]} />
          <Text style={[styles.statusText, { color: statusColor(status) }]}>{status.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.featuredName}>{launch.name}</Text>
      <Text style={styles.countdown}>{formatCountdown(launchTime)}</Text>
      <Text style={styles.featuredDate}>{formatLaunchDate(launchTime)}</Text>
      <View style={styles.featuredRule} />
      <DetailRow label="ROCKET" value={launch.vehicleName} />
      <DetailRow label="BUILT BY" value={launch.vehicleManufacturer} />
      <DetailRow label="LAUNCH OPERATOR" value={launch.providerName} />
      <DetailRow label="LAUNCH SITE" value={launch.launchSiteName} />
      <Text style={styles.featuredHint}>TAP A SECTION TO EXPLORE THE MISSION</Text>

      <Accordion title="MISSION & PURPOSE" open={expanded.includes('mission')} onPress={() => toggle('mission')}>
        <DetailRow label="MISSION" value={launch.missionName} />
        <DetailRow label="MISSION TYPE" value={launch.missionType} />
        <Text style={styles.description}>{launch.missionDescription ?? 'Mission description has not been published by the data provider yet.'}</Text>
        <DetailRow label="CUSTOMER / AGENCY" value={customerSummary || launch.missionAgencies?.join(', ')} />
      </Accordion>
      <Accordion title="PAYLOAD" open={expanded.includes('payload')} onPress={() => toggle('payload')}>
        {launch.payloads?.length ? launch.payloads.map((payload, index) => (
          <View key={`${payload.name}-${index}`} style={styles.payloadBlock}>
            <Text style={styles.payloadName}>{payload.name}</Text>
            <DetailRow label="OWNER / CUSTOMER" value={payload.customer?.join(', ')} />
            <DetailRow label="MANUFACTURER" value={payload.manufacturer} />
            <DetailRow label="ORBIT" value={payload.orbit} />
            <Text style={styles.description}>{payload.description ?? 'Payload purpose details are not available yet.'}</Text>
          </View>
        )) : (
          <Text style={styles.description}>
            {payloadSummary ? `Payload: ${payloadSummary}` : 'Payload details have not been published for this launch yet. Liftoff will show them when the source provides them.'}
          </Text>
        )}
      </Accordion>
      <Accordion title="ROCKET & DESTINATION" open={expanded.includes('rocket')} onPress={() => toggle('rocket')}>
        <DetailRow label="VEHICLE" value={launch.vehicleName} />
        <DetailRow label="MANUFACTURER" value={launch.vehicleManufacturer} />
        <DetailRow label="ROCKET FAMILY" value={launch.vehicleFamily} />
        <DetailRow label="VARIANT" value={launch.vehicleVariant} />
        <DetailRow label="TARGET ORBIT" value={launch.orbitName} />
        <DetailRow label="LAUNCH LOCATION" value={launch.launchLocationName} />
      </Accordion>
      <View style={styles.actionRow}>
        {launch.webcastUrl ? (
          <Pressable onPress={() => openUrl(launch.webcastUrl)} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}>
            <Text style={styles.primaryActionText}>WATCH WEBCAST ↗</Text>
          </Pressable>
        ) : null}
        {launch.infoUrls.length ? (
          <Pressable onPress={() => openUrl(launch.infoUrls[0].url)} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}>
            <Text style={styles.secondaryActionText}>MISSION SOURCE ↗</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

function MissionListCard({ launch, selected, onPress }: { launch: Launch; selected: boolean; onPress: () => void }) {
  const status = launch.status?.name ?? 'Status unknown'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.missionListCard, selected && styles.missionListCardSelected, pressed && styles.pressed]}
    >
      <View style={styles.listCardTop}>
        <Text style={styles.launchState}>{launch.stateCode ?? 'USA'} · {launch.providerName ?? 'Launch provider pending'}</Text>
        <Text style={[styles.listStatus, { color: statusColor(status) }]}>{status.toUpperCase()}</Text>
      </View>
      <Text style={styles.listMissionName}>{launch.name}</Text>
      <Text style={styles.listMissionMeta}>{launch.vehicleName ?? 'Rocket details pending'}  ·  {formatLaunchDate(launch.net ?? launch.windowStart)}</Text>
      <Text style={[styles.selectMission, selected && styles.selectMissionActive]}>{selected ? 'CURRENTLY DISPLAYED' : 'TAP TO VIEW MISSION  →'}</Text>
    </Pressable>
  )
}

export default function App() {
  const [launches, setLaunches] = useState<Launch[]>([])
  const [selectedState, setSelectedState] = useState<string>(DEFAULT_STATE)
  const [selectedLaunchId, setSelectedLaunchId] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(5)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadLaunches = useCallback(async (force = false) => {
    setError(null)
    try {
      const data = await getUpcomingLaunches(force)
      setLaunches(data)
      setSelectedLaunchId((current) => current && data.some((launch) => launch.id === current) ? current : data[0]?.id ?? null)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load launch data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { void loadLaunches() }, [loadLaunches])

  const stateLaunches = useMemo(
    () => launches.filter((launch) => launch.stateCode === selectedState),
    [launches, selectedState],
  )
  const visibleLaunches = stateLaunches.slice(0, visibleCount)
  const selectedLaunch = stateLaunches.find((launch) => launch.id === selectedLaunchId) ?? stateLaunches[0] ?? null
  const stateCounts = useMemo(
    () => Object.fromEntries(TRACKED_STATES.map((code) => [
      code, launches.filter((launch) => launch.stateCode === code).length,
    ])) as Record<(typeof TRACKED_STATES)[number], number>,
    [launches],
  )

  const chooseState = (code: string) => {
    setSelectedState(code)
    setVisibleCount(5)
    const first = launches.find((launch) => launch.stateCode === code)
    setSelectedLaunchId(first?.id ?? null)
  }
  const refresh = () => { setRefreshing(true); void loadLaunches(true) }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={[styles.content, Platform.OS === 'android' && { paddingTop: (StatusBar.currentHeight ?? 0) + 10 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} colors={[colors.accent]} progressBackgroundColor={colors.panel} />}
      >
        <View style={styles.topLine}>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>L</Text></View>
          <View style={styles.brandCopy}>
            <Text style={styles.wordmark}>LIFTOFF</Text>
            <Text style={styles.eyebrow}>MISSION CONTROL</Text>
          </View>
          <View style={styles.onlinePill}>
            <View style={[styles.onlineDot, { backgroundColor: error ? colors.red : colors.green }]} />
            <Text style={[styles.onlineText, { color: error ? colors.red : colors.green }]}>{error ? 'DATA ISSUE' : loading ? 'CONNECTING' : 'LIVE DATA'}</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.kicker}>UNITED STATES SPACEFLIGHT</Text>
          <Text style={styles.heroTitle}>Eyes on the{ '\\n' }next launch.</Text>
          <Text style={styles.heroBody}>Your regional launch picture, organized by state and built for the countdown.</Text>
          <View style={styles.rule} />
          <View style={styles.heroFooter}>
            <View><Text style={styles.metaLabel}>UPCOMING MISSIONS</Text><Text style={styles.metaValue}>{launches.length.toString().padStart(2, '0')} TRACKED</Text></View>
            <View style={styles.heroFooterRight}><Text style={styles.metaLabel}>DEFAULT REGION</Text><Text style={styles.metaValue}>FLORIDA</Text></View>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>TRACKED REGIONS</Text><Text style={styles.sectionHint}>TAP TO FILTER</Text>
        </View>
        <View style={styles.stateGrid}>
          {TRACKED_STATES.map((code) => {
            const selected = code === selectedState
            return (
              <Pressable key={code} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => chooseState(code)}
                style={({ pressed }) => [styles.stateCard, selected && styles.stateCardSelected, pressed && styles.pressed]}>
                <View style={styles.stateCardTop}>
                  <Text style={[styles.stateCode, selected && styles.stateCodeSelected]}>{code}</Text>
                  <Text style={[styles.stateCount, selected && styles.stateCodeSelected]}>{stateCounts[code] ?? 0}</Text>
                </View>
                <Text style={styles.stateName}>{STATE_NAMES[code]}</Text>
                {selected ? <Text style={styles.defaultLabel}>SELECTED REGION</Text> : null}
              </Pressable>
            )
          })}
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>FEATURED MISSION</Text>
          <Text style={styles.sectionHint}>{STATE_NAMES[selectedState].toUpperCase()}</Text>
        </View>
        {loading ? (
          <View style={styles.messageCard}><ActivityIndicator color={colors.accent} size="large" /><Text style={styles.messageTitle}>Establishing data link</Text><Text style={styles.messageBody}>Pulling upcoming missions for the tracked regions.</Text></View>
        ) : error ? (
          <View style={styles.messageCard}><Text style={styles.errorTitle}>DATA LINK INTERRUPTED</Text><Text style={styles.messageBody}>{error}</Text><Pressable onPress={() => { setLoading(true); void loadLaunches(true) }} style={styles.retryButton}><Text style={styles.retryText}>RETRY CONNECTION</Text></Pressable></View>
        ) : selectedLaunch ? <FeaturedMission key={selectedLaunch.id} launch={selectedLaunch} /> : (
          <View style={styles.messageCard}><Text style={styles.messageTitle}>No upcoming missions listed</Text><Text style={styles.messageBody}>There are currently no upcoming launches in {STATE_NAMES[selectedState]} in the data feed. Pull down to refresh.</Text></View>
        )}

        <View style={[styles.sectionHeading, { marginTop: 28 }]}>
          <Text style={styles.sectionTitle}>MISSION FEED</Text><Text style={styles.sectionHint}>TAP A MISSION TO FEATURE IT</Text>
        </View>
        {!loading && !error ? visibleLaunches.map((launch) => (
          <MissionListCard key={launch.id} launch={launch} selected={selectedLaunch?.id === launch.id} onPress={() => setSelectedLaunchId(launch.id)} />
        )) : null}
        {stateLaunches.length > visibleCount ? (
          <Pressable onPress={() => setVisibleCount((count) => count + 20)} style={({ pressed }) => [styles.loadMore, pressed && styles.pressed]}>
            <Text style={styles.loadMoreText}>LOAD NEXT 20 MISSIONS ↓</Text><Text style={styles.loadMoreHint}>{stateLaunches.length - visibleCount} REMAINING</Text>
          </Pressable>
        ) : null}

        <View style={styles.bottomNote}>
          <View style={styles.bottomRule} />
          <Text style={styles.bottomText}>LIFTOFF · REGIONAL SPACEFLIGHT TRACKER</Text>
          <Text style={styles.versionText}>{lastUpdated ? `DATA CHECKED ${lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'MOBILE FOUNDATION 0.3.0'}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 36 },
  topLine: { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  brandMark: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#101b28', fontSize: 25, fontWeight: '900', fontStyle: 'italic' },
  brandCopy: { marginLeft: 11 },
  wordmark: { color: colors.text, fontSize: 18, fontWeight: '900', letterSpacing: 2.4 },
  eyebrow: { color: colors.muted, fontSize: 8, fontWeight: '700', letterSpacing: 2, marginTop: 2 },
  onlinePill: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 7 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  onlineText: { fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  hero: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 20, padding: 20, marginBottom: 28 },
  kicker: { color: colors.accent, fontSize: 9, fontWeight: '800', letterSpacing: 2 },
  heroTitle: { color: colors.text, fontSize: 39, lineHeight: 43, fontWeight: '900', letterSpacing: -1.2, marginTop: 14 },
  heroBody: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 12, maxWidth: 290 },
  rule: { height: 1, backgroundColor: colors.border, marginTop: 22, marginBottom: 17 },
  heroFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  heroFooterRight: { alignItems: 'flex-end' },
  metaLabel: { color: colors.dim, fontSize: 8, fontWeight: '800', letterSpacing: 1.4 },
  metaValue: { color: colors.text, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: 5 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: colors.text, fontSize: 11, fontWeight: '900', letterSpacing: 1.7 },
  sectionHint: { color: colors.dim, fontSize: 8, fontWeight: '800', letterSpacing: 1, flexShrink: 1, textAlign: 'right', marginLeft: 10 },
  stateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  stateCard: { width: '48%', minHeight: 91, flexGrow: 1, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 14 },
  stateCardSelected: { borderColor: colors.accent, backgroundColor: '#1b2631' },
  stateCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stateCode: { color: colors.text, fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  stateCodeSelected: { color: colors.accent },
  stateCount: { color: colors.muted, fontSize: 16, fontWeight: '800' },
  stateName: { color: colors.muted, fontSize: 11, marginTop: 2 },
  defaultLabel: { color: colors.accent, fontSize: 7, fontWeight: '900', letterSpacing: 1, marginTop: 8 },
  featuredCard: { backgroundColor: colors.panel, borderColor: colors.accent, borderWidth: 1, borderRadius: 18, padding: 17 },
  featuredTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  featuredEyebrow: { color: colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  featuredName: { color: colors.text, fontSize: 23, lineHeight: 29, fontWeight: '900', marginTop: 15 },
  countdown: { color: colors.accent, fontSize: 19, fontWeight: '900', letterSpacing: 1, marginTop: 13 },
  featuredDate: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.5, marginTop: 6 },
  featuredRule: { height: 1, backgroundColor: colors.border, marginVertical: 16 },
  statusPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, backgroundColor: colors.panelRaised, paddingHorizontal: 8, paddingVertical: 5 },
  statusDot: { width: 5, height: 5, borderRadius: 3, marginRight: 5 },
  statusText: { fontSize: 7, fontWeight: '900', letterSpacing: 0.7 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 9 },
  detailLabel: { color: colors.dim, fontSize: 8, fontWeight: '900', letterSpacing: 1, flexShrink: 0 },
  detailValue: { color: colors.muted, fontSize: 10, fontWeight: '700', flex: 1, textAlign: 'right' },
  featuredHint: { color: colors.dim, fontSize: 7, fontWeight: '800', letterSpacing: 1, marginTop: 8, marginBottom: 9 },
  accordion: { borderTopWidth: 1, borderTopColor: colors.border },
  accordionHeader: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accordionTitle: { color: colors.text, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  accordionToggle: { color: colors.accent, fontSize: 20, fontWeight: '500' },
  accordionBody: { paddingBottom: 13 },
  description: { color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: 5, marginBottom: 7 },
  payloadBlock: { borderLeftWidth: 2, borderLeftColor: colors.accent, paddingLeft: 10, marginBottom: 12 },
  payloadName: { color: colors.text, fontSize: 12, fontWeight: '900', marginBottom: 9 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 10 },
  primaryAction: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11 },
  primaryActionText: { color: '#101b28', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  secondaryAction: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11 },
  secondaryActionText: { color: colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  missionListCard: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 13, padding: 14, marginBottom: 10 },
  missionListCardSelected: { borderColor: colors.accent, backgroundColor: '#172638' },
  listCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  launchState: { color: colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  listStatus: { fontSize: 7, fontWeight: '900', letterSpacing: 0.6 },
  listMissionName: { color: colors.text, fontSize: 14, fontWeight: '900', lineHeight: 20, marginTop: 8 },
  listMissionMeta: { color: colors.muted, fontSize: 9, lineHeight: 15, marginTop: 5 },
  selectMission: { color: colors.dim, fontSize: 7, fontWeight: '900', letterSpacing: 0.9, marginTop: 10 },
  selectMissionActive: { color: colors.accent },
  messageCard: { alignItems: 'center', backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 22 },
  messageTitle: { color: colors.text, fontSize: 14, fontWeight: '800', textAlign: 'center', marginTop: 12 },
  messageBody: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 7 },
  errorTitle: { color: colors.red, fontSize: 11, fontWeight: '900', letterSpacing: 1, textAlign: 'center' },
  retryButton: { marginTop: 16, borderRadius: 8, backgroundColor: colors.panelRaised, paddingHorizontal: 16, paddingVertical: 11 },
  retryText: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  loadMore: { alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, marginTop: 2 },
  loadMoreText: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  loadMoreHint: { color: colors.dim, fontSize: 8, marginTop: 5 },
  pressed: { opacity: 0.72 },
  bottomNote: { alignItems: 'center', marginTop: 34 },
  bottomRule: { height: 1, width: '100%', backgroundColor: colors.border, marginBottom: 14 },
  bottomText: { color: colors.dim, fontSize: 8, fontWeight: '800', letterSpacing: 1.2, textAlign: 'center' },
  versionText: { color: colors.dim, fontSize: 7, letterSpacing: 1, marginTop: 6 },
})
