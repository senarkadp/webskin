// The script injected into every page. It:
//  1. extracts page info (title, links, text) and sends it to the app
//  2. in "app" mode restyles the page: removes cookie banners/ads/popups,
//     turns sticky headers into normal ones, modern typography, rounded media
//  3. blocks pop-up windows that the user didn't ask for
// window.__webskin.setMode('app' | 'web') switches instantly without reloading.

export const skinScript = (mode, shield) => `
(function () {
  if (window.__webskin) { window.__webskin.setMode('${mode}'); return; }
  var W = window.__webskin = { mode: '${mode}', hidden: [] };

  function post(type, data) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, data: data })); } catch (e) {}
  }
  function abs(h) { try { return new URL(h, location.href).href; } catch (e) { return null; } }
  function clean(s) { return (s || '').replace(/\\s+/g, ' ').trim(); }
  function meta(n) {
    var m = document.querySelector('meta[name="' + n + '"],meta[property="' + n + '"]');
    return m ? (m.getAttribute('content') || '') : '';
  }

  // ---------- 1. Extract ----------
  function extract() {
    if (!document.body) return;
    var host = location.hostname, seen = {}, links = [];
    var sel = 'nav a[href], header a[href], [role="navigation"] a[href], [class*="menu"] a[href], [class*="nav"] a[href]';
    var nodes = document.querySelectorAll(sel);
    for (var i = 0; i < nodes.length && links.length < 40; i++) {
      var a = nodes[i];
      var text = clean(a.textContent || a.getAttribute('aria-label') || a.title);
      if (!text || text.length > 24) continue;
      var href = abs(a.getAttribute('href'));
      if (!href || href.indexOf('http') !== 0) continue;
      var u = new URL(href);
      if (u.hostname !== host) continue;
      var key = u.pathname + u.search;
      if (seen[key]) continue;
      seen[key] = 1;
      links.push({ text: text, href: u.href });
    }
    var heads = [].slice.call(document.querySelectorAll('h1,h2,h3')).slice(0, 15)
      .map(function (h) { return clean(h.textContent).slice(0, 120); }).filter(Boolean);
    var main = document.querySelector('article, main, [role="main"]') || document.body;
    var icon = document.querySelector('link[rel~="apple-touch-icon"], link[rel~="icon"]');
    post('page', {
      url: location.href,
      host: host,
      title: clean(document.title),
      description: clean(meta('description') || meta('og:description')).slice(0, 300),
      themeColor: meta('theme-color'),
      icon: icon ? abs(icon.getAttribute('href')) : '',
      headings: heads,
      text: clean(main.innerText || main.textContent || '').slice(0, 4000),
      links: links
    });
  }

  // ---------- 2. App skin ----------
  var JUNK = [
    '#onetrust-banner-sdk', '#onetrust-consent-sdk', '.fc-consent-root', '#CybotCookiebotDialog', '.cc-window',
    '[id*="cookie-banner"]', '[class*="cookie-banner"]', '[class*="cookieBanner"]', '[id*="cookieConsent"]',
    '[class*="cookie-consent"]', '[id*="consent-banner"]', '[class*="consent-banner"]', '[class*="gdpr"]',
    'ins.adsbygoogle', '[id^="google_ads"]', '[id^="div-gpt-ad"]', 'iframe[src*="doubleclick"]',
    'iframe[src*="googlesyndication"]', '[id*="taboola"]', '[class*="taboola"]', '[class*="outbrain"]',
    '[class*="ad-slot"]', '[class*="adslot"]', '[aria-label="Advertisement"]', '[class*="newsletter-popup"]',
    '[class*="smartbanner"]', '[class*="app-banner"]'
  ].join(',');

  var CSS =
    'html{-webkit-text-size-adjust:100%!important;scroll-behavior:smooth}' +
    'body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif!important;' +
      'line-height:1.6!important;-webkit-font-smoothing:antialiased;padding-bottom:140px!important;overflow-x:hidden!important}' +
    'p,li{font-size:max(1em,16px)!important}' +
    'h1,h2,h3{letter-spacing:-0.01em;line-height:1.25!important}' +
    'img,video,picture,figure{max-width:100%!important;height:auto}' +
    'article img,main img,figure img,video{border-radius:14px}' +
    'table{display:block;overflow-x:auto;max-width:100%}' +
    'pre{overflow-x:auto;border-radius:12px}' +
    'button,input[type="submit"],input[type="button"]{border-radius:12px!important;min-height:44px}' +
    'input[type="text"],input[type="search"],input[type="email"],input[type="password"],textarea,select{' +
      'border-radius:12px!important;min-height:44px;font-size:16px!important}' +
    'a{-webkit-tap-highlight-color:rgba(124,92,255,.25)}' +
    JUNK + '{display:none!important}' +
    '.webskin-hide{display:none!important}' +
    '.webskin-static{position:relative!important;top:auto!important;bottom:auto!important}';

  var POPUP_TEXT = /cookie|consent|gdpr|subscribe|newsletter|sign up for|allow notifications|open in app|get the app|use the app|ad ?blocker|you(.ve| have) won|claim your/;

  function mark(el, cls) { if (!el.classList.contains(cls)) { el.classList.add(cls); W.hidden.push([el, cls]); } }

  function fixLayout() {
    if (!document.body) return;
    var all = document.body.getElementsByTagName('*');
    var vh = window.innerHeight, vw = window.innerWidth, hidBig = false;
    for (var i = 0; i < all.length && i < 5000; i++) {
      var el = all[i], cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
      var r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > vh) continue;
      var txt = (el.innerText || '').toLowerCase().slice(0, 400);
      var overlay = cs.position === 'fixed' && r.height > vh * 0.6 && r.width > vw * 0.8 && cs.opacity !== '0';
      if (POPUP_TEXT.test(txt) || overlay) {
        mark(el, 'webskin-hide');
        if (overlay) hidBig = true;
      } else if (r.top <= 8 && r.height < vh * 0.3) {
        mark(el, 'webskin-static');               // sticky header scrolls away like an app
      } else if (r.bottom >= vh - 8 && r.height < vh * 0.3) {
        mark(el, 'webskin-hide');                 // bottom bars clash with the WebSkin tab bar
      }
    }
    if (hidBig) {                                 // unlock scrolling that a pop-up had locked
      document.documentElement.style.setProperty('overflow', 'auto', 'important');
      document.body.style.setProperty('overflow', 'auto', 'important');
    }
  }

  function apply() {
    if (!document.getElementById('webskin-style')) {
      var s = document.createElement('style');
      s.id = 'webskin-style';
      s.textContent = CSS;
      (document.head || document.documentElement).appendChild(s);
    }
    fixLayout();
  }
  function unapply() {
    var s = document.getElementById('webskin-style');
    if (s) s.parentNode.removeChild(s);
    W.hidden.forEach(function (p) { p[0].classList.remove(p[1]); });
    W.hidden = [];
  }
  W.setMode = function (m) { W.mode = m; if (m === 'app') apply(); else unapply(); };

  // ---------- 3. Pop-up shield ----------
  if (${shield ? 'true' : 'false'}) {
    var lastTouch = 0;
    document.addEventListener('touchend', function () { lastTouch = Date.now(); }, true);
    window.open = function (u) {
      if (u && Date.now() - lastTouch < 1000) { location.href = abs(u) || u; return window; }
      post('blocked', { kind: 'popup' });
      return null;
    };
  }

  // ---------- Single-page sites & late pop-ups ----------
  var t;
  function schedule() {
    clearTimeout(t);
    t = setTimeout(function () { extract(); if (W.mode === 'app') fixLayout(); }, 700);
  }
  ['pushState', 'replaceState'].forEach(function (k) {
    var orig = history[k];
    history[k] = function () { var r = orig.apply(this, arguments); schedule(); return r; };
  });
  window.addEventListener('popstate', schedule);
  if (document.body && window.MutationObserver) {
    var mo = new MutationObserver(function () {
      if (W.mode !== 'app') return;
      clearTimeout(W.mt);
      W.mt = setTimeout(fixLayout, 400);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { mo.disconnect(); }, 15000);
  }

  W.extract = extract;
  W.setMode(W.mode);
  extract();
  window.addEventListener('load', function () { extract(); if (W.mode === 'app') fixLayout(); });
})();
true;
`;

export const setModeScript = (mode) =>
  `window.__webskin && window.__webskin.setMode('${mode}'); true;`;

export const goToScript = (href) => `location.href = ${JSON.stringify(href)}; true;`;
