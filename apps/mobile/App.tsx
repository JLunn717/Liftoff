import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Modal,
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
import { DEFAULT_STATE, STATE_NAMES, TRACKED_STATES, normalizeProviderLaunch } from '@liftoff/core'
import type { ProviderLaunch } from '@liftoff/core'
import { SUPABASE_CONFIG } from './supabase.config'
import type { Launch } from '@liftoff/core'
import NotificationSettings from './NotificationSettings'

const colors = {
  background: '#07111d',
  panel: '#0d1b2a',
  panelRaised: '#122438',
  border: '#20364b',
  text: '#f2f6fa',
  muted: '#91a4b7',
  dim: '#63788d',
  accent: '#5bd1e4',
  green: '#54d6a0',
  red: '#ff7777',
}

function formatDate(value: string | null): string {
  if (!value) return 'Launch time not announced'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Launch time not announced'
  return date.toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  })
}

function countdown(value: string | null): string {
  if (!value) return 'TIME TBD'
  const remaining = new Date(value).getTime() - Date.now()
  if (!Number.isFinite(remaining)) return 'TIME TBD'
  if (remaining <= 0) return 'T−00:00:00'
  const days = Math.floor(remaining / 86400000)
  const hours = Math.floor((remaining % 86400000) / 3600000)
  const minutes = Math.floor((remaining % 3600000) / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)
  return days > 0
    ? `T−${days}D ${String(hours).padStart(2, '0')}H ${String(minutes).padStart(2, '0')}M`
    : `T−${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function statusColor(status: string): string {
  const value = status.toLowerCase()
  if (value.includes('success') || value.includes('go') || value.includes('live')) return colors.green
  if (value.includes('fail') || value.includes('scrub') || value.includes('hold')) return colors.red
  return colors.accent
}

function openUrl(url: string | null) {
  if (url) void Linking.openURL(url).catch(() => undefined)
}

function DataPair({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <View style={styles.dataPair}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValue}>{value}</Text>
    </View>
  )
}

function MissionDossier({ launch, onClose }: { launch: Launch; onClose: () => void }) {
  const status = launch.status?.name ?? 'Status unavailable'
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.dossier}>
          <View style={styles.modalHandle} />
          <View style={styles.dossierTop}>
            <Text style={styles.eyebrow}>MISSION DOSSIER / {launch.stateCode ?? 'USA'}</Text>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
              <Text style={styles.closeButton}>×</Text>
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.dossierScroll}>
            <Text style={styles.dossierTitle}>{launch.name}</Text>
            <View style={styles.statusLine}>
              <View style={[styles.statusDot, { backgroundColor: statusColor(status) }]} />
              <Text style={[styles.statusText, { color: statusColor(status) }]}>{status.toUpperCase()}</Text>
            </View>
            <Text style={styles.dossierCountdown}>{countdown(launch.net ?? launch.windowStart)}</Text>
            <Text style={styles.dossierDate}>{formatDate(launch.net ?? launch.windowStart)}</Text>
            <View style={styles.dossierRule} />
            <Text style={styles.dossierSection}>FLIGHT DETAILS</Text>
            <DataPair label="ROCKET" value={launch.vehicleName} />
            <DataPair label="BUILT BY" value={launch.vehicleManufacturer} />
            <DataPair label="LAUNCH PROVIDER" value={launch.providerName} />
            <DataPair label="LAUNCH SITE" value={launch.launchSiteName} />
            <DataPair label="MISSION" value={launch.missionName} />
            <DataPair label="MISSION TYPE" value={launch.missionType} />
            <DataPair label="TARGET ORBIT" value={launch.orbitName} />
            {launch.missionDescription ? <Text style={styles.description}>{launch.missionDescription}</Text> : null}
            {launch.payloads.length > 0 ? (
              <>
                <View style={styles.dossierRule} />
                <Text style={styles.dossierSection}>PAYLOAD</Text>
                {launch.payloads.map((payload, index) => (
                  <View key={`${payload.name}-${index}`} style={styles.payload}>
                    <Text style={styles.payloadName}>{payload.name}</Text>
                    <DataPair label="CUSTOMER" value={payload.customer.join(', ')} />
                    <DataPair label="MANUFACTURER" value={payload.manufacturer} />
                    <DataPair label="ORBIT" value={payload.orbit} />
                    {payload.description ? <Text style={styles.description}>{payload.description}</Text> : null}
                  </View>
                ))}
              </>
            ) : null}
            {launch.missionAgencies.length > 0 ? <DataPair label="MISSION AGENCIES" value={launch.missionAgencies.join(', ')} /> : null}
            <View style={styles.actionRow}>
              {launch.webcastUrl ? <Pressable onPress={() => openUrl(launch.webcastUrl)} style={styles.primaryAction}><Text style={styles.primaryActionText}>WATCH WEBCAST ↗</Text></Pressable> : null}
              {launch.infoUrls[0]?.url ? <Pressable onPress={() => openUrl(launch.infoUrls[0].url)} style={styles.secondaryAction}><Text style={styles.secondaryActionText}>MISSION SOURCE ↗</Text></Pressable> : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

function LaunchRow({ launch, onPress }: { launch: Launch; onPress: () => void }) {
  const status = launch.status?.name ?? 'Status unavailable'
  const time = launch.net ?? launch.windowStart
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.launchRow, pressed && styles.pressed]}>
      <View style={styles.dateBlock}>
        <Text style={styles.dateMonth}>{time ? new Date(time).toLocaleDateString(undefined, { month: 'short' }).toUpperCase() : 'TBD'}</Text>
        <Text style={styles.dateDay}>{time ? new Date(time).toLocaleDateString(undefined, { day: '2-digit' }) : '—'}</Text>
      </View>
      <View style={styles.launchInfo}>
        <View style={styles.tags}>
          <View style={[styles.statusDot, { backgroundColor: statusColor(status) }]} />
          <Text style={[styles.rowStatus, { color: statusColor(status) }]}>{status}</Text>
          <Text style={styles.slash}>/</Text>
          <Text style={styles.provider} numberOfLines={1}>{launch.providerName ?? 'Provider TBA'}</Text>
        </View>
        <Text style={styles.launchName} numberOfLines={2}>{launch.name}</Text>
        <Text style={styles.launchMeta} numberOfLines={1}>{launch.vehicleName ?? 'Launch vehicle TBA'}  ·  {launch.launchSiteName ?? 'Launch site TBA'}</Text>
      </View>
      <View style={styles.rowCountdown}>
        <Text style={styles.countdownLabel}>COUNTDOWN</Text>
        <Text style={styles.countdownValue}>{countdown(time)}</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  )
}

export default function App() {
  const [launches, setLaunches] = useState<Launch[]>([])
  const [selectedState, setSelectedState] = useState<string>(DEFAULT_STATE)
  const [statePickerOpen, setStatePickerOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(5)
  const [selectedMission, setSelectedMission] = useState<Launch | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadLaunches = useCallback(async (_force = false) => {
    setError(null)
    try {
      if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
        throw new Error('Liftoff database connection is not configured yet.')
      }
      const response = await fetch(
        `${SUPABASE_CONFIG.url}/rest/v1/launches?select=raw_data&order=net.asc.nullslast`,
        {
          headers: {
            apikey: SUPABASE_CONFIG.anonKey,
            Authorization: `Bearer ${SUPABASE_CONFIG.anonKey}`,
            Accept: 'application/json',
          },
        },
      )
      if (!response.ok) {
        throw new Error(`Liftoff database returned ${response.status}. Please try again shortly.`)
      }
      const rows = await response.json() as Array<{ raw_data: ProviderLaunch }>
      const data = rows
        .map((row) => normalizeProviderLaunch(row.raw_data))
        .sort((a, b) => new Date(a.net ?? a.windowStart ?? '2999-01-01').getTime() - new Date(b.net ?? b.windowStart ?? '2999-01-01').getTime())
      setLaunches(data)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load launch data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { void loadLaunches() }, [loadLaunches])

  const filtered = useMemo(
    () => selectedState === 'ALL' ? launches : launches.filter((launch) => launch.stateCode === selectedState),
    [launches, selectedState],
  )
  const nextLaunch = useMemo(() => {
    const now = Date.now()
    return filtered.find((launch) => new Date(launch.net ?? launch.windowStart ?? 0).getTime() >= now) ?? filtered[0] ?? null
  }, [filtered])
  const visibleLaunches = filtered.slice(0, visibleCount)
  const stateCounts = useMemo(
    () => Object.fromEntries(TRACKED_STATES.map((code) => [
      code, launches.filter((launch) => launch.stateCode === code).length,
    ])) as Record<(typeof TRACKED_STATES)[number], number>,
    [launches],
  )
  const liveCount = launches.filter((launch) => launch.status?.name?.toLowerCase().includes('live')).length

  const chooseState = (code: string) => {
    setSelectedState(code)
    setVisibleCount(5)
    setStatePickerOpen(false)
  }
  const selectedStateName = selectedState === 'ALL' ? 'All tracked states' : STATE_NAMES[selectedState];
  const selectedStateCount = selectedState === 'ALL' ? launches.length : stateCounts[selectedState as keyof typeof stateCounts] ?? 0;
  const refresh = () => { setRefreshing(true); void loadLaunches(true) }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={[styles.content, Platform.OS === 'android' && { paddingTop: (StatusBar.currentHeight ?? 0) + 10 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} colors={[colors.accent]} progressBackgroundColor={colors.panel} />}
      >
        <View style={styles.topLine}>
          <View style={styles.brandIcon}><Text style={styles.brandIconText}>L</Text></View>
          <View style={styles.brandCopy}>
            <Text style={styles.wordmark}>LIFTOFF</Text>
            <Text style={styles.brandSub}>FLIGHT OPERATIONS</Text>
          </View>
          <View style={styles.connection}>
            <View style={[styles.connectionDot, { backgroundColor: error ? colors.red : colors.green }]} />
            <Text style={[styles.connectionText, { color: error ? colors.red : colors.green }]}>{error ? 'DATA ISSUE' : loading ? 'CONNECTING' : 'SYSTEM ONLINE'}</Text>
          </View>
        </View>

        <View style={styles.pageHeading}>
          <View>
            <Text style={styles.eyebrow}>UNITED STATES LAUNCH OPERATIONS CENTER</Text>
            <Text style={styles.pageTitle}>MISSION CONTROL<Text style={styles.titleAccent}>.</Text></Text>
            <Text style={styles.pageSubtitle}>Tracking America's launch activity, state by state.</Text>
          </View>
          <Pressable onPress={refresh} style={({ pressed }) => [styles.syncButton, pressed && styles.pressed]}>
            <Text style={styles.syncText}>↻ SYNC</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroKickerRow}>
            <View style={styles.liveIndicator} />
            <Text style={styles.heroKicker}>NEXT SCHEDULED LAUNCH</Text>
            <Text style={styles.heroState}>{selectedState}</Text>
          </View>
          {loading && !nextLaunch ? (
            <View style={styles.heroLoading}><ActivityIndicator color={colors.accent} /><Text style={styles.heroLoadingText}>ACQUIRING FLIGHT DATA...</Text></View>
          ) : nextLaunch ? (
            <>
              <Text style={styles.heroTitle}>{nextLaunch.name}<Text style={styles.titleAccent}>.</Text></Text>
              <Text style={styles.heroMission}>{nextLaunch.missionName ?? nextLaunch.vehicleName ?? 'United States launch window'}</Text>
              <Text style={styles.tMinus}>T-MINUS</Text>
              <Text style={styles.heroCountdown}>{countdown(nextLaunch.net ?? nextLaunch.windowStart)}</Text>
              <View style={styles.heroRule} />
              <View style={styles.heroMeta}>
                <View style={styles.heroMetaItem}>
                  <Text style={styles.metaLabel}>LAUNCH SITE</Text>
                  <Text style={styles.metaValue} numberOfLines={2}>{nextLaunch.launchSiteName ?? 'Awaiting details'}</Text>
                </View>
                <View style={styles.heroMetaItem}>
                  <Text style={styles.metaLabel}>LAUNCH DATE / TIME</Text>
                  <Text style={styles.metaValue} numberOfLines={2}>{formatDate(nextLaunch.net ?? nextLaunch.windowStart)}</Text>
                </View>
                <View style={styles.heroMetaItem}>
                  <Text style={styles.metaLabel}>MISSION STATUS</Text>
                  <View style={styles.heroStatus}><View style={[styles.statusDot, { backgroundColor: statusColor(nextLaunch.status?.name ?? '') }]} /><Text style={styles.metaValue} numberOfLines={2}>{nextLaunch.status?.name ?? 'Awaiting data'}</Text></View>
                </View>
              </View>
              <Pressable onPress={() => setSelectedMission(nextLaunch)} style={styles.dossierLink}>
                <Text style={styles.dossierLinkText}>VIEW MISSION DOSSIER  ↗</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.heroLoading}><Text style={styles.heroTitleSmall}>{error ? 'SIGNAL UNAVAILABLE' : 'NO UPCOMING MISSIONS'}</Text><Text style={styles.heroLoadingText}>{error ?? `No upcoming launches are currently listed for ${STATE_NAMES[selectedState]}.`}</Text></View>
          )}
          <View style={styles.heroFooter}>
            <Text style={styles.heroFooterLabel}>◉  LIVE MISSION FEED</Text>
            <Text style={styles.heroFooterLabel}>ALL TIMES LOCAL</Text>
          </View>
        </View>

        <NotificationSettings />

        <View style={styles.stats}>
          <View style={styles.statCard}><Text style={styles.statLabel}>UPCOMING MISSIONS</Text><Text style={styles.statValue}>{loading ? '—' : String(launches.length).padStart(2, '0')}</Text><Text style={styles.statFoot}>TRACKED MANIFEST</Text></View>
          <View style={styles.statCard}><Text style={styles.statLabel}>ACTIVE WEBCASTS</Text><Text style={styles.statValue}>{String(liveCount).padStart(2, '0')}</Text><Text style={styles.statFoot}>LIVE BROADCASTS</Text></View>
          <View style={styles.statCard}><Text style={styles.statLabel}>TRACKED STATES</Text><Text style={styles.statValue}>{TRACKED_STATES.length}</Text><Text style={styles.statFoot}>REGIONAL COVERAGE</Text></View>
        </View>

        <View style={styles.sectionHeading}>
          <View><Text style={styles.sectionEyebrow}>NATIONAL FLIGHT MANIFEST</Text><Text style={styles.sectionTitle}>UPCOMING LAUNCHES</Text></View>
          <Text style={styles.sectionCount}>{filtered.length} MISSIONS</Text>
        </View>
        <View style={styles.filters}>
          <Text style={styles.filterCaption}>SHOW LAUNCHES IN</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Filter launches: ${selectedStateName}`} onPress={() => setStatePickerOpen(true)} style={styles.stateSelect}>
            <View style={styles.stateSelectCopy}>
              <Text style={styles.stateSelectValue}>{selectedStateName}</Text>
              <Text style={styles.stateSelectCount}>{selectedStateCount} {selectedStateCount === 1 ? 'launch' : 'launches'}</Text>
            </View>
            <Text style={styles.stateSelectChevron}>⌄</Text>
          </Pressable>
        </View>

        {error ? <View style={styles.errorCard}><Text style={styles.errorTitle}>DATA LINK INTERRUPTED</Text><Text style={styles.errorBody}>{error}</Text><Pressable onPress={() => { setLoading(true); void loadLaunches(true) }}><Text style={styles.retryText}>RETRY CONNECTION ↗</Text></Pressable></View> : null}
        {!loading && !error && visibleLaunches.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>NO MISSIONS IN THIS VIEW</Text><Text style={styles.emptyBody}>No upcoming launches are currently listed for {selectedStateName}.</Text></View> : null}
        {visibleLaunches.map((launch) => <LaunchRow key={launch.id} launch={launch} onPress={() => setSelectedMission(launch)} />)}
        {filtered.length > visibleCount ? (
          <Pressable onPress={() => setVisibleCount((count) => count + 20)} style={styles.loadMore}>
            <Text style={styles.loadMoreText}>SHOW NEXT {Math.min(20, filtered.length - visibleCount)} LAUNCHES  ↓</Text>
          </Pressable>
        ) : null}

        <View style={styles.bottomNote}>
          <View style={styles.bottomRule} />
          <Text style={styles.bottomText}>LIFTOFF FLIGHT OPERATIONS</Text>
          <Text style={styles.versionText}>{lastUpdated ? `LAST SYNC ${lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · DATA BY THE SPACE DEVS` : 'UNITED STATES SPACEFLIGHT TRACKER'}</Text>
        </View>
      </ScrollView>
      {selectedMission ? <MissionDossier launch={selectedMission} onClose={() => setSelectedMission(null)} /> : null}
      <Modal visible={statePickerOpen} transparent animationType="fade" onRequestClose={() => setStatePickerOpen(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setStatePickerOpen(false)}>
          <Pressable style={styles.pickerPanel} onPress={() => undefined}>
            <View style={styles.pickerHeading}>
              <Text style={styles.pickerTitle}>SELECT REGION</Text>
              <Pressable onPress={() => setStatePickerOpen(false)} hitSlop={12}><Text style={styles.pickerClose}>✕</Text></Pressable>
            </View>
            <Text style={styles.pickerSubtitle}>Choose which launch locations appear in your feed.</Text>
            <Pressable onPress={() => chooseState('ALL')} style={styles.pickerOption}>
              <View><Text style={[styles.pickerOptionName, selectedState === 'ALL' && styles.pickerOptionActive]}>All tracked states</Text><Text style={styles.pickerOptionSub}>Florida, California, Virginia & Texas</Text></View>
              <Text style={styles.pickerOptionCount}>{launches.length}</Text>
              {selectedState === 'ALL' ? <Text style={styles.pickerCheck}>✓</Text> : null}
            </Pressable>
            {TRACKED_STATES.map((code) => (
              <Pressable key={code} onPress={() => chooseState(code)} style={styles.pickerOption}>
                <View><Text style={[styles.pickerOptionName, selectedState === code && styles.pickerOptionActive]}>{STATE_NAMES[code]}</Text><Text style={styles.pickerOptionSub}>{code} launch region</Text></View>
                <Text style={styles.pickerOptionCount}>{stateCounts[code] ?? 0}</Text>
                {selectedState === code ? <Text style={styles.pickerCheck}>✓</Text> : null}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 36 },
  topLine: { flexDirection: 'row', alignItems: 'center', marginBottom: 26 },
  brandIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  brandIconText: { color: '#07111d', fontSize: 24, fontWeight: '900', fontStyle: 'italic' },
  brandCopy: { marginLeft: 10 },
  wordmark: { color: colors.text, fontSize: 19, fontWeight: '900', letterSpacing: 2.2 },
  brandSub: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginTop: 2 },
  connection: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 7 },
  connectionDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  connectionText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  pageHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  eyebrow: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  pageTitle: { color: colors.text, fontSize: 29, fontWeight: '900', letterSpacing: -0.7, marginTop: 7 },
  titleAccent: { color: colors.accent },
  pageSubtitle: { color: colors.muted, fontSize: 12, marginTop: 5 },
  syncButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, marginLeft: 8 },
  syncText: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  hero: { backgroundColor: '#102233', borderColor: '#315064', borderWidth: 1, borderRadius: 16, padding: 20, marginBottom: 13, overflow: 'hidden' },
  heroKickerRow: { flexDirection: 'row', alignItems: 'center' },
  liveIndicator: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green, marginRight: 7 },
  heroKicker: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  heroState: { marginLeft: 'auto', color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { color: colors.text, fontSize: 25, lineHeight: 32, fontWeight: '900', marginTop: 15 },
  heroMission: { color: colors.muted, fontSize: 13, marginTop: 4 },
  tMinus: { color: colors.dim, fontSize: 9, fontWeight: '900', letterSpacing: 1.7, marginTop: 17 },
  heroCountdown: { color: colors.accent, fontSize: 30, fontWeight: '900', letterSpacing: 0.7, marginTop: 3 },
  heroRule: { height: 1, backgroundColor: colors.border, marginVertical: 15 },
  heroMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 13 },
  heroMetaItem: { flexGrow: 1, flexBasis: '28%', minWidth: 85 },
  metaLabel: { color: colors.dim, fontSize: 9, fontWeight: '900', letterSpacing: 0.7, marginBottom: 6 },
  metaValue: { color: colors.text, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  heroStatus: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 5, height: 5, borderRadius: 3, marginRight: 5 },
  dossierLink: { alignSelf: 'flex-start', marginTop: 15, paddingVertical: 8 },
  dossierLinkText: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  heroFooter: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 13, paddingTop: 11, flexDirection: 'row', justifyContent: 'space-between' },
  heroFooterLabel: { color: colors.dim, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  heroLoading: { minHeight: 115, alignItems: 'center', justifyContent: 'center', gap: 10 },
  heroLoadingText: { color: colors.muted, fontSize: 9, textAlign: 'center', lineHeight: 15 },
  heroTitleSmall: { color: colors.text, fontSize: 15, fontWeight: '900' },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 25 },
  statCard: { flex: 1, minWidth: 0, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 11, padding: 10 },
  statLabel: { color: colors.dim, fontSize: 8, fontWeight: '900', letterSpacing: 0.5, minHeight: 18 },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 4 },
  statFoot: { color: colors.dim, fontSize: 8, fontWeight: '800', letterSpacing: 0.3, marginTop: 4 },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 },
  sectionEyebrow: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginBottom: 4 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900', letterSpacing: 1 },
  sectionCount: { color: colors.dim, fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  filters: { marginBottom: 14 },
  filterCaption: { color: colors.dim, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 7 },
  stateSelect: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.panel },
  stateSelectCopy: { gap: 3 },
  stateSelectValue: { color: colors.text, fontSize: 13, fontWeight: '900' },
  stateSelectCount: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  stateSelectChevron: { color: colors.accent, fontSize: 24, fontWeight: '700', marginTop: -5 },
  pickerBackdrop: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(0,0,0,0.72)' },
  pickerPanel: { backgroundColor: colors.panelRaised, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 17 },
  pickerHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerTitle: { color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  pickerClose: { color: colors.muted, fontSize: 18, padding: 4 },
  pickerSubtitle: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 7, marginBottom: 10 },
  pickerOption: { minHeight: 56, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 9, gap: 10 },
  pickerOptionName: { color: colors.text, fontSize: 13, fontWeight: '800' },
  pickerOptionActive: { color: colors.accent },
  pickerOptionSub: { color: colors.dim, fontSize: 10, marginTop: 3 },
  pickerOptionCount: { color: colors.muted, fontSize: 12, fontWeight: '800', marginLeft: 'auto' },
  pickerCheck: { color: colors.accent, fontSize: 16, fontWeight: '900' },
  launchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 13, marginBottom: 8 },
  dateBlock: { width: 38, alignItems: 'center', borderRightWidth: 1, borderRightColor: colors.border, marginRight: 10, paddingRight: 8 },
  dateMonth: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  dateDay: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 2 },
  launchInfo: { flex: 1, minWidth: 0 },
  tags: { flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  rowStatus: { fontSize: 9, fontWeight: '900' },
  slash: { color: colors.dim, fontSize: 8, marginHorizontal: 5 },
  provider: { color: colors.muted, fontSize: 9, flexShrink: 1 },
  launchName: { color: colors.text, fontSize: 12, fontWeight: '900', lineHeight: 17, marginTop: 5 },
  launchMeta: { color: colors.muted, fontSize: 9, marginTop: 4 },
  rowCountdown: { width: 82, alignItems: 'flex-end', marginLeft: 7 },
  countdownLabel: { color: colors.dim, fontSize: 8, fontWeight: '900', letterSpacing: 0.4 },
  countdownValue: { color: colors.accent, fontSize: 9, fontWeight: '900', marginTop: 5, textAlign: 'right' },
  chevron: { color: colors.dim, fontSize: 18, marginTop: 1 },
  empty: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 11, padding: 22, alignItems: 'center' },
  emptyTitle: { color: colors.text, fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  emptyBody: { color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: 7 },
  errorCard: { backgroundColor: colors.panel, borderColor: colors.red, borderWidth: 1, borderRadius: 11, padding: 15, marginBottom: 10 },
  errorTitle: { color: colors.red, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  errorBody: { color: colors.muted, fontSize: 9, marginTop: 7, lineHeight: 14 },
  retryText: { color: colors.accent, fontSize: 8, fontWeight: '900', marginTop: 12 },
  loadMore: { borderWidth: 1, borderColor: colors.border, borderRadius: 9, alignItems: 'center', padding: 14, marginTop: 3 },
  loadMoreText: { color: colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  bottomNote: { alignItems: 'center', marginTop: 28 },
  bottomRule: { height: 1, width: '100%', backgroundColor: colors.border, marginBottom: 12 },
  bottomText: { color: colors.dim, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  versionText: { color: colors.dim, fontSize: 8, letterSpacing: 0.5, marginTop: 6, textAlign: 'center' },
  pressed: { opacity: 0.72 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  dossier: { maxHeight: '88%', backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18 },
  modalHandle: { width: 38, height: 4, borderRadius: 3, backgroundColor: colors.dim, alignSelf: 'center', marginBottom: 13 },
  dossierTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { color: colors.muted, fontSize: 27, lineHeight: 29 },
  dossierScroll: { paddingBottom: 20 },
  dossierTitle: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: '900', marginTop: 13 },
  statusLine: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  statusText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  dossierCountdown: { color: colors.accent, fontSize: 23, fontWeight: '900', marginTop: 15 },
  dossierDate: { color: colors.muted, fontSize: 9, marginTop: 5 },
  dossierRule: { height: 1, backgroundColor: colors.border, marginVertical: 15 },
  dossierSection: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 12 },
  dataPair: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  dataLabel: { color: colors.dim, fontSize: 9, fontWeight: '900', letterSpacing: 0.7, flexShrink: 0 },
  dataValue: { color: colors.muted, fontSize: 11, fontWeight: '700', flex: 1, textAlign: 'right' },
  description: { color: colors.muted, fontSize: 10, lineHeight: 17, marginTop: 4, marginBottom: 9 },
  payload: { borderLeftWidth: 2, borderLeftColor: colors.accent, paddingLeft: 10, marginBottom: 12 },
  payloadName: { color: colors.text, fontSize: 11, fontWeight: '900', marginBottom: 10 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  primaryAction: { backgroundColor: colors.accent, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 11 },
  primaryActionText: { color: '#101b28', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  secondaryAction: { borderWidth: 1, borderColor: colors.border, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 11 },
  secondaryActionText: { color: colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
})
