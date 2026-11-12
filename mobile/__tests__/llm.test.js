import { analyzePage, askPage, checkConnection } from '../src/llm';

const settings = { ollamaUrl: 'http://192.168.1.10:11434/', model: 'llama3.2:3b' };
const page = {
  url: 'https://shop.example.com/',
  host: 'shop.example.com',
  title: 'Shop',
  description: 'A shop',
  headings: ['Welcome'],
  text: 'Buy things here.',
  links: [
    { text: 'Home', href: 'https://shop.example.com/' },
    { text: 'Products', href: 'https://shop.example.com/products' },
    { text: 'Account', href: 'https://shop.example.com/account' },
  ],
};

const ollamaReply = (content, ok = true, status = 200) =>
  jest.fn().mockResolvedValue({ ok, status, json: async () => ({ message: { content } }), text: async () => content });

afterEach(() => jest.restoreAllMocks());

describe('analyzePage', () => {
  test('sends the page to Ollama and returns a clean insight', async () => {
    global.fetch = ollamaReply(
      JSON.stringify({
        summary: ['An online shop', 'Browse products'],
        verdict: 'caution',
        reason: 'Lots of ads',
        tabs: [
          { label: 'Products', href: 'https://shop.example.com/products', icon: 'cart' },
          { label: 'Fake', href: 'https://evil.com/', icon: 'home' },     // not on the page -> dropped
          { label: 'Account', href: 'https://shop.example.com/account', icon: 'nonsense' }, // bad icon -> grid
        ],
      })
    );
    const out = await analyzePage(settings, page);

    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe('http://192.168.1.10:11434/api/chat'); // trailing slash handled
    const body = JSON.parse(init.body);
    expect(body.model).toBe('llama3.2:3b');
    expect(body.format).toBe('json');
    expect(body.stream).toBe(false);

    expect(out.verdict).toBe('caution');
    expect(out.summary).toEqual(['An online shop', 'Browse products']);
    expect(out.tabs).toEqual([
      { text: 'Products', href: 'https://shop.example.com/products', icon: 'cart' },
      { text: 'Account', href: 'https://shop.example.com/account', icon: 'grid' },
    ]);
  });

  test('unknown verdicts fall back to safe and missing fields are tolerated', async () => {
    global.fetch = ollamaReply(JSON.stringify({ verdict: 'maybe' }));
    const out = await analyzePage(settings, page);
    expect(out).toEqual({ summary: [], verdict: 'safe', reason: '', tabs: [] });
  });

  test('unreadable model output gives a friendly error', async () => {
    global.fetch = ollamaReply('not json at all');
    await expect(analyzePage(settings, page)).rejects.toThrow(/unreadable/);
  });

  test('missing model tells the user what to pull', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, text: async () => 'model "llama3.2:3b" not found' });
    await expect(analyzePage(settings, page)).rejects.toThrow(/ollama pull llama3.2:3b/);
  });

  test('Ollama not running gives a friendly error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    await expect(analyzePage(settings, page)).rejects.toThrow(/Can't reach Ollama/);
  });
});

describe('askPage', () => {
  test('returns the model answer and includes the question and page text', async () => {
    global.fetch = ollamaReply('It opens at 9am.');
    const answer = await askPage(settings, page, 'When does it open?');
    expect(answer).toBe('It opens at 9am.');
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.format).toBeUndefined();
    expect(body.messages[1].content).toContain('When does it open?');
    expect(body.messages[1].content).toContain('Buy things here.');
  });
});

describe('checkConnection', () => {
  test('lists installed models', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ models: [{ name: 'llama3.2:3b' }, { name: 'llama3.1:8b' }] }) });
    expect(await checkConnection('http://x:11434')).toEqual(['llama3.2:3b', 'llama3.1:8b']);
    expect(global.fetch.mock.calls[0][0]).toBe('http://x:11434/api/tags');
  });
  test('throws on server error', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(checkConnection('http://x:11434')).rejects.toThrow(/500/);
  });
});
