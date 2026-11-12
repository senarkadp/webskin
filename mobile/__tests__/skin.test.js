// Runs the injected page script inside a simulated browser page (jsdom)
import { JSDOM, VirtualConsole } from 'jsdom';
import { goToScript, setModeScript, skinScript } from '../src/inject/skin';

const PAGE = `
  <header><nav>
    <a href="/">Home</a>
    <a href="/products">Products</a>
    <a href="/products">Products</a>
    <a href="/blog">Blog</a>
    <a href="https://evil.com/win">You won</a>
    <a href="/account">My account</a>
    <a href="/x">This label is far too long to be a tab</a>
    <a href="mailto:hi@shop.example.com">Mail</a>
  </nav></header>
  <main><h1>Welcome</h1><h2>Deals</h2><p>Hello   world   text.</p></main>
  <div id="onetrust-banner-sdk">We use cookies</div>
`;

let messages, window, document, nativeOpen;

afterEach(() => window && window.close());

function load(mode = 'app', shield = true) {
  const dom = new JSDOM(
    `<html><head><title>Test Shop | Home</title><meta name="description" content="Great shop"></head><body>${PAGE}</body></html>`,
    { url: 'https://shop.example.com/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: new VirtualConsole() } // jsdom can't really navigate; silence that
  );
  window = dom.window;
  document = window.document;
  nativeOpen = window.open;
  messages = [];
  window.ReactNativeWebView = { postMessage: (m) => messages.push(JSON.parse(m)) };
  window.eval(skinScript(mode, shield));
}

const pageMsg = () => messages.find((m) => m.type === 'page').data;

describe('page extraction', () => {
  beforeEach(() => load());

  test('sends title, description, headings and text to the app', () => {
    const p = pageMsg();
    expect(p.title).toBe('Test Shop | Home');
    expect(p.description).toBe('Great shop');
    expect(p.headings).toEqual(['Welcome', 'Deals']);
    expect(p.text).toContain('Hello world text.');
    expect(p.host).toBe('shop.example.com');
  });

  test('keeps only internal, short, unique menu links', () => {
    const labels = pageMsg().links.map((l) => l.text);
    expect(labels).toEqual(['Home', 'Products', 'Blog', 'My account']);
  });
});

describe('App / Web mode', () => {
  test('App mode adds the WebSkin stylesheet that hides cookie banners', () => {
    load('app');
    const style = document.getElementById('webskin-style');
    expect(style).not.toBeNull();
    expect(style.textContent).toContain('#onetrust-banner-sdk');
    expect(style.textContent).toContain('display:none');
  });

  test('Web mode leaves the original site untouched', () => {
    load('web');
    expect(document.getElementById('webskin-style')).toBeNull();
  });

  test('switching modes works without reloading', () => {
    load('app');
    window.eval(setModeScript('web'));
    expect(document.getElementById('webskin-style')).toBeNull();
    window.eval(setModeScript('app'));
    expect(document.getElementById('webskin-style')).not.toBeNull();
    expect(document.querySelectorAll('#webskin-style').length).toBe(1);
  });

  test('injecting twice on the same page does not double-apply', () => {
    load('app');
    window.eval(skinScript('app', true));
    expect(document.querySelectorAll('#webskin-style').length).toBe(1);
  });

  test('re-injecting with a new mode switches mode', () => {
    load('app');
    window.eval(skinScript('web', true));
    expect(document.getElementById('webskin-style')).toBeNull();
  });
});

describe('pop-up shield', () => {
  test('blocks pop-ups the user did not ask for', () => {
    load('app', true);
    expect(window.open('https://spam.example')).toBeNull();
    expect(messages.some((m) => m.type === 'blocked')).toBe(true);
  });

  test('a pop-up right after a tap opens in the same view instead', () => {
    load('app', true);
    document.dispatchEvent(new window.Event('touchend'));
    const result = window.open('/products');
    expect(result).toBe(window);
    expect(messages.some((m) => m.type === 'blocked')).toBe(false);
  });

  test('shield off leaves window.open alone', () => {
    load('app', false);
    expect(window.open).toBe(nativeOpen);
  });
});

test('goToScript safely quotes URLs', () => {
  expect(goToScript('https://a.com/"x"')).toBe('location.href = "https://a.com/\\"x\\""; true;');
});
