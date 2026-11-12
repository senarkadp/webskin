// WebSkin v0.1 — turns a site's main menu into an app-style bottom tab bar.
// This is exported as a string because it is injected into the web page.
export default `
(function () {
  if (window.__appshell) return;          // don't inject twice on the same page
  window.__appshell = true;

  var host = location.hostname;
  var links = document.querySelectorAll('nav a, header a, [role="navigation"] a');
  var seen = {};
  var tabs = [];

  for (var i = 0; i < links.length; i++) {
    var a = links[i];
    var text = (a.innerText || a.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim();
    if (!text || text.length > 20) continue;          // skip empty or long labels

    var url;
    try { url = new URL(a.href, location.href); } catch (e) { continue; }
    if (url.hostname !== host) continue;              // internal links only
    if (seen[url.pathname]) continue;                 // no duplicates
    seen[url.pathname] = true;

    tabs.push({ text: text, href: url.href, active: url.pathname === location.pathname });
    if (tabs.length === 5) break;                     // max 5 tabs
  }

  if (tabs.length < 2) return;                        // not enough to make a tab bar

  // Use the site's own theme colour if it has one
  var meta = document.querySelector('meta[name="theme-color"]');
  var accent = meta && meta.content ? meta.content : '#1a73e8';

  var bar = document.createElement('div');
  bar.id = 'appshell-tabbar';
  bar.style.cssText =
    'position:fixed;left:0;right:0;bottom:0;height:56px;display:flex;' +
    'background:#fff;border-top:1px solid #ddd;z-index:2147483647;' +
    'font-family:-apple-system,system-ui,sans-serif;box-shadow:0 -2px 8px rgba(0,0,0,.08);';

  tabs.forEach(function (t) {
    var el = document.createElement('a');
    el.href = t.href;
    el.textContent = t.text;
    el.style.cssText =
      'flex:1;display:flex;align-items:center;justify-content:center;' +
      'font-size:12px;text-decoration:none;padding:0 4px;' +
      'overflow:hidden;white-space:nowrap;text-overflow:ellipsis;' +
      'color:' + (t.active ? accent : '#555') + ';' +
      'font-weight:' + (t.active ? '600' : '400') + ';';
    bar.appendChild(el);
  });

  document.body.appendChild(bar);
  document.body.style.paddingBottom = '64px';         // keep content above the bar
})();
true;
`;
