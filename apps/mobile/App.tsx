import { StatusBar } from 'expo-status-bar'
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { DEFAULT_STATE, STATE_NAMES, TRACKED_STATES } from '../../packages/core/src/coverage'

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
}

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topLine}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>L</Text>
          </View>
          <View style={styles.brandCopy}>
            <Text style={styles.wordmark}>LIFTOFF</Text>
            <Text style={styles.eyebrow}>MISSION CONTROL</Text>
          </View>
          <View style={styles.onlinePill}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>SYSTEM READY</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.kicker}>UNITED STATES SPACEFLIGHT</Text>
          <Text style={styles.heroTitle}>Eyes on the{ '\n' }next launch.</Text>
          <Text style={styles.heroBody}>
            Your regional launch picture, organized by state and built for the countdown.
          </Text>
          <View style={styles.rule} />
          <View style={styles.heroFooter}>
            <View>
              <Text style={styles.metaLabel}>ACTIVE COVERAGE</Text>
              <Text style={styles.metaValue}>4 STATES</Text>
            </View>
            <View style={styles.heroFooterRight}>
              <Text style={styles.metaLabel}>DEFAULT REGION</Text>
              <Text style={styles.metaValue}>FLORIDA</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>TRACKED REGIONS</Text>
          <Text style={styles.sectionHint}>SELECTED COVERAGE</Text>
        </View>
        <View style={styles.stateGrid}>
          {TRACKED_STATES.map((code) => {
            const selected = code === DEFAULT_STATE
            return (
              <View key={code} style={[styles.stateCard, selected && styles.stateCardSelected]}>
                <Text style={[styles.stateCode, selected && styles.stateCodeSelected]}>{code}</Text>
                <Text style={styles.stateName}>{STATE_NAMES[code]}</Text>
                {selected ? <Text style={styles.defaultLabel}>DEFAULT REGION</Text> : null}
              </View>
            )
          })}
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>MISSION FEED</Text>
          <Text style={styles.sectionHint}>COMING ONLINE</Text>
        </View>
        <View style={styles.feedCard}>
          <View style={styles.feedIcon}>
            <Text style={styles.feedIconText}>↗</Text>
          </View>
          <View style={styles.feedCopy}>
            <Text style={styles.feedTitle}>Launch data connection</Text>
            <Text style={styles.feedBody}>
              The mobile interface is in place. Next we’ll connect the live launch feed and bring over the website’s mission details.
            </Text>
          </View>
        </View>

        <View style={styles.bottomNote}>
          <View style={styles.bottomRule} />
          <Text style={styles.bottomText}>LIFTOFF · REGIONAL SPACEFLIGHT TRACKER</Text>
          <Text style={styles.versionText}>MOBILE FOUNDATION 0.1.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? 0 : 0,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: {
    color: '#101b28',
    fontSize: 25,
    fontWeight: '900',
    fontStyle: 'italic',
  },
  brandCopy: {
    marginLeft: 11,
  },
  wordmark: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2.4,
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 2,
  },
  onlinePill: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.green,
    marginRight: 6,
  },
  onlineText: {
    color: colors.green,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },
  hero: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    marginBottom: 28,
  },
  kicker: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 39,
    lineHeight: 43,
    fontWeight: '900',
    letterSpacing: -1.2,
    marginTop: 14,
  },
  heroBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 12,
    maxWidth: 290,
  },
  rule: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: 22,
    marginBottom: 17,
  },
  heroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroFooterRight: {
    alignItems: 'flex-end',
  },
  metaLabel: {
    color: colors.dim,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  metaValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 5,
  },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.7,
  },
  sectionHint: {
    color: colors.dim,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },
  stateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  stateCard: {
    width: '48%',
    minHeight: 91,
    flexGrow: 1,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  stateCardSelected: {
    borderColor: colors.accent,
    backgroundColor: '#1b2631',
  },
  stateCode: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
  },
  stateCodeSelected: {
    color: colors.accent,
  },
  stateName: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  defaultLabel: {
    color: colors.accent,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 8,
  },
  feedCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 15,
  },
  feedIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.panelRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedIconText: {
    color: colors.accent,
    fontSize: 20,
    fontWeight: '800',
  },
  feedCopy: {
    flex: 1,
    marginLeft: 12,
  },
  feedTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  feedBody: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },
  bottomNote: {
    alignItems: 'center',
    marginTop: 34,
  },
  bottomRule: {
    height: 1,
    width: '100%',
    backgroundColor: colors.border,
    marginBottom: 14,
  },
  bottomText: {
    color: colors.dim,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  versionText: {
    color: colors.dim,
    fontSize: 7,
    letterSpacing: 1,
    marginTop: 6,
  },
})
