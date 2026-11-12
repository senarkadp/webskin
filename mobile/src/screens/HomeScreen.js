import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C, GRAD } from '../theme';
import SearchBox from '../components/SearchBox';
import { faviconFor, prettyHost } from '../search';
import { checkConnection } from '../llm';

const TRY = [
  { host: 'en.wikipedia.org', url: 'https://en.wikipedia.org', title: 'Wikipedia' },
  { host: 'www.bbc.com', url: 'https://www.bbc.com/news', title: 'BBC News' },
  { host: 'www.reddit.com', url: 'https://www.reddit.com', title: 'Reddit' },
  { host: 'news.ycombinator.com', url: 'https://news.ycombinator.com', title: 'Hacker News' },
  { host: 'github.com', url: 'https://github.com', title: 'GitHub' },
  { host: 'www.rte.ie', url: 'https://www.rte.ie', title: 'RTÉ' },
];

export default function HomeScreen({ apps, history, settings, onOpen, onRemoveApp, onSettings }) {
  const insets = useSafeAreaInsets();
  const [searching, setSearching] = useState(false);
  const [ai, setAi] = useState({ state: 'checking' });

  useEffect(() => {
    if (!settings.aiEnabled) return setAi({ state: 'off' });
    let alive = true;
    setAi({ state: 'checking' });
    checkConnection(settings.ollamaUrl)
      .then((models) => alive && setAi({ state: models.includes(settings.model) ? 'online' : 'nomodel' }))
      .catch(() => alive && setAi({ state: 'offline' }));
    return () => {
      alive = false;
    };
  }, [settings.aiEnabled, settings.ollamaUrl, settings.model]);

  const aiLabel = {
    checking: ['Connecting to Llama…', C.sub],
    online: [`${settings.model} · ready`, C.ok],
    nomodel: [`${settings.model} not installed`, C.warn],
    offline: ['AI offline · tap to set up', C.warn],
    off: ['AI off', C.dim],
  }[ai.state];

  const remove = (app) =>
    Alert.alert('Remove app?', `Remove ${app.title || prettyHost(app.host)} from your home screen?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onRemoveApp(app) },
    ]);

  const suggestions = TRY.filter((t) => !apps.some((a) => a.host === t.host));

  return (
    <View style={s.root}>
      {/* background glow */}
      <LinearGradient colors={['rgba(124,92,255,0.35)', 'rgba(34,211,238,0.10)', 'transparent']} style={s.glow} />

      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* header */}
        <View style={s.header}>
          <View style={s.brand}>
            <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.logo}>
              <Ionicons name="layers" size={18} color="#fff" />
            </LinearGradient>
            <Text style={s.brandText}>WebSkin</Text>
          </View>
          <Pressable onPress={onSettings} style={s.iconBtn} hitSlop={8}>
            <Ionicons name="settings-outline" size={20} color={C.text} />
          </Pressable>
        </View>

        {!searching && (
          <>
            <Text style={s.hero}>Any website.{'\n'}App-smooth.</Text>
            <Text style={s.heroSub}>No pop-ups, no spam redirects — with a local AI that reads pages for you.</Text>
          </>
        )}

        <View style={{ marginTop: searching ? 4 : 22 }}>
          <SearchBox onSubmit={onOpen} sites={[...apps, ...history]} onFocusChange={setSearching} />
        </View>

        <Pressable onPress={onSettings} style={s.aiPill}>
          <View style={[s.dot, { backgroundColor: aiLabel[1] }]} />
          <Ionicons name="sparkles" size={13} color={C.accent2} />
          <Text style={s.aiText}>{aiLabel[0]}</Text>
        </Pressable>

        {!searching && (
          <>
            <Text style={s.section}>Your apps</Text>
            {apps.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="add-circle-outline" size={22} color={C.sub} />
                <Text style={s.emptyText}>Open any site and tap ☆ to add it here as an app.</Text>
              </View>
            ) : (
              <View style={s.grid}>
                {apps.map((app) => (
                  <AppIcon key={app.host} app={app} onPress={() => onOpen(app.url)} onLongPress={() => remove(app)} />
                ))}
              </View>
            )}

            {history.length > 0 && (
              <>
                <Text style={s.section}>Recently visited</Text>
                {history.slice(0, 5).map((h) => (
                  <Pressable key={h.host} style={s.recent} onPress={() => onOpen(h.url)}>
                    <Image source={{ uri: faviconFor(h.host) }} style={s.recentFav} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.recentTitle} numberOfLines={1}>{h.title || prettyHost(h.host)}</Text>
                      <Text style={s.recentHost} numberOfLines={1}>{prettyHost(h.host)}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={C.dim} />
                  </Pressable>
                ))}
              </>
            )}

            {suggestions.length > 0 && (
              <>
                <Text style={s.section}>Try these</Text>
                <View style={s.chips}>
                  {suggestions.map((t) => (
                    <Pressable key={t.host} style={s.chip} onPress={() => onOpen(t.url)}>
                      <Image source={{ uri: faviconFor(t.host) }} style={s.chipFav} />
                      <Text style={s.chipText}>{t.title}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function AppIcon({ app, onPress, onLongPress }) {
  return (
    <Pressable style={({ pressed }) => [s.app, pressed && { transform: [{ scale: 0.94 }] }]} onPress={onPress} onLongPress={onLongPress}>
      <View style={s.appTile}>
        <Image source={{ uri: faviconFor(app.host) }} style={s.appFav} />
      </View>
      <Text style={s.appName} numberOfLines={1}>{app.title || prettyHost(app.host)}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  brandText: { color: C.text, fontSize: 20, fontWeight: '700', letterSpacing: 0.2 },
  iconBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  hero: { color: C.text, fontSize: 38, fontWeight: '800', lineHeight: 44, marginTop: 36, letterSpacing: -0.8 },
  heroSub: { color: C.sub, fontSize: 15, lineHeight: 22, marginTop: 10 },
  aiPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  dot: { width: 7, height: 7, borderRadius: 4 },
  aiText: { color: C.sub, fontSize: 12, fontWeight: '600' },
  section: { color: C.text, fontSize: 17, fontWeight: '700', marginTop: 30, marginBottom: 14 },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: C.border },
  emptyText: { color: C.sub, fontSize: 14, flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  app: { width: '25%', alignItems: 'center', marginBottom: 18, paddingHorizontal: 6 },
  appTile: { width: 64, height: 64, borderRadius: 20, backgroundColor: C.cardStrong, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  appFav: { width: 36, height: 36, borderRadius: 8 },
  appName: { color: C.text, fontSize: 12, marginTop: 7, maxWidth: 76 },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  recentFav: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#fff' },
  recentTitle: { color: C.text, fontSize: 15 },
  recentHost: { color: C.sub, fontSize: 12, marginTop: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  chipFav: { width: 18, height: 18, borderRadius: 4 },
  chipText: { color: C.text, fontSize: 14 },
});
