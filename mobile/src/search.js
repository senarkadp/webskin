// URL helpers + free Google search suggestions (no API key needed)

export const hostOf = (url) => {
  const m = (url || '').match(/^[a-z][a-z0-9+.-]*:\/\/([^/:?#]+)/i);
  return m ? m[1].toLowerCase() : '';
};

export const originOf = (url) => {
  const m = (url || '').match(/^(https?:\/\/[^/?#]+)/i);
  return m ? m[1] : url;
};

export const pathOf = (url) => {
  const m = (url || '').match(/^https?:\/\/[^/?#]+([^?#]*)/i);
  return m && m[1] ? m[1] : '/';
};

// Rough "same website" check: news.bbc.com == bbc.com
// TODO: public-suffix list so bbc.co.uk works properly.
export const baseHost = (h) => (h || '').split('.').slice(-2).join('.');

export const prettyHost = (h) => (h || '').replace(/^www\./, '');

export const faviconFor = (host) => `https://www.google.com/s2/favicons?domain=${host}&sz=128`;

export const looksLikeUrl = (text) => {
  const t = (text || '').trim();
  if (/^https?:\/\//i.test(t)) return true;
  return !/\s/.test(t) && /^[^\s/]+\.[a-z]{2,}(:\d+)?(\/.*)?$/i.test(t);
};

// Turn whatever the user typed into a URL: a website, or a Google search
export function resolveInput(text) {
  const t = (text || '').trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (looksLikeUrl(t)) return 'https://' + t;
  return 'https://www.google.com/search?q=' + encodeURIComponent(t);
}

// Search engine result pages — always shown as the normal web page
export const isSearchEngine = (url) =>
  /^https?:\/\/(www\.)?google\.[a-z.]+\/(search|webhp)/i.test(url || '') ||
  /^https?:\/\/(www\.)?bing\.com\/search/i.test(url || '') ||
  /^https?:\/\/(www\.|html\.)?duckduckgo\.com\/(\?|html)/i.test(url || '') ||
  /^https?:\/\/(www\.)?ecosia\.org\/search/i.test(url || '') ||
  /^https?:\/\/search\.yahoo\.com\//i.test(url || '');

export const isGoogleSearch = (url) => /^https?:\/\/(www\.)?google\.[^/]+\/search/i.test(url || '');

export async function fetchSuggestions(query, signal) {
  const q = (query || '').trim();
  if (!q) return [];
  try {
    const res = await fetch(
      'https://suggestqueries.google.com/complete/search?client=firefox&q=' + encodeURIComponent(q),
      { signal }
    );
    const json = await res.json();
    return Array.isArray(json[1]) ? json[1].slice(0, 6) : [];
  } catch {
    return [];
  }
}
