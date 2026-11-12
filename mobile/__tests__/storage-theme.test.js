import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_SETTINGS, clearAll, loadApps, loadHistory, loadSettings, saveApps, saveHistory, saveSettings,
} from '../src/storage';
import { ICONS, guessIcon } from '../src/theme';

beforeEach(() => AsyncStorage.clear());

describe('storage', () => {
  test('settings start with defaults and merge saved values', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
    await saveSettings({ model: 'llama3.1:8b' });
    const s = await loadSettings();
    expect(s.model).toBe('llama3.1:8b');
    expect(s.shield).toBe(true); // defaults kept for fields not saved
  });

  test('apps round-trip', async () => {
    await saveApps([{ host: 'github.com', url: 'https://github.com' }]);
    expect(await loadApps()).toEqual([{ host: 'github.com', url: 'https://github.com' }]);
  });

  test('history is capped at 30 entries', async () => {
    await saveHistory(Array.from({ length: 50 }, (_, i) => ({ host: `s${i}.com` })));
    expect((await loadHistory()).length).toBe(30);
  });

  test('corrupt data falls back safely', async () => {
    await AsyncStorage.setItem('webskin.apps', '{broken');
    expect(await loadApps()).toEqual([]);
  });

  test('clearAll wipes everything', async () => {
    await saveApps([{ host: 'a.com' }]);
    await clearAll();
    expect(await loadApps()).toEqual([]);
  });
});

describe('guessIcon', () => {
  test.each([
    ['Home', '/', 'home'],
    ['Shop', '/store', 'cart'],
    ['Latest News', '/news', 'news'],
    ['My account', '/account', 'person'],
    ['Help', '/faq', 'help'],
    ['Whatever', '/zzz', 'grid'],
  ])('%s -> %s', (text, href, icon) => expect(guessIcon(text, href)).toBe(icon));

  test('every guessed icon exists in the icon set', () => {
    ['home', 'cart', 'news', 'person', 'help', 'grid'].forEach((k) => expect(ICONS[k]).toBeTruthy());
  });
});
