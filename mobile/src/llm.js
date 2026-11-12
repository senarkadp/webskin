// Local Llama via Ollama (free). Ollama runs on your laptop; the app talks to it over Wi-Fi.
// Laptop setup:  ollama pull llama3.2:3b   then start Ollama with OLLAMA_HOST=0.0.0.0
import { ICONS } from './theme';

const base = (url) => (url || '').trim().replace(/\/+$/, '');

async function withTimeout(ms, fn) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fn(ctrl.signal);
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error('The AI took too long to answer');
    throw e;
  } finally {
    clearTimeout(t);
  }
}

async function chat(settings, messages, { json = false, timeoutMs = 60000 } = {}) {
  return withTimeout(timeoutMs, async (signal) => {
    let res;
    try {
      res = await fetch(base(settings.ollamaUrl) + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings.model,
          stream: false,
          ...(json ? { format: 'json' } : {}),
          options: { temperature: 0.2, num_ctx: 4096 },
          messages,
        }),
        signal,
      });
    } catch (e) {
      if (e?.name === 'AbortError') throw e;
      throw new Error("Can't reach Ollama — is it running on your laptop?");
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      if (/not found/i.test(body)) throw new Error(`Model "${settings.model}" isn't installed. Run: ollama pull ${settings.model}`);
      throw new Error('Ollama error ' + res.status);
    }
    const data = await res.json();
    return data?.message?.content || '';
  });
}

const INSIGHT_PROMPT = `You are WebSkin, an assistant inside a mobile browser that makes websites easier and safer to use.
You receive data about ONE web page. Reply with ONLY this JSON:
{"summary":["3 short bullet points: what this page is and what the user can do here"],
 "verdict":"safe" or "caution" or "risky",
 "reason":"one short sentence explaining the verdict",
 "tabs":[{"label":"1-2 words","href":"an exact href from links","icon":"home|search|news|list|person|cart|info|mail|book|star|settings|grid|chat|play|calendar|help"}]}
Rules:
- tabs: choose up to 4 links a mobile user would need most, like an app's bottom tab bar. Use only hrefs from the provided links.
- verdict "risky": scams, fake prizes, phishing, fake download buttons, pressure tactics.
- verdict "caution": clickbait headlines, aggressive ads, misleading claims.
- otherwise "safe". Keep everything short and plain.`;

// One call per page: summary + safety check + smart tabs
export async function analyzePage(settings, page) {
  const payload = {
    url: page.url,
    title: page.title,
    description: page.description,
    headings: (page.headings || []).slice(0, 12),
    text: (page.text || '').slice(0, 1800),
    links: (page.links || []).slice(0, 25).map((l) => ({ label: l.text, href: l.href })),
  };
  const raw = await chat(
    settings,
    [
      { role: 'system', content: INSIGHT_PROMPT },
      { role: 'user', content: JSON.stringify(payload) },
    ],
    { json: true }
  );
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new Error('The AI gave an unreadable answer — try again');
  }
  return normalize(obj, page);
}

function normalize(o, page) {
  const hrefs = new Set((page.links || []).map((l) => l.href));
  return {
    summary: Array.isArray(o.summary) ? o.summary.filter((s) => typeof s === 'string' && s.trim()).slice(0, 4) : [],
    verdict: ['safe', 'caution', 'risky'].includes(o.verdict) ? o.verdict : 'safe',
    reason: typeof o.reason === 'string' ? o.reason : '',
    tabs: Array.isArray(o.tabs)
      ? o.tabs
          .filter((t) => t && t.label && hrefs.has(t.href))
          .slice(0, 4)
          .map((t) => ({ text: String(t.label).slice(0, 14), href: t.href, icon: ICONS[t.icon] ? t.icon : 'grid' }))
      : [],
  };
}

// Free-form question about the current page
export async function askPage(settings, page, question) {
  const context = `Page: ${page.title}\nURL: ${page.url}\nHeadings: ${(page.headings || []).join(' | ')}\nContent:\n${(page.text || '').slice(0, 3000)}`;
  return chat(settings, [
    {
      role: 'system',
      content: 'You help a user understand the web page they are viewing on their phone. Answer in 2-4 short sentences using only the page content. If the page does not say, say so.',
    },
    { role: 'user', content: context + '\n\nQuestion: ' + question },
  ]);
}

// Settings "Test connection": returns installed model names
export async function checkConnection(ollamaUrl) {
  return withTimeout(5000, async (signal) => {
    const res = await fetch(base(ollamaUrl) + '/api/tags', { signal });
    if (!res.ok) throw new Error('Ollama error ' + res.status);
    const data = await res.json();
    return (data.models || []).map((m) => m.name);
  });
}
