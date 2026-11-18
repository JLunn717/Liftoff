import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
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
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).toUpperCase()
}

function statusColor(status: string): string {
  const value = status.toLowerCase()
  if (value.includes('success') || value.includes('go')) return colors.green
  if (value.includes('fail') || value.includes('scrub') || value.includes('hold')) return colors.red
  return colors.accent
}

function LaunchCard({ launch }: { launch: Launch }) {
  const status = launch.status?.name ?? 'Status unknown'
  const openDetails = async () => {
    const url = launch.webcastUrl ?? launch.infoUrls[0]?.url
    if (url) await Linking.openURL(url)
  }

  return (
    <View style={styles.launchCard}>
      <View style={styles.launchTop}>
        <Text style={styles.launchState}>{launch.stateCode ?? 'USA'} · {launch.launchLocationName ?? 'United States'}</Text>
        <View style={styles.statusPill}>
          <View style={[styles.statusDot, { backgroundColor: statusColor(status) }]} />
          <Text style={[styles.statusText, { color: statusColor(status) }]}>{status.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.launchName}>{launch.name}</Text>
      <Text style={styles.launchDate}>{formatLaunchDate(launch.net ?? launch.windowStart)}</Text>
      <View style={styles.launchDivider} />
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>ROCKET</Text>
        <Text style={styles.detailValue}>{launch.vehicleName ?? 'Details pending'}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>OPERATOR</Text>
        <Text style={styles.detailValue}>{launch.providerName ?? 'Details pending'}</Text>
      </View>
      {launch.missionName ? (
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>MISSION</Text>
          <Text style={styles.detailValue}>{launch.missionName}</Text>
        </View>
      ) : null}
      {launch.launchSiteName ? (
        <Text style={styles.launchSite}>{launch.launchSiteName}</Text>
      ) : null}
      {launch.webcastUrl || launch.infoUrls.length ? (
        <Pressable
          accessibilityRole="link"
          onPress={openDetails}
          style={({ pressed }) => [styles.detailsButton, pressed && styles.pressed]}
        >
          <Text style={styles.detailsButtonText}>
            {launch.webcastUrl ? 'OPEN MISSION WEBCAST ↗' : 'MISSION INFORMATION ↗'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

export default function App() {
  const [launches, setLaunches] = useState<Launch[]>([])
  const [selectedState, setSelectedState] = useState<string>(DEFAULT_STATE)
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
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load launch data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadLaunches()
  }, [loadLaunches])

  const stateLaunches = useMemo(
    () => launches.filter((launch) => launch.stateCode === selectedState),
    [launches, selectedState],
  )
  const visibleLaunches = stateLaunches.slice(0, visibleCount)
  const stateCounts = useMemo(
    () => Object.fromEntries(TRACKED_STATES.map((code) => [
      code,
      launches.filter((launch) => launch.stateCode === code).length,
    ])) as Record<(typeof TRACKED_STATES)[number], number>,
    [launches],
  )

  const refresh = () => {
    setRefreshing(true)
    void loadLaunches(true)
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.panel}
          />
        }
      >
        <View style={styles.topLine}>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>L</Text></View>
          <View style={styles.brandCopy}>
            <Text style={styles.wordmark}>LIFTOFF</Text>
            <Text style={styles.eyebrow}>MISSION CONTROL</Text>
          </View>
          <View style={styles.onlinePill}>
            <View style={[styles.onlineDot, { backgroundColor: error ? colors.red : colors.green }]} />
            <Text style={[styles.onlineText, { color: error ? colors.red : colors.green }]}>
              {error ? 'DATA ISSUE' : loading ? 'CONNECTING' : 'LIVE DATA'}
            </Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.kicker}>UNITED STATES SPACEFLIGHT</Text>
          <Text style={styles.heroTitle}>Eyes on the{'\n'}next launch.</Text>
          <Text style={styles.heroBody}>
            Your regional launch picture, organized by state and built for the countdown.
          </Text>
          <View style={styles.rule} />
          <View style={styles.heroFooter}>
            <View>
              <Text style={styles.metaLabel}>UPCOMING MISSIONS</Text>
              <Text style={styles.metaValue}>{launches.length.toString().padStart(2, '0')} TRACKED</Text>
            </View>
            <View style={styles.heroFooterRight}>
              <Text style={styles.metaLabel}>DEFAULT REGION</Text>
              <Text style={styles.metaValue}>FLORIDA</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>TRACKED REGIONS</Text>
          <Text style={styles.sectionHint}>TAP TO FILTER</Text>
        </View>
        <View style={styles.stateGrid}>
          {TRACKED_STATES.map((code) => {
            const selected = code === selectedState
            return (
              <Pressable
                key={code}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => { setSelectedState(code); setVisibleCount(5) }}
                style={({ pressed }) => [
                  styles.stateCard,
                  selected && styles.stateCardSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.stateCardTop}>
                  <Text style={[styles.stateCode, selected && styles.stateCodeSelected]}>{code}</Text>
                  <Text style={[styles.stateCount, selected && styles.stateCodeSelected]}>
                    {stateCounts[code] ?? 0}
                  </Text>
                </View>
                <Text style={styles.stateName}>{STATE_NAMES[code]}</Text>
                {selected ? <Text style={styles.defaultLabel}>SELECTED REGION</Text> : null}
              </Pressable>
            )
          })}
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>MISSION FEED</Text>
          <Text style={styles.sectionHint}>{STATE_NAMES[selectedState].toUpperCase()}</Text>
        </View>

        {loading ? (
          <View style={styles.messageCard}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.messageTitle}>Establishing data link</Text>
            <Text style={styles.messageBody}>Pulling upcoming missions for the tracked regions.</Text>
          </View>
        ) : error ? (
          <View style={styles.messageCard}>
            <Text style={styles.errorTitle}>DATA LINK INTERRUPTED</Text>
            <Text style={styles.messageBody}>{error}</Text>
            <Pressable onPress={() => { setLoading(true); void loadLaunches(true) }} style={styles.retryButton}>
              <Text style={styles.retryText}>RETRY CONNECTION</Text>
            </Pressable>
          </View>
        ) : visibleLaunches.length ? (
          <>
            {visibleLaunches.map((launch) => <LaunchCard key={launch.id} launch={launch} />)}
            {stateLaunches.length > visibleCount ? (
              <Pressable
                onPress={() => setVisibleCount((count) => count + 20)}
                style={({ pressed }) => [styles.loadMore, pressed && styles.pressed]}
              >
                <Text style={styles.loadMoreText}>LOAD NEXT 20 MISSIONS ↓</Text>
                <Text style={styles.loadMoreHint}>{stateLaunches.length - visibleCount} REMAINING</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <View style={styles.messageCard}>
            <Text style={styles.messageTitle}>No upcoming missions listed</Text>
            <Text style={styles.messageBody}>
              There are currently no upcoming launches in {STATE_NAMES[selectedState]} in the data feed. Pull down to refresh.
            </Text>
          </View>
        )}

        <View style={styles.bottomNote}>
          <View style={styles.bottomRule} />
          <Text style={styles.bottomText}>LIFTOFF · REGIONAL SPACEFLIGHT TRACKER</Text>
          <Text style={styles.versionText}>
            {lastUpdated ? `DATA CHECKED ${lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'MOBILE FOUNDATION 0.2.0'}
          </Text>
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
  sectionHint: { color: colors.dim, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  stateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  stateCard: { width: '48%', minHeight: 91, flexGrow: 1, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 14 },
  stateCardSelected: { borderColor: colors.accent, backgroundColor: '#1b2631' },
  stateCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stateCode: { color: colors.text, fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  stateCodeSelected: { color: colors.accent },
  stateCount: { color: colors.muted, fontSize: 16, fontWeight: '800' },
  stateName: { color: colors.muted, fontSize: 11, marginTop: 2 },
  defaultLabel: { color: colors.accent, fontSize: 7, fontWeight: '900', letterSpacing: 1, marginTop: 8 },
  launchCard: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12 },
  launchTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  launchState: { color: colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, backgroundColor: colors.panelRaised, paddingHorizontal: 8, paddingVertical: 5 },
  statusDot: { width: 5, height: 5, borderRadius: 3, marginRight: 5 },
  statusText: { fontSize: 7, fontWeight: '900', letterSpacing: 0.7 },
  launchName: { color: colors.text, fontSize: 17, fontWeight: '900', lineHeight: 23, marginTop: 12 },
  launchDate: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.6, marginTop: 7 },
  launchDivider: { height: 1, backgroundColor: colors.border, marginVertical: 13 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  detailLabel: { color: colors.dim, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  detailValue: { color: colors.muted, fontSize: 9, fontWeight: '700', flex: 1, textAlign: 'right' },
  launchSite: { color: colors.dim, fontSize: 9, marginTop: 3 },
  detailsButton: { alignSelf: 'flex-start', marginTop: 13, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 9 },
  detailsButtonText: { color: colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
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
