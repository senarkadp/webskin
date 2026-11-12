// WebSkin design tokens — dark, glassy, neon-accented
export const C = {
  bg: '#07080F',
  bg2: '#0D1020',
  card: 'rgba(255,255,255,0.06)',
  cardStrong: 'rgba(255,255,255,0.10)',
  border: 'rgba(255,255,255,0.10)',
  text: '#F4F6FF',
  sub: '#9AA3BF',
  dim: '#5C6480',
  accent: '#7C5CFF',
  accent2: '#22D3EE',
  ok: '#3DDC97',
  warn: '#FFB547',
  danger: '#FF5C7A',
  glass: 'rgba(13,16,32,0.92)',
};

export const GRAD = ['#7C5CFF', '#22D3EE'];

// Icon keys the AI may choose from -> Ionicons names
export const ICONS = {
  home: 'home-outline',
  search: 'search-outline',
  news: 'newspaper-outline',
  list: 'list-outline',
  person: 'person-outline',
  cart: 'cart-outline',
  info: 'information-circle-outline',
  mail: 'mail-outline',
  book: 'book-outline',
  star: 'star-outline',
  settings: 'settings-outline',
  grid: 'grid-outline',
  chat: 'chatbubbles-outline',
  play: 'play-circle-outline',
  calendar: 'calendar-outline',
  help: 'help-circle-outline',
};

// Guess a tab icon from its label/URL when the AI hasn't picked one
export function guessIcon(text = '', href = '') {
  const s = (text + ' ' + href).toLowerCase();
  const rules = [
    [/home|^\/$|start/, 'home'],
    [/search|find/, 'search'],
    [/news|blog|article|stories|latest/, 'news'],
    [/shop|store|cart|basket|buy|product|deals/, 'cart'],
    [/account|profile|login|sign|my /, 'person'],
    [/about|info/, 'info'],
    [/contact|mail/, 'mail'],
    [/docs|learn|course|guide|wiki|library/, 'book'],
    [/video|watch|music|podcast|play|tv/, 'play'],
    [/event|calendar|schedule|timetable/, 'calendar'],
    [/help|support|faq/, 'help'],
    [/forum|community|chat|discuss/, 'chat'],
    [/settings|preferences/, 'settings'],
  ];
  for (const [re, key] of rules) if (re.test(s)) return key;
  return 'grid';
}
