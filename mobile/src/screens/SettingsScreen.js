import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../theme';
import { checkConnection } from '../llm';

export default function SettingsScreen({ settings, updateSettings, onBack, onClearData }) {
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState(settings.ollamaUrl);
  const [model, setModel] = useState(settings.model);
  const [test, setTest] = useState({ status: 'idle' });

  const runTest = async () => {
    updateSettings({ ollamaUrl: url.trim(), model: model.trim() });
    setTest({ status: 'loading' });
    try {
      const models = await checkConnection(url.trim());
      setTest({ status: 'ok', models });
    } catch (e) {
      setTest({ status: 'error', error: e.message || 'Could not connect' });
    }
  };

  const pickModel = (m) => {
    setModel(m);
    updateSettings({ model: m });
  };

  const siteCount = Object.keys(settings.siteModes || {}).length;

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onBack} style={s.back} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <Text style={s.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        {/* ---------- AI ---------- */}
        <Text style={s.section}>Local AI (Llama via Ollama)</Text>
        <View style={s.card}>
          <ToggleRow icon="sparkles" label="AI features" sub="Summaries, safety checks, smart tabs" value={settings.aiEnabled} onChange={(v) => updateSettings({ aiEnabled: v })} />
          <Divider />
          <ToggleRow icon="flash-outline" label="Analyse pages automatically" sub="In App view, as you browse" value={settings.autoInsights} onChange={(v) => updateSettings({ autoInsights: v })} />
        </View>

        <View style={[s.card, { marginTop: 12, padding: 14 }]}>
          <Text style={s.label}>Ollama address (your laptop)</Text>
          <TextInput
            style={s.input}
            value={url}
            onChangeText={setUrl}
            onEndEditing={() => updateSettings({ ollamaUrl: url.trim() })}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="http://192.168.1.10:11434"
            placeholderTextColor={C.dim}
          />
          <Text style={[s.label, { marginTop: 14 }]}>Model</Text>
          <TextInput
            style={s.input}
            value={model}
            onChangeText={setModel}
            onEndEditing={() => updateSettings({ model: model.trim() })}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="llama3.2:3b"
            placeholderTextColor={C.dim}
          />

          <Pressable style={s.testBtn} onPress={runTest}>
            {test.status === 'loading' ? <ActivityIndicator color="#fff" /> : <Text style={s.testText}>Test connection</Text>}
          </Pressable>

          {test.status === 'ok' && (
            <View style={{ marginTop: 12 }}>
              <Text style={[s.status, { color: C.ok }]}>✓ Connected. Tap a model to use it:</Text>
              <View style={s.models}>
                {test.models.map((m) => (
                  <Pressable key={m} onPress={() => pickModel(m)} style={[s.modelChip, m === model && s.modelChipOn]}>
                    <Text style={[s.modelText, m === model && { color: '#fff' }]}>{m}</Text>
                  </Pressable>
                ))}
                {test.models.length === 0 && <Text style={s.help}>No models yet — run: ollama pull llama3.2:3b</Text>}
              </View>
            </View>
          )}
          {test.status === 'error' && <Text style={[s.status, { color: C.danger }]}>✕ {test.error}</Text>}
        </View>

        <View style={s.howto}>
          <Text style={s.howtoTitle}>Set up on your Windows laptop (free)</Text>
          <Text style={s.help}>1. Install Ollama from ollama.com</Text>
          <Text style={s.help}>2. In a terminal: ollama pull llama3.2:3b</Text>
          <Text style={s.help}>3. Let your phone reach it — in PowerShell:{'\n'}   setx OLLAMA_HOST 0.0.0.0  then restart Ollama</Text>
          <Text style={s.help}>4. Find your laptop's IP: ipconfig → IPv4 Address{'\n'}   Enter http://THAT-IP:11434 above</Text>
          <Text style={s.help}>5. Phone and laptop must be on the same Wi-Fi. Allow Ollama through Windows Firewall if asked.</Text>
        </View>

        {/* ---------- Browsing ---------- */}
        <Text style={s.section}>Browsing</Text>
        <View style={s.card}>
          <View style={s.row}>
            <Ionicons name="phone-portrait-outline" size={18} color={C.accent2} />
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>Default view</Text>
              <Text style={s.rowSub}>How sites open the first time</Text>
            </View>
            <View style={s.seg}>
              {['app', 'web'].map((m) => (
                <Pressable key={m} onPress={() => updateSettings({ defaultMode: m })} style={[s.segOpt, settings.defaultMode === m && s.segOn]}>
                  <Text style={[s.segText, settings.defaultMode === m && { color: '#fff' }]}>{m === 'app' ? 'App' : 'Web'}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Divider />
          <ToggleRow icon="shield-checkmark-outline" label="Stay-here shield" sub="Block pop-ups and spam redirects" value={settings.shield} onChange={(v) => updateSettings({ shield: v })} />
          <Divider />
          <Pressable style={s.row} onPress={() => updateSettings({ siteModes: {} })} disabled={!siteCount}>
            <Ionicons name="refresh-outline" size={18} color={C.accent2} />
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>Reset per-site views</Text>
              <Text style={s.rowSub}>{siteCount ? `${siteCount} site${siteCount > 1 ? 's' : ''} remembered` : 'None saved'}</Text>
            </View>
          </Pressable>
        </View>

        <Pressable
          style={s.danger}
          onPress={() =>
            Alert.alert('Clear all data?', 'This removes your apps, history and settings.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Clear', style: 'destructive', onPress: onClearData },
            ])
          }
        >
          <Text style={s.dangerText}>Clear all data</Text>
        </Pressable>

        <Text style={s.footer}>WebSkin v0.2 · everything stays on your devices</Text>
      </ScrollView>
    </View>
  );
}

function ToggleRow({ icon, label, sub, value, onChange }) {
  return (
    <View style={s.row}>
      <Ionicons name={icon} size={18} color={C.accent2} />
      <View style={{ flex: 1 }}>
        <Text style={s.rowLabel}>{label}</Text>
        {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: C.accent, false: '#333' }} thumbColor="#fff" />
    </View>
  );
}

const Divider = () => <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginLeft: 44 }} />;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 10 },
  back: { width: 38, height: 38, borderRadius: 13, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  title: { color: C.text, fontSize: 22, fontWeight: '800' },
  section: { color: C.sub, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 18, marginBottom: 10 },
  card: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  rowLabel: { color: C.text, fontSize: 15, fontWeight: '600' },
  rowSub: { color: C.sub, fontSize: 12, marginTop: 2 },
  label: { color: C.sub, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: { color: C.text, fontSize: 15, height: 46, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: C.border },
  testBtn: { marginTop: 14, height: 46, borderRadius: 14, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  testText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  status: { fontSize: 13, fontWeight: '600', marginTop: 10 },
  models: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  modelChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  modelChipOn: { backgroundColor: C.accent, borderColor: C.accent },
  modelText: { color: C.sub, fontSize: 13 },
  howto: { marginTop: 12, padding: 14, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: C.border },
  howtoTitle: { color: C.text, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  help: { color: C.sub, fontSize: 13, lineHeight: 19, marginBottom: 4 },
  seg: { flexDirection: 'row', borderRadius: 10, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  segOpt: { paddingHorizontal: 12, paddingVertical: 6 },
  segOn: { backgroundColor: C.accent },
  segText: { color: C.sub, fontSize: 13, fontWeight: '700' },
  danger: { marginTop: 24, height: 48, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,92,122,0.4)', alignItems: 'center', justifyContent: 'center' },
  dangerText: { color: C.danger, fontWeight: '700' },
  footer: { color: C.dim, fontSize: 12, textAlign: 'center', marginTop: 20 },
});
