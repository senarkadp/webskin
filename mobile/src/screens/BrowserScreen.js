import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, BackHandler, Image, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, Share, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C, GRAD, ICONS, guessIcon } from '../theme';
import { baseHost, faviconFor, hostOf, isSearchEngine, originOf, pathOf, prettyHost, resolveInput } from '../search';
import { goToScript, setModeScript, skinScript } from '../inject/skin';
import { analyzePage, askPage } from '../llm';
import SearchBox from '../components/SearchBox';

// Logins/payments that legitimately send you to another domain
const TRUSTED_HOSTS = ['accounts.google.com', 'appleid.apple.com', 'www.paypal.com', 'login.microsoftonline.com'];

// Caches live for the whole app session
const insightCache = new Map(); // url  -> AI insight
const hostTabs = new Map();      // host -> AI-picked tabs

export default function BrowserScreen({ startUrl, settings, updateSettings, apps, sites, onToggleSave, onHome, onVisit }) {
  const insets = useSafeAreaInsets();
  const webRef = useRef(null);

  const [src, setSrc] = useState({ uri: startUrl });
  const [nav, setNav] = useState({ url: startUrl, title: '', canGoBack: false, canGoForward: false });
  const [progress, setProgress] = useState(0);
  const [page, setPage] = useState(null);
  const host = hostOf(nav.url);

  const [mode, setMode] = useState(settings.siteModes?.[baseHost(hostOf(startUrl))] || settings.defaultMode);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Search result pages (Google, Bing…) always show as the normal web page —
  // they're already built for phones, and turning them into an "app" breaks them.
  const onSearchPage = isSearchEngine(nav.url);
  const effMode = onSearchPage ? 'web' : mode;
  const effModeRef = useRef(effMode);
  effModeRef.current = effMode;

  const [blocked, setBlocked] = useState(0);
  const [toast, setToast] = useState('');
  const [insight, setInsight] = useState({ status: 'idle' });
  const [tabsVersion, setTabsVersion] = useState(0);
  const [sheet, setSheet] = useState(null); // 'ai' | 'more' | 'search' | null

  // navigation-shield state
  const currentUrl = useRef(startUrl);
  const firstLoad = useRef(true);
  const lastClick = useRef(0);
  const canGoBack = useRef(false);
  const toastTimer = useRef(null);
  const reqId = useRef(0);

  useEffect(() => () => clearTimeout(toastTimer.current), []); // stop timers when leaving the screen

  const flash = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2500);
  };

  // ---------- App / Web mode ----------
  const applyMode = (m, remember = true) => {
    setMode(m);
    if (remember && host) updateSettings({ siteModes: { ...settings.siteModes, [baseHost(host)]: m } });
  };

  // tell the page whenever the effective view changes
  useEffect(() => {
    webRef.current?.injectJavaScript(setModeScript(effMode));
  }, [effMode]);

  // when moving to another site, use that site's remembered mode
  useEffect(() => {
    if (!host) return;
    const m = settings.siteModes?.[baseHost(host)] || settings.defaultMode;
    if (m !== modeRef.current) applyMode(m, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  // Android hardware back
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sheet) return setSheet(null), true;
      if (canGoBack.current) return webRef.current?.goBack(), true;
      onHome();
      return true;
    });
    return () => sub.remove();
  }, [sheet, onHome]);

  // ---------- AI insight for each page ----------
  const runInsight = async (p) => {
    if (!p) return;
    if (insightCache.has(p.url)) {
      setInsight({ status: 'done', data: insightCache.get(p.url) });
      return;
    }
    const id = ++reqId.current;
    setInsight({ status: 'loading' });
    try {
      const data = await analyzePage(settings, p);
      insightCache.set(p.url, data);
      if (data.tabs.length >= 2 && !hostTabs.has(p.host)) {
        hostTabs.set(p.host, data.tabs);
        setTabsVersion((v) => v + 1);
      }
      if (id === reqId.current) setInsight({ status: 'done', data });
    } catch (e) {
      if (id === reqId.current) setInsight({ status: 'error', error: e.message || 'AI unavailable' });
    }
  };

  useEffect(() => {
    if (!page) return;
    if (insightCache.has(page.url)) return setInsight({ status: 'done', data: insightCache.get(page.url) });
    setInsight({ status: 'idle' });
    if (effMode === 'app' && settings.aiEnabled && settings.autoInsights && !isSearchEngine(page.url)) runInsight(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page?.url, effMode]);

  // ---------- Tabs: AI-picked if available, otherwise from the site's menu ----------
  const tabs = useMemo(() => {
    if (!page || page.host !== host) return [];
    const ai = hostTabs.get(page.host);
    if (ai) return ai;
    const origin = originOf(page.url) + '/';
    const out = [{ text: 'Home', href: origin, icon: 'home' }];
    for (const l of page.links) {
      if (out.length >= 4) break;
      if (pathOf(l.href) === '/' || out.some((t) => t.href === l.href || t.text.toLowerCase() === l.text.toLowerCase())) continue;
      out.push({ text: l.text.slice(0, 14), href: l.href, icon: guessIcon(l.text, l.href) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, host, tabsVersion]);

  const activeTab = useMemo(() => {
    const p = pathOf(nav.url);
    let best = -1, bestLen = -1;
    tabs.forEach((t, i) => {
      const tp = pathOf(t.href);
      const match = tp === '/' ? p === '/' : p === tp || p.startsWith(tp.endsWith('/') ? tp : tp + '/');
      if (match && tp.length > bestLen) { best = i; bestLen = tp.length; }
    });
    return best;
  }, [tabs, nav.url]);

  const goTo = (href) => {
    lastClick.current = Date.now();
    setSheet(null);
    webRef.current?.injectJavaScript(goToScript(href));
  };

  // ---------- Navigation shield ----------
  const shouldStart = (req) => {
    const target = req.url;
    const scheme = target.split(':')[0].toLowerCase();
    if (['about', 'data', 'blob', 'javascript'].includes(scheme)) return true;
    if (scheme !== 'http' && scheme !== 'https') {
      if (settings.shield) { setBlocked((b) => b + 1); flash('Blocked an app link'); }
      return false; // the WebView can't open app links anyway
    }
    if (req.isTopFrame === false) return true; // embedded videos, maps
    if (req.navigationType === 'click') lastClick.current = Date.now();
    if (!settings.shield) return true;

    const t = hostOf(target);
    const c = hostOf(currentUrl.current);
    const allowed =
      firstLoad.current ||
      (c && baseHost(t) === baseHost(c)) ||
      TRUSTED_HOSTS.includes(t) ||
      Date.now() - lastClick.current < 2500; // user tapped a link (incl. Google result redirects)

    if (!allowed) {
      setBlocked((b) => b + 1);
      flash(`Blocked redirect to ${prettyHost(t)}`);
    }
    return allowed;
  };

  const onMessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (msg.type === 'page' && msg.data) {
      setPage((prev) => (prev && prev.url === msg.data.url && prev.links.length >= msg.data.links.length ? prev : msg.data));
      if (!isSearchEngine(msg.data.url)) onVisit({ host: msg.data.host, url: originOf(msg.data.url), title: msg.data.title });
    } else if (msg.type === 'blocked') {
      setBlocked((b) => b + 1);
      flash('Blocked a pop-up window');
    }
  };

  const openInput = (text) => {
    const url = resolveInput(text);
    if (!url) return;
    setSheet(null);
    firstLoad.current = true;
    setSrc({ uri: url, k: Date.now() });
  };

  const saved = apps.some((a) => a.host === host);
  const toggleSave = () => {
    if (!host) return;
    onToggleSave({ host, url: originOf(nav.url), title: (page?.host === host && page.title.split(/[|\-–—:]/)[0].trim()) || prettyHost(host) });
    flash(saved ? 'Removed from your apps' : 'Added to your apps');
  };

  const showTabs = effMode === 'app' && tabs.length >= 2;
  const verdict = insight.status === 'done' ? insight.data.verdict : null;
  const verdictColor = verdict === 'risky' ? C.danger : verdict === 'caution' ? C.warn : C.ok;

  return (
    <View style={s.root}>
      {/* ---------- Top bar ---------- */}
      <View style={[s.top, { paddingTop: insets.top + 6 }]}>
        <Pressable style={s.topBtn} onPress={onHome} hitSlop={6}>
          <Ionicons name="grid-outline" size={19} color={C.text} />
        </Pressable>

        <Pressable style={s.titlePill} onPress={() => setSheet('search')}>
          {host ? <Image source={{ uri: faviconFor(host) }} style={s.titleFav} /> : null}
          <View style={{ flex: 1 }}>
            <Text style={s.title} numberOfLines={1}>{(page?.host === host && page.title) || nav.title || prettyHost(host)}</Text>
            <Text style={s.titleHost} numberOfLines={1}>
              {settings.shield ? '🛡 ' : ''}{prettyHost(host)}{blocked ? ` · ${blocked} blocked` : ''}
            </Text>
          </View>
          {verdict && verdict !== 'safe' ? <View style={[s.verdictDot, { backgroundColor: verdictColor }]} /> : null}
        </Pressable>

        {onSearchPage ? (
          <View style={s.searchChip}>
            <Ionicons name="search" size={13} color={C.accent2} />
            <Text style={s.toggleText}>Search</Text>
          </View>
        ) : (
          <ModeToggle mode={mode} onChange={(m) => applyMode(m)} />
        )}
      </View>

      {/* progress */}
      <View style={s.progressTrack}>
        {progress < 1 ? <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.progress, { width: `${Math.max(progress, 0.05) * 100}%` }]} /> : null}
      </View>

      {/* ---------- Web content ---------- */}
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <WebView
          ref={webRef}
          source={src}
          style={{ flex: 1 }}
          injectedJavaScript={skinScript(effMode, settings.shield)}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={shouldStart}
          onNavigationStateChange={(n) => {
            currentUrl.current = n.url;
            canGoBack.current = n.canGoBack;
            setNav({ url: n.url, title: n.title, canGoBack: n.canGoBack, canGoForward: n.canGoForward });
          }}
          onLoadStart={() => setProgress(0.05)}
          onLoadProgress={(e) => setProgress(e.nativeEvent.progress)}
          onLoadEnd={() => {
            firstLoad.current = false;
            setProgress(1);
            webRef.current?.injectJavaScript(setModeScript(effModeRef.current));
          }}
          allowsBackForwardNavigationGestures
          pullToRefreshEnabled
          javaScriptCanOpenWindowsAutomatically={false}
          setSupportMultipleWindows={false}
          allowsInlineMediaPlayback
          decelerationRate="normal"
        />

        {/* toast */}
        {toast ? (
          <View style={[s.toast, { bottom: (showTabs ? 96 : 16) + insets.bottom }]} pointerEvents="none">
            <Ionicons name="shield-checkmark" size={14} color={C.ok} />
            <Text style={s.toastText}>{toast}</Text>
          </View>
        ) : null}

        {/* ---------- App mode: floating tab bar + AI orb ---------- */}
        {showTabs ? (
          <>
            <Pressable accessibilityLabel="WebSkin AI" style={[s.orb, { bottom: 92 + insets.bottom }]} onPress={() => setSheet('ai')}>
              <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.orbInner}>
                {insight.status === 'loading' ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="sparkles" size={20} color="#fff" />}
              </LinearGradient>
              {verdict && verdict !== 'safe' ? <View style={[s.orbBadge, { backgroundColor: verdictColor }]} /> : null}
            </Pressable>

            <View style={[s.tabBar, { bottom: 10 + insets.bottom }]}>
              {tabs.map((t, i) => (
                <Pressable key={t.href} style={s.tab} onPress={() => goTo(t.href)}>
                  {i === activeTab ? <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.tabGlow} /> : null}
                  <Ionicons name={ICONS[t.icon] || 'grid-outline'} size={20} color={i === activeTab ? '#fff' : C.sub} />
                  <Text style={[s.tabText, i === activeTab && { color: '#fff', fontWeight: '700' }]} numberOfLines={1}>{t.text}</Text>
                </Pressable>
              ))}
              <Pressable style={s.tab} onPress={() => setSheet('more')}>
                <Ionicons name="ellipsis-horizontal-circle-outline" size={20} color={C.sub} />
                <Text style={s.tabText}>More</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </View>

      {/* ---------- Web mode (or no tabs): classic toolbar ---------- */}
      {!showTabs ? (
        <View style={[s.toolbar, { paddingBottom: insets.bottom + 6 }]}>
          <ToolBtn icon="chevron-back" disabled={!nav.canGoBack} onPress={() => webRef.current?.goBack()} />
          <ToolBtn icon="chevron-forward" disabled={!nav.canGoForward} onPress={() => webRef.current?.goForward()} />
          <Pressable accessibilityLabel="WebSkin AI" style={s.toolAi} onPress={() => setSheet('ai')}>
            <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.toolAiInner}>
              {insight.status === 'loading' ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="sparkles" size={18} color="#fff" />}
            </LinearGradient>
          </Pressable>
          <ToolBtn icon={saved ? 'star' : 'star-outline'} color={saved ? C.warn : undefined} onPress={toggleSave} />
          <ToolBtn icon="ellipsis-horizontal" onPress={() => setSheet('more')} />
        </View>
      ) : null}

      {/* ---------- Sheets ---------- */}
      <Sheet visible={sheet === 'ai'} onClose={() => setSheet(null)}>
        <AiPanel
          settings={settings}
          page={page}
          insight={insight}
          onAnalyze={() => runInsight(page)}
          onJump={goTo}
          verdictColor={verdictColor}
        />
      </Sheet>

      <Sheet visible={sheet === 'more'} onClose={() => setSheet(null)}>
        <View style={s.actions}>
          <Action icon="chevron-back" label="Back" disabled={!nav.canGoBack} onPress={() => { setSheet(null); webRef.current?.goBack(); }} />
          <Action icon="chevron-forward" label="Forward" disabled={!nav.canGoForward} onPress={() => { setSheet(null); webRef.current?.goForward(); }} />
          <Action icon="refresh" label="Reload" onPress={() => { setSheet(null); webRef.current?.reload(); }} />
          <Action icon={saved ? 'star' : 'star-outline'} label={saved ? 'Saved' : 'Add app'} onPress={toggleSave} />
          <Action icon="share-outline" label="Share" onPress={() => Share.share({ message: nav.url })} />
        </View>
        <Text style={s.sheetLabel}>All sections on {prettyHost(host)}</Text>
        <ScrollView style={{ maxHeight: 320 }}>
          {(page?.links || []).map((l) => (
            <Pressable key={l.href} style={s.linkRow} onPress={() => goTo(l.href)}>
              <Ionicons name={ICONS[guessIcon(l.text, l.href)]} size={18} color={C.sub} />
              <Text style={s.linkText} numberOfLines={1}>{l.text}</Text>
              <Ionicons name="chevron-forward" size={15} color={C.dim} />
            </Pressable>
          ))}
          {!page?.links?.length ? <Text style={s.muted}>No menu found on this page.</Text> : null}
        </ScrollView>
      </Sheet>

      <Modal visible={sheet === 'search'} animationType="fade" transparent onRequestClose={() => setSheet(null)}>
        <View style={[s.searchOverlay, { paddingTop: insets.top + 12 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <SearchBox initial={nav.url} autoFocus alwaysShowList onSubmit={openInput} sites={sites} />
            </View>
            <Pressable onPress={() => setSheet(null)} hitSlop={8}>
              <Text style={{ color: C.accent2, fontSize: 16 }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------- AI panel ----------
function AiPanel({ settings, page, insight, onAnalyze, onJump, verdictColor }) {
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState({ status: 'idle' });

  useEffect(() => { setAnswer({ status: 'idle' }); setQ(''); }, [page?.url]);

  const ask = async () => {
    if (!q.trim() || !page) return;
    setAnswer({ status: 'loading' });
    try {
      setAnswer({ status: 'done', text: await askPage(settings, page, q.trim()) });
    } catch (e) {
      setAnswer({ status: 'error', text: e.message });
    }
  };

  if (!settings.aiEnabled) {
    return (
      <View>
        <PanelHeader model={null} />
        <Text style={s.muted}>AI is turned off. Turn it on in Settings to get page summaries, safety checks and smart tabs.</Text>
      </View>
    );
  }

  const d = insight.data;
  return (
    <View>
      <PanelHeader model={settings.model} />

      {insight.status === 'idle' && (
        <Pressable style={s.bigBtn} onPress={onAnalyze} disabled={!page}>
          <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.bigBtnInner}>
            <Ionicons name="sparkles" size={16} color="#fff" />
            <Text style={s.bigBtnText}>Analyse this page</Text>
          </LinearGradient>
        </Pressable>
      )}

      {insight.status === 'loading' && (
        <View style={s.loadingRow}>
          <ActivityIndicator color={C.accent2} />
          <Text style={s.muted}>Llama is reading this page…</Text>
        </View>
      )}

      {insight.status === 'error' && (
        <View style={s.errorBox}>
          <Text style={s.errorText}>{insight.error}</Text>
          <Text style={s.mutedSmall}>Check Ollama is running on your laptop at {settings.ollamaUrl} and both devices are on the same Wi-Fi.</Text>
          <Pressable onPress={onAnalyze}><Text style={s.retry}>Try again</Text></Pressable>
        </View>
      )}

      {insight.status === 'done' && d && (
        <>
          <View style={[s.verdict, { borderColor: verdictColor }]}>
            <Ionicons
              name={d.verdict === 'safe' ? 'shield-checkmark' : d.verdict === 'caution' ? 'warning' : 'alert-circle'}
              size={18}
              color={verdictColor}
            />
            <View style={{ flex: 1 }}>
              <Text style={[s.verdictTitle, { color: verdictColor }]}>
                {d.verdict === 'safe' ? 'Looks safe' : d.verdict === 'caution' ? 'Be careful' : 'Risky page'}
              </Text>
              {d.reason ? <Text style={s.verdictReason}>{d.reason}</Text> : null}
            </View>
          </View>

          {d.summary.length > 0 && <Text style={s.sheetLabel}>Summary</Text>}
          {d.summary.map((line, i) => (
            <View key={i} style={s.bullet}>
              <View style={s.bulletDot} />
              <Text style={s.bulletText}>{line}</Text>
            </View>
          ))}

          {d.tabs.length > 0 && (
            <>
              <Text style={s.sheetLabel}>Quick jump</Text>
              <View style={s.jumpRow}>
                {d.tabs.map((t) => (
                  <Pressable key={t.href} style={s.jump} onPress={() => onJump(t.href)}>
                    <Ionicons name={ICONS[t.icon]} size={14} color={C.accent2} />
                    <Text style={s.jumpText}>{t.text}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </>
      )}

      {/* Ask anything about the page */}
      <Text style={s.sheetLabel}>Ask about this page</Text>
      <View style={s.askBox}>
        <TextInput
          style={s.askInput}
          value={q}
          onChangeText={setQ}
          placeholder="e.g. What are the opening hours?"
          placeholderTextColor={C.dim}
          returnKeyType="send"
          onSubmitEditing={ask}
        />
        <Pressable onPress={ask} hitSlop={8} disabled={answer.status === 'loading'}>
          {answer.status === 'loading' ? <ActivityIndicator color={C.accent2} size="small" /> : <Ionicons name="arrow-up-circle" size={28} color={C.accent2} />}
        </Pressable>
      </View>
      {answer.status === 'done' && <Text style={s.answer}>{answer.text}</Text>}
      {answer.status === 'error' && <Text style={s.errorText}>{answer.text}</Text>}
    </View>
  );
}

function PanelHeader({ model }) {
  return (
    <View style={s.panelHeader}>
      <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.panelIcon}>
        <Ionicons name="sparkles" size={16} color="#fff" />
      </LinearGradient>
      <Text style={s.panelTitle}>Page insight</Text>
      {model ? <View style={s.modelChip}><Text style={s.modelText}>{model} · local</Text></View> : null}
    </View>
  );
}

// ---------- small components ----------
function ModeToggle({ mode, onChange }) {
  return (
    <View style={s.toggle}>
      {['app', 'web'].map((m) => (
        <Pressable key={m} onPress={() => onChange(m)} style={s.toggleOpt}>
          {mode === m ? <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /> : null}
          <Ionicons name={m === 'app' ? 'phone-portrait-outline' : 'globe-outline'} size={13} color={mode === m ? '#fff' : C.sub} />
          <Text style={[s.toggleText, mode === m && { color: '#fff' }]}>{m === 'app' ? 'App' : 'Web'}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ToolBtn({ icon, onPress, disabled, color }) {
  return (
    <Pressable style={s.toolBtn} onPress={onPress} disabled={disabled} hitSlop={6}>
      <Ionicons name={icon} size={22} color={disabled ? C.dim : color || C.text} />
    </Pressable>
  );
}

function Action({ icon, label, onPress, disabled }) {
  return (
    <Pressable style={[s.action, disabled && { opacity: 0.35 }]} onPress={onPress} disabled={disabled}>
      <View style={s.actionIcon}><Ionicons name={icon} size={20} color={C.text} /></View>
      <Text style={s.actionText}>{label}</Text>
    </Pressable>
  );
}

function Sheet({ visible, onClose, children }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.grabber} />
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 560 }}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  top: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingBottom: 8, backgroundColor: C.bg },
  topBtn: { width: 38, height: 38, borderRadius: 13, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  titlePill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, paddingHorizontal: 10, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  titleFav: { width: 20, height: 20, borderRadius: 5, backgroundColor: '#fff' },
  title: { color: C.text, fontSize: 13, fontWeight: '700' },
  titleHost: { color: C.sub, fontSize: 11, marginTop: 1 },
  verdictDot: { width: 8, height: 8, borderRadius: 4 },

  toggle: { flexDirection: 'row', borderRadius: 13, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  toggleOpt: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, height: 38, overflow: 'hidden' },
  toggleText: { color: C.sub, fontSize: 12, fontWeight: '700' },
  searchChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 38, borderRadius: 13, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },

  progressTrack: { height: 2, backgroundColor: C.bg },
  progress: { height: 2 },

  tabBar: {
    position: 'absolute', left: 12, right: 12, height: 68, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 6, borderRadius: 24, backgroundColor: C.glass, borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  tab: { flex: 1, height: 56, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 18, overflow: 'hidden' },
  tabGlow: { ...StyleSheet.absoluteFillObject, opacity: 0.9 },
  tabText: { color: C.sub, fontSize: 10.5, fontWeight: '600', maxWidth: 70 },

  orb: { position: 'absolute', right: 18, width: 52, height: 52, borderRadius: 26, shadowColor: '#7C5CFF', shadowOpacity: 0.6, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 10 },
  orbInner: { flex: 1, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  orbBadge: { position: 'absolute', top: 2, right: 2, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: C.bg },

  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: 8, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border },
  toolBtn: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
  toolAi: { width: 44, height: 44 },
  toolAiInner: { flex: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

  toast: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(7,8,15,0.92)', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: C.border },
  toastText: { color: C.text, fontSize: 13 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: C.bg2, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 8, borderWidth: 1, borderColor: C.border },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: C.dim, marginBottom: 14 },
  sheetLabel: { color: C.sub, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 18, marginBottom: 10 },
  muted: { color: C.sub, fontSize: 14, lineHeight: 20 },
  mutedSmall: { color: C.sub, fontSize: 12, lineHeight: 17, marginTop: 6 },

  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  action: { alignItems: 'center', width: 62 },
  actionIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: C.sub, fontSize: 11, marginTop: 6 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  linkText: { color: C.text, fontSize: 15, flex: 1 },

  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  panelIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  panelTitle: { color: C.text, fontSize: 18, fontWeight: '800', flex: 1 },
  modelChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  modelText: { color: C.sub, fontSize: 11 },

  bigBtn: { marginTop: 16, borderRadius: 16, overflow: 'hidden' },
  bigBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50 },
  bigBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  errorBox: { marginTop: 16, padding: 14, borderRadius: 16, backgroundColor: 'rgba(255,92,122,0.08)', borderWidth: 1, borderColor: 'rgba(255,92,122,0.3)' },
  errorText: { color: C.danger, fontSize: 14, fontWeight: '600', marginTop: 4 },
  retry: { color: C.accent2, fontSize: 14, fontWeight: '700', marginTop: 10 },

  verdict: { flexDirection: 'row', gap: 10, marginTop: 16, padding: 14, borderRadius: 16, borderWidth: 1, backgroundColor: C.card },
  verdictTitle: { fontSize: 15, fontWeight: '800' },
  verdictReason: { color: C.sub, fontSize: 13, marginTop: 3, lineHeight: 18 },
  bullet: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent2, marginTop: 8 },
  bulletText: { color: C.text, fontSize: 15, lineHeight: 22, flex: 1 },
  jumpRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  jump: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(34,211,238,0.08)', borderWidth: 1, borderColor: 'rgba(34,211,238,0.25)' },
  jumpText: { color: C.text, fontSize: 13, fontWeight: '600' },
  askBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 14, paddingRight: 8, height: 50, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  askInput: { flex: 1, color: C.text, fontSize: 15 },
  answer: { color: C.text, fontSize: 15, lineHeight: 22, marginTop: 12 },

  searchOverlay: { flex: 1, backgroundColor: 'rgba(7,8,15,0.98)', paddingHorizontal: 14 },
});
