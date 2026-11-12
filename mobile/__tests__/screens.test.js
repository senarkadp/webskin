import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import App from '../App';
import BrowserScreen from '../src/screens/BrowserScreen';
import SettingsScreen from '../src/screens/SettingsScreen';
import { DEFAULT_SETTINGS } from '../src/storage';

// Ollama + Google suggestions are faked so tests never touch the network
function mockNetwork({ models = ['llama3.2:3b'], suggestions = ['pizza cork', 'pizza near me'], insight } = {}) {
  global.fetch = jest.fn(async (url) => {
    if (url.includes('/api/tags')) return { ok: true, json: async () => ({ models: models.map((name) => ({ name })) }) };
    if (url.includes('suggestqueries')) return { json: async () => ['q', suggestions] };
    if (url.includes('/api/chat'))
      return {
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify(
              insight || { summary: ['A test page'], verdict: 'safe', reason: 'Normal site', tabs: [] }
            ),
          },
        }),
      };
    throw new Error('unexpected fetch ' + url);
  });
}

beforeEach(() => {
  global.__web = { props: null, injected: [], ref: null };
  mockNetwork();
});

// ---------------- Home ----------------
describe('Home screen', () => {
  test('shows the brand, search bar and AI status', async () => {
    await render(<App />);
    expect(await screen.findByText('WebSkin')).toBeTruthy();
    expect(screen.getByPlaceholderText('Search Google or type a website')).toBeTruthy();
    expect(await screen.findByText('llama3.2:3b · ready')).toBeTruthy();
  });

  test('AI status says offline when Ollama is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    await render(<App />);
    expect(await screen.findByText('AI offline · tap to set up')).toBeTruthy();
  });

  test('typing shows Google suggestions, tapping one opens a Google search', async () => {
    await render(<App />);
    const input = await screen.findByPlaceholderText('Search Google or type a website');
    await fireEvent(input, 'focus');
    await fireEvent.changeText(input, 'pizza');
    expect(await screen.findByText('pizza cork')).toBeTruthy();
    await fireEvent.press(screen.getByText('pizza cork'));
    await waitFor(() => expect(global.__web.props).not.toBeNull());
    expect(global.__web.props.source.uri).toBe('https://www.google.com/search?q=pizza%20cork');
  });

  test('typing a website and pressing Go opens that site', async () => {
    await render(<App />);
    const input = await screen.findByPlaceholderText('Search Google or type a website');
    await fireEvent.changeText(input, 'bbc.com');
    await fireEvent(input, 'submitEditing');
    await waitFor(() => expect(global.__web.props?.source.uri).toBe('https://bbc.com'));
  });

  test('"Try these" opens a suggested site', async () => {
    await render(<App />);
    await fireEvent.press(await screen.findByText('Wikipedia'));
    await waitFor(() => expect(global.__web.props?.source.uri).toBe('https://en.wikipedia.org'));
  });
});

// ---------------- Browser ----------------
async function renderBrowser({ settings, ...overrides } = {}) {
  const props = {
    startUrl: 'https://shop.example.com/',
    settings: { ...DEFAULT_SETTINGS, autoInsights: false, ...settings },
    updateSettings: jest.fn(),
    apps: [],
    sites: [],
    onToggleSave: jest.fn(),
    onHome: jest.fn(),
    onVisit: jest.fn(),
    ...overrides,
  };
  await render(<BrowserScreen {...props} />);
  return props;
}

const PAGE = {
  url: 'https://shop.example.com/',
  host: 'shop.example.com',
  title: 'Test Shop',
  description: '',
  headings: ['Welcome'],
  text: 'Hello',
  links: [
    { text: 'Products', href: 'https://shop.example.com/products' },
    { text: 'Blog', href: 'https://shop.example.com/blog' },
    { text: 'Account', href: 'https://shop.example.com/account' },
  ],
};

async function sendPage(page = PAGE) {
  await act(() => {
    global.__web.props.onNavigationStateChange({ url: page.url, title: page.title, canGoBack: false, canGoForward: false });
  });
  await act(() => {
    global.__web.props.onMessage({ nativeEvent: { data: JSON.stringify({ type: 'page', data: page }) } });
  });
}

describe('Browser: App / Web toggle', () => {
  test('starts in App view and injects the skin script', async () => {
    await renderBrowser();
    expect(global.__web.props.injectedJavaScript).toContain("mode: 'app'");
  });

  test('duplicate menu labels do not create duplicate tabs', async () => {
    await renderBrowser();
    await sendPage({ ...PAGE, links: [...PAGE.links, { text: 'products', href: 'https://shop.example.com/products?ref=2' }] });
    expect(screen.getAllByText(/products/i).length).toBe(1);
  });

  test('builds a tab bar from the site menu in App view', async () => {
    await renderBrowser();
    await sendPage();
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Products')).toBeTruthy();
    expect(screen.getByText('More')).toBeTruthy();
  });

  test('switching to Web view removes the tab bar and tells the page', async () => {
    const props = await renderBrowser();
    await sendPage();
    await fireEvent.press(screen.getByText('Web'));
    expect(global.__web.injected.some((s) => s.includes("setMode('web')"))).toBe(true);
    expect(screen.queryByText('More')).toBeNull();
    expect(props.updateSettings).toHaveBeenCalledWith({ siteModes: { 'example.com': 'web' } });
  });

  test('remembers Web view for a site', async () => {
    await renderBrowser({ settings: { siteModes: { 'example.com': 'web' } } });
    expect(global.__web.props.injectedJavaScript).toContain("mode: 'web'");
  });

  test('tapping a tab navigates inside the site', async () => {
    await renderBrowser();
    await sendPage();
    await fireEvent.press(screen.getByText('Products'));
    expect(global.__web.injected).toContain('location.href = "https://shop.example.com/products"; true;');
  });

  test('records the visit for history', async () => {
    const props = await renderBrowser();
    await sendPage();
    expect(props.onVisit).toHaveBeenCalledWith({ host: 'shop.example.com', url: 'https://shop.example.com', title: 'Test Shop' });
  });
});

describe('Browser: search result pages', () => {
  const GOOGLE = {
    url: 'https://www.google.com/search?q=best+coffee+cork',
    host: 'www.google.com',
    title: 'best coffee cork - Google Search',
    description: '',
    headings: [],
    text: 'Places Cafe Moly',
    links: [
      { text: 'AI Mode', href: 'https://www.google.com/search?q=a&udm=50' },
      { text: 'AI Mode', href: 'https://www.google.com/search?q=a&udm=50&x=1' },
      { text: 'Shopping', href: 'https://www.google.com/search?q=a&udm=28' },
      { text: 'Images', href: 'https://www.google.com/search?q=a&udm=2' },
    ],
  };

  test('Google results show as the normal page: no app skin, no tab bar, no toggle', async () => {
    await renderBrowser({ startUrl: GOOGLE.url, settings: { autoInsights: true } });
    await sendPage(GOOGLE);
    expect(global.__web.props.injectedJavaScript).toContain("mode: 'web'");
    expect(screen.queryByText('More')).toBeNull();
    expect(screen.queryByText('App')).toBeNull();
    expect(screen.getByText('Search')).toBeTruthy();
    // no AI call for search pages
    expect(global.fetch.mock.calls.some((c) => c[0].includes('/api/chat'))).toBe(false);
  });

  test('tapping a result goes back to App view on the real site', async () => {
    await renderBrowser({ startUrl: GOOGLE.url });
    await sendPage(GOOGLE);
    global.__web.injected = [];
    await sendPage();
    expect(global.__web.injected.some((x) => x.includes("setMode('app')"))).toBe(true);
    expect(screen.getByText('More')).toBeTruthy();
  });
});

describe('Browser: stay-here shield', () => {
  const nav = (url, extra = {}) => global.__web.props.onShouldStartLoadWithRequest({ url, isTopFrame: true, navigationType: 'other', ...extra });

  test('allows redirects during the first load', async () => {
    await renderBrowser();
    expect(nav('https://consent.example.org/')).toBe(true);
  });

  test('after load: same site allowed, surprise redirect blocked', async () => {
    await renderBrowser();
    await act(() => global.__web.props.onLoadEnd());
    await sendPage();
    expect(nav('https://shop.example.com/products')).toBe(true);
    expect(nav('https://cdn.example.com/x')).toBe(true); // same base site
    let allowed;
    allowed = await act(() => nav('https://spam-prizes.com/win'));
    expect(allowed).toBe(false);
    expect(screen.getByText('Blocked redirect to spam-prizes.com')).toBeTruthy();
  });

  test('links the user taps are allowed, even to other sites', async () => {
    await renderBrowser();
    await act(() => global.__web.props.onLoadEnd());
    await sendPage();
    expect(nav('https://othersite.com/', { navigationType: 'click' })).toBe(true);
  });

  test('trusted login pages are allowed', async () => {
    await renderBrowser();
    await act(() => global.__web.props.onLoadEnd());
    await sendPage();
    expect(nav('https://accounts.google.com/signin')).toBe(true);
  });

  test('app links (intent://, market://) are blocked', async () => {
    await renderBrowser();
    let allowed;
    allowed = await act(() => nav('intent://scan/#Intent;scheme=zxing;end'));
    expect(allowed).toBe(false);
  });

  test('embedded frames are not blocked', async () => {
    await renderBrowser();
    await act(() => global.__web.props.onLoadEnd());
    expect(nav('https://youtube.com/embed/x', { isTopFrame: false })).toBe(true);
  });

  test('shield off allows everything', async () => {
    await renderBrowser({ settings: { shield: false } });
    await act(() => global.__web.props.onLoadEnd());
    expect(nav('https://spam-prizes.com/win')).toBe(true);
  });

  test('pop-up messages from the page show a notice', async () => {
    await renderBrowser();
    await act(() => global.__web.props.onMessage({ nativeEvent: { data: JSON.stringify({ type: 'blocked', data: { kind: 'popup' } }) } }));
    expect(screen.getByText('Blocked a pop-up window')).toBeTruthy();
  });

  test('garbage messages from a page are ignored', async () => {
    await renderBrowser();
    await expect(act(() => global.__web.props.onMessage({ nativeEvent: { data: 'not json' } }))).resolves.toBeUndefined();
  });
});

describe('Browser: AI', () => {
  test('analyses the page automatically and shows the summary', async () => {
    mockNetwork({
      insight: {
        summary: ['An online shop selling gadgets'],
        verdict: 'caution',
        reason: 'Countdown timers pressure you to buy',
        tabs: [
          { label: 'Gadgets', href: 'https://shop.example.com/products', icon: 'cart' },
          { label: 'Stories', href: 'https://shop.example.com/blog', icon: 'news' },
        ],
      },
    });
    await renderBrowser({ settings: { autoInsights: true } });
    await sendPage({ ...PAGE, url: 'https://shop.example.com/?ai=1' });

    // AI-picked tabs replace the menu tabs
    expect(await screen.findByText('Gadgets')).toBeTruthy();
    expect(screen.getByText('Stories')).toBeTruthy();

    const chatCall = global.fetch.mock.calls.find((c) => c[0].includes('/api/chat'));
    expect(chatCall).toBeTruthy();

    // the AI sheet shows the verdict and summary
    await fireEvent.press(screen.getByLabelText('WebSkin AI'));
    expect(screen.getByText('Be careful')).toBeTruthy();
    expect(screen.getByText('Countdown timers pressure you to buy')).toBeTruthy();
    expect(screen.getByText('An online shop selling gadgets')).toBeTruthy();
  });

  test('AI error is shown with a retry option', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    await renderBrowser({ settings: { autoInsights: true } });
    await sendPage({ ...PAGE, url: 'https://shop.example.com/?err=1' });
    await fireEvent.press(screen.getByLabelText('WebSkin AI'));
    expect(await screen.findByText(/Can't reach Ollama/)).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  test('saving the site as an app', async () => {
    const props = await renderBrowser();
    await sendPage();
    await fireEvent.press(screen.getByText('More'));
    await fireEvent.press(screen.getByText('Add app'));
    expect(props.onToggleSave).toHaveBeenCalledWith({ host: 'shop.example.com', url: 'https://shop.example.com', title: 'Test Shop' });
  });
});

// ---------------- Settings ----------------
describe('Settings screen', () => {
  test('Test connection lists models and lets you pick one', async () => {
    mockNetwork({ models: ['llama3.2:3b', 'llama3.1:8b'] });
    const updateSettings = jest.fn();
    await render(<SettingsScreen settings={DEFAULT_SETTINGS} updateSettings={updateSettings} onBack={jest.fn()} onClearData={jest.fn()} />);
    await fireEvent.press(screen.getByText('Test connection'));
    expect(await screen.findByText('✓ Connected. Tap a model to use it:')).toBeTruthy();
    await fireEvent.press(screen.getByText('llama3.1:8b'));
    expect(updateSettings).toHaveBeenCalledWith({ model: 'llama3.1:8b' });
  });

  test('connection failure is reported', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network request failed'));
    await render(<SettingsScreen settings={DEFAULT_SETTINGS} updateSettings={jest.fn()} onBack={jest.fn()} onClearData={jest.fn()} />);
    await fireEvent.press(screen.getByText('Test connection'));
    expect(await screen.findByText(/✕/)).toBeTruthy();
  });
});
