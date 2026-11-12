import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './src/screens/HomeScreen';
import BrowserScreen from './src/screens/BrowserScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import {
  DEFAULT_SETTINGS, clearAll, loadApps, loadHistory, loadSettings, saveApps, saveHistory, saveSettings,
} from './src/storage';
import { resolveInput } from './src/search';
import { C } from './src/theme';

export default function App() {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [apps, setApps] = useState([]);
  const [history, setHistory] = useState([]);
  const [screen, setScreen] = useState({ name: 'home' });

  useEffect(() => {
    (async () => {
      const [s, a, h] = await Promise.all([loadSettings(), loadApps(), loadHistory()]);
      setSettings(s);
      setApps(a);
      setHistory(h);
      setReady(true);
    })();
  }, []);

  const updateSettings = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const toggleSave = useCallback((site) => {
    setApps((prev) => {
      const next = prev.some((a) => a.host === site.host) ? prev.filter((a) => a.host !== site.host) : [...prev, site];
      saveApps(next);
      return next;
    });
  }, []);

  const visit = useCallback((v) => {
    if (!v.host) return;
    setHistory((prev) => {
      if (prev[0]?.host === v.host && prev[0]?.title === v.title) return prev;
      const next = [v, ...prev.filter((x) => x.host !== v.host)].slice(0, 30);
      saveHistory(next);
      return next;
    });
  }, []);

  const open = useCallback((input) => {
    const url = resolveInput(input);
    if (url) setScreen({ name: 'browser', url, key: Date.now() });
  }, []);

  const goHome = useCallback(() => setScreen({ name: 'home' }), []);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.accent2} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {screen.name === 'home' && (
        <HomeScreen
          apps={apps}
          history={history}
          settings={settings}
          onOpen={open}
          onRemoveApp={toggleSave}
          onSettings={() => setScreen({ name: 'settings', from: 'home' })}
        />
      )}
      {screen.name === 'browser' && (
        <BrowserScreen
          key={screen.key}
          startUrl={screen.url}
          settings={settings}
          updateSettings={updateSettings}
          apps={apps}
          sites={[...apps, ...history]}
          onToggleSave={toggleSave}
          onHome={goHome}
          onVisit={visit}
        />
      )}
      {screen.name === 'settings' && (
        <SettingsScreen
          settings={settings}
          updateSettings={updateSettings}
          onBack={goHome}
          onClearData={async () => {
            await clearAll();
            setSettings(DEFAULT_SETTINGS);
            setApps([]);
            setHistory([]);
            goHome();
          }}
        />
      )}
    </SafeAreaProvider>
  );
}
