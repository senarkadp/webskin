import AsyncStorage from '@react-native-async-storage/async-storage';

const K_APPS = 'webskin.apps';
const K_SETTINGS = 'webskin.settings';
const K_HISTORY = 'webskin.history';

export const DEFAULT_SETTINGS = {
  // AI (Ollama running on your laptop — free, local)
  aiEnabled: true,
  autoInsights: true,             // analyse each page automatically in App view
  ollamaUrl: 'http://192.168.1.10:11434',
  model: 'llama3.2:3b',
  // Browsing
  defaultMode: 'app',             // 'app' | 'web'
  shield: true,                   // block pop-ups and surprise redirects
  siteModes: {},                  // per-site override: { 'bbc.com': 'web' }
};

async function get(key, fallback) {
  try {
    const v = await AsyncStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

async function set(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage is best-effort
  }
}

export const loadApps = () => get(K_APPS, []);
export const saveApps = (apps) => set(K_APPS, apps);

export const loadSettings = async () => ({ ...DEFAULT_SETTINGS, ...(await get(K_SETTINGS, {})) });
export const saveSettings = (s) => set(K_SETTINGS, s);

export const loadHistory = () => get(K_HISTORY, []);
export const saveHistory = (h) => set(K_HISTORY, h.slice(0, 30));

export const clearAll = () => AsyncStorage.multiRemove([K_APPS, K_SETTINGS, K_HISTORY]);
