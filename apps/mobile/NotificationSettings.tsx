import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { createClient } from '@supabase/supabase-js'
import 'react-native-url-polyfill/auto'
import { SUPABASE_CONFIG } from './supabase.config'

const colors = {
  background: '#07111d',
  panel: '#0d1b2a',
  border: '#20364b',
  text: '#f2f6fa',
  muted: '#91a4b7',
  dim: '#63788d',
  accent: '#5bd1e4',
  green: '#54d6a0',
  red: '#ff7777',
}

const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

const regions = [
  { code: 'FL', name: 'Florida' },
  { code: 'CA', name: 'California' },
  { code: 'VA', name: 'Virginia' },
  { code: 'TX', name: 'Texas' },
] as const

type Preferences = {
  states: string[]
  alert_24h: boolean
  alert_1h: boolean
  alert_schedule_changes: boolean
}

const defaults: Preferences = {
  states: ['FL'],
  alert_24h: true,
  alert_1h: true,
  alert_schedule_changes: true,
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export default function NotificationSettings() {
  const [token, setToken] = useState<string | null>(null)
  const [preferences, setPreferences] = useState<Preferences>(defaults)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    const restore = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session || !mounted) return
        const { data } = await supabase
          .from('notification_devices')
          .select('expo_push_token, states, alert_24h, alert_1h, alert_schedule_changes')
          .eq('user_id', session.user.id)
          .eq('active', true)
          .maybeSingle()
        if (data && mounted) {
          setToken(data.expo_push_token)
          setPreferences({
            states: data.states ?? ['FL'],
            alert_24h: data.alert_24h,
            alert_1h: data.alert_1h,
            alert_schedule_changes: data.alert_schedule_changes,
          })
        }
      } catch {
        // Keep the default preferences visible if restoring a previous session fails.
      }
    }
    void restore()
    return () => { mounted = false }
  }, [])

  const enableAlerts = async () => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (!Device.isDevice) throw new Error('Push alerts need a physical phone or tablet.')
      if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
        throw new Error('The secure notification connection is not configured.')
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('launch-alerts', {
          name: 'Launch alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 150, 250],
          lightColor: '#5bd1e4',
        })
      }

      const permission = await Notifications.getPermissionsAsync()
      let status = permission.status
      if (status !== 'granted') {
        const requested = await Notifications.requestPermissionsAsync()
        status = requested.status
      }
      if (status !== 'granted') throw new Error('Notification permission is off. Allow notifications for Liftoff in Android Settings, then try again.')

      let { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        const { data, error: authError } = await supabase.auth.signInAnonymously()
        if (authError) {
          if (authError.message.toLowerCase().includes('anonymous')) {
            throw new Error('Anonymous sign-in is not enabled in Supabase yet. We need to switch that on once in the Supabase dashboard.')
          }
          throw authError
        }
        session = data.session
      }
      if (!session) throw new Error('Could not create a secure device session. Please try again.')

      const projectId = Constants.expoConfig?.extra?.eas?.projectId
      if (!projectId) throw new Error('The Expo project ID is missing from this build.')
      const pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data

      const { error: saveError } = await supabase.from('notification_devices').upsert({
        user_id: session.user.id,
        expo_push_token: pushToken,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        states: preferences.states,
        alert_24h: preferences.alert_24h,
        alert_1h: preferences.alert_1h,
        alert_schedule_changes: preferences.alert_schedule_changes,
        active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'expo_push_token' })
      if (saveError) throw saveError

      setToken(pushToken)
      setMessage('THIS DEVICE IS REGISTERED. YOUR ALERT PREFERENCES ARE SAVED.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to enable launch alerts.')
    } finally {
      setBusy(false)
    }
  }

  const savePreferences = async () => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || !token) throw new Error('Enable alerts on this device before saving preferences.')
      const { error: saveError } = await supabase
        .from('notification_devices')
        .update({
          states: preferences.states,
          alert_24h: preferences.alert_24h,
          alert_1h: preferences.alert_1h,
          alert_schedule_changes: preferences.alert_schedule_changes,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', session.user.id)
        .eq('expo_push_token', token)
      if (saveError) throw saveError
      setMessage('ALERT PREFERENCES SAVED.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save alert preferences.')
    } finally {
      setBusy(false)
    }
  }

  const toggleState = (code: string) => {
    setPreferences((current) => ({
      ...current,
      states: current.states.includes(code)
        ? current.states.filter((item) => item !== code)
        : [...current.states, code],
    }))
    setMessage('')
  }

  const togglePreference = (key: 'alert_24h' | 'alert_1h' | 'alert_schedule_changes') => {
    setPreferences((current) => ({ ...current, [key]: !current[key] }))
    setMessage('')
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>PERSONAL FLIGHT ALERTS</Text>
          <Text style={styles.title}>LAUNCH NOTIFICATIONS</Text>
        </View>
        <View style={[styles.statusPill, token ? styles.statusOn : styles.statusOff]}>
          <View style={[styles.statusDot, { backgroundColor: token ? colors.green : colors.dim }]} />
          <Text style={[styles.statusText, { color: token ? colors.green : colors.muted }]}>{token ? 'DEVICE LINKED' : 'NOT ENABLED'}</Text>
        </View>
      </View>

      <Text style={styles.description}>Choose where you want to watch and what you want to hear about. Alerts will arrive even when Liftoff is closed.</Text>

      <Text style={styles.sectionLabel}>TRACK THESE LAUNCH REGIONS</Text>
      <View style={styles.regionGrid}>
        {regions.map((region) => {
          const selected = preferences.states.includes(region.code)
          return (
            <Pressable key={region.code} onPress={() => toggleState(region.code)} style={[styles.region, selected && styles.regionSelected]}>
              <Text style={[styles.regionCode, selected && styles.selectedText]}>{region.code}</Text>
              <Text style={[styles.regionName, selected && styles.selectedText]}>{region.name}</Text>
              {selected ? <Text style={styles.check}>✓</Text> : null}
            </Pressable>
          )
        })}
      </View>

      <Text style={styles.sectionLabel}>NOTIFY ME ABOUT</Text>
      <PreferenceRow title="24-hour launch reminder" subtitle="The day before liftoff" value={preferences.alert_24h} onPress={() => togglePreference('alert_24h')} />
      <PreferenceRow title="1-hour launch reminder" subtitle="One hour before the scheduled time" value={preferences.alert_1h} onPress={() => togglePreference('alert_1h')} />
      <PreferenceRow title="Schedule and status changes" subtitle="Delays, new times, holds and scrubs" value={preferences.alert_schedule_changes} onPress={() => togglePreference('alert_schedule_changes')} />

      <Pressable disabled={busy || preferences.states.length === 0} onPress={token ? savePreferences : enableAlerts} style={[styles.action, (busy || preferences.states.length === 0) && styles.disabled]}>
        {busy ? <ActivityIndicator color="#07111d" /> : <Text style={styles.actionText}>{token ? 'SAVE ALERT PREFERENCES' : 'ENABLE LAUNCH ALERTS  ↗'}</Text>}
      </Pressable>
      {preferences.states.length === 0 ? <Text style={styles.hint}>Select at least one launch region.</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.footnote}>You can change these settings any time. Standard push notification and data rates may apply.</Text>
    </View>
  )
}

function PreferenceRow({ title, subtitle, value, onPress }: { title: string; subtitle: string; value: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.preferenceRow}>
      <View style={styles.preferenceCopy}>
        <Text style={styles.preferenceTitle}>{title}</Text>
        <Text style={styles.preferenceSubtitle}>{subtitle}</Text>
      </View>
      <View style={[styles.toggle, value && styles.toggleOn]}>
        <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headerCopy: { flex: 1 },
  eyebrow: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: colors.text, fontSize: 16, fontWeight: '900', letterSpacing: 0.7, marginTop: 5 },
  statusPill: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 6 },
  statusOn: { borderColor: '#285844' },
  statusOff: { borderColor: colors.border },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.4 },
  description: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 10, marginBottom: 16 },
  sectionLabel: { color: colors.dim, fontSize: 9, fontWeight: '900', letterSpacing: 0.9, marginBottom: 8, marginTop: 5 },
  regionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 15 },
  region: { flexGrow: 1, flexBasis: '45%', minHeight: 54, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, gap: 7 },
  regionSelected: { backgroundColor: '#102c3a', borderColor: colors.accent },
  regionCode: { color: colors.muted, fontSize: 11, fontWeight: '900' },
  regionName: { color: colors.muted, fontSize: 10, fontWeight: '700', flex: 1 },
  selectedText: { color: colors.accent },
  check: { color: colors.accent, fontSize: 13, fontWeight: '900' },
  preferenceRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, gap: 10 },
  preferenceCopy: { flex: 1 },
  preferenceTitle: { color: colors.text, fontSize: 11, fontWeight: '800' },
  preferenceSubtitle: { color: colors.muted, fontSize: 9, marginTop: 3 },
  toggle: { width: 38, height: 22, borderRadius: 12, backgroundColor: '#26394a', justifyContent: 'center', padding: 3 },
  toggleOn: { backgroundColor: '#246577' },
  toggleKnob: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#91a4b7' },
  toggleKnobOn: { alignSelf: 'flex-end', backgroundColor: colors.accent },
  action: { minHeight: 45, borderRadius: 8, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: 15, paddingHorizontal: 12 },
  actionText: { color: '#07111d', fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  disabled: { opacity: 0.45 },
  hint: { color: colors.muted, fontSize: 9, textAlign: 'center', marginTop: 8 },
  success: { color: colors.green, fontSize: 9, fontWeight: '800', textAlign: 'center', marginTop: 10, lineHeight: 15 },
  error: { color: colors.red, fontSize: 10, textAlign: 'center', marginTop: 10, lineHeight: 15 },
  footnote: { color: colors.dim, fontSize: 8, textAlign: 'center', lineHeight: 13, marginTop: 11 },
})
