import {
  isSearchEngine, baseHost, faviconFor, fetchSuggestions, hostOf, isGoogleSearch, looksLikeUrl, originOf, pathOf, prettyHost, resolveInput,
} from '../src/search';

describe('resolveInput', () => {
  test('bare domain opens the site over https', () => {
    expect(resolveInput('bbc.com')).toBe('https://bbc.com');
    expect(resolveInput('mtu.ie/courses')).toBe('https://mtu.ie/courses');
  });
  test('full URLs are kept as-is', () => {
    expect(resolveInput('http://example.com/a?b=1')).toBe('http://example.com/a?b=1');
  });
  test('words become a Google search', () => {
    expect(resolveInput('best pizza cork')).toBe('https://www.google.com/search?q=best%20pizza%20cork');
    expect(resolveInput('weather')).toBe('https://www.google.com/search?q=weather');
  });
  test('trims whitespace and ignores empty input', () => {
    expect(resolveInput('  github.com  ')).toBe('https://github.com');
    expect(resolveInput('   ')).toBeNull();
    expect(resolveInput(undefined)).toBeNull();
  });
});

describe('looksLikeUrl', () => {
  test.each([
    ['google.com', true],
    ['en.wikipedia.org/wiki/Cork', true],
    ['localhost:8081', false],
    ['two words.com', false],
    ['hello', false],
    ['https://anything', true],
  ])('%s -> %s', (input, expected) => expect(looksLikeUrl(input)).toBe(expected));
});

describe('URL helpers', () => {
  test('hostOf lowercases and strips port/path', () => {
    expect(hostOf('https://WWW.BBC.com:443/news?x=1')).toBe('www.bbc.com');
    expect(hostOf('not a url')).toBe('');
    expect(hostOf(undefined)).toBe('');
  });
  test('pathOf returns / for bare origins', () => {
    expect(pathOf('https://a.com')).toBe('/');
    expect(pathOf('https://a.com/b/c?x=1#y')).toBe('/b/c');
  });
  test('originOf', () => expect(originOf('https://a.com/b?c')).toBe('https://a.com'));
  test('baseHost treats subdomains as the same site', () => {
    expect(baseHost('news.bbc.com')).toBe(baseHost('www.bbc.com'));
    expect(baseHost('evil.com')).not.toBe(baseHost('bbc.com'));
  });
  test('prettyHost strips www', () => expect(prettyHost('www.rte.ie')).toBe('rte.ie'));
  test('faviconFor builds a favicon URL', () => expect(faviconFor('github.com')).toContain('domain=github.com'));
  test('isGoogleSearch', () => {
    expect(isGoogleSearch('https://www.google.com/search?q=x')).toBe(true);
    expect(isGoogleSearch('https://www.google.ie/search?q=x')).toBe(true);
    expect(isGoogleSearch('https://www.google.com/maps')).toBe(false);
  });
});

describe('fetchSuggestions', () => {
  afterEach(() => jest.restoreAllMocks());

  test('returns up to 6 Google suggestions', async () => {
    global.fetch = jest.fn().mockResolvedValue({ json: async () => ['piz', ['pizza', 'pizza hut', 'pizza near me', 'a', 'b', 'c', 'd']] });
    const out = await fetchSuggestions('piz');
    expect(out).toEqual(['pizza', 'pizza hut', 'pizza near me', 'a', 'b', 'c']);
    expect(global.fetch.mock.calls[0][0]).toContain('suggestqueries.google.com');
    expect(global.fetch.mock.calls[0][0]).toContain('q=piz');
  });
  test('empty query makes no request', async () => {
    global.fetch = jest.fn();
    expect(await fetchSuggestions('  ')).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });
  test('network failure returns an empty list instead of crashing', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    expect(await fetchSuggestions('x')).toEqual([]);
  });
});

describe('isSearchEngine', () => {
  test.each([
    ['https://www.google.com/search?q=coffee', true],
    ['https://www.google.ie/search?q=coffee', true],
    ['https://www.bing.com/search?q=x', true],
    ['https://duckduckgo.com/?q=x', true],
    ['https://www.google.com/maps', false],
    ['https://www.bbc.com/news', false],
  ])('%s -> %s', (url, expected) => expect(isSearchEngine(url)).toBe(expected));
});
