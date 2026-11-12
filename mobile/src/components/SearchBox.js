import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../theme';
import { faviconFor, fetchSuggestions, looksLikeUrl, prettyHost } from '../search';

// Search bar with live Google suggestions + matching saved/recent sites
export default function SearchBox({ initial = '', autoFocus = false, alwaysShowList = false, onSubmit, sites = [], onFocusChange }) {
  const [q, setQ] = useState(initial);
  const [sugs, setSugs] = useState([]);
  const [focused, setFocused] = useState(autoFocus);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      if (looksLikeUrl(q) && /^https?:\/\//i.test(q)) return setSugs([]);
      setSugs(await fetchSuggestions(q, ctrl.signal));
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const ql = q.trim().toLowerCase();
  const siteMatches = ql
    ? sites
        .filter((x, i, arr) => arr.findIndex((y) => y.host === x.host) === i)
        .filter((x) => x.host.includes(ql) || (x.title || '').toLowerCase().includes(ql))
        .slice(0, 3)
    : [];

  const submit = (text) => {
    if (text && text.trim()) onSubmit(text.trim());
  };
  const showList = !!ql && (focused || alwaysShowList);

  return (
    <View>
      <View style={[s.box, focused && s.boxFocused]}>
        <Ionicons name="search" size={18} color={focused ? C.accent2 : C.sub} />
        <TextInput
          style={s.input}
          value={q}
          onChangeText={setQ}
          placeholder="Search Google or type a website"
          placeholderTextColor={C.dim}
          autoFocus={autoFocus}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="web-search"
          returnKeyType="go"
          selectTextOnFocus
          onSubmitEditing={() => submit(q)}
          onFocus={() => {
            setFocused(true);
            onFocusChange?.(true);
          }}
          onBlur={() => {
            setFocused(false);
            onFocusChange?.(false);
          }}
        />
        {q ? (
          <Pressable onPress={() => setQ('')} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={C.sub} />
          </Pressable>
        ) : null}
      </View>

      {showList ? (
        <View style={s.list}>
          {looksLikeUrl(q) ? (
            <Row icon="globe-outline" label={`Open ${q.trim()}`} accent onPress={() => submit(q)} />
          ) : null}
          {siteMatches.map((site) => (
            <Pressable key={'site' + site.host} style={s.row} onPress={() => submit(site.url)}>
              <Image source={{ uri: faviconFor(site.host) }} style={s.fav} />
              <View style={{ flex: 1 }}>
                <Text style={s.rowText} numberOfLines={1}>{site.title || prettyHost(site.host)}</Text>
                <Text style={s.rowSub} numberOfLines={1}>{prettyHost(site.host)}</Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={C.sub} />
            </Pressable>
          ))}
          {sugs.map((sg) => (
            <Row key={'q' + sg} icon="search-outline" label={sg} onPress={() => submit(sg)} />
          ))}
          {!looksLikeUrl(q) && !sugs.includes(q.trim()) ? (
            <Row icon="logo-google" label={`Search “${q.trim()}”`} onPress={() => submit(q)} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Row({ icon, label, onPress, accent }) {
  return (
    <Pressable style={({ pressed }) => [s.row, pressed && { backgroundColor: C.card }]} onPress={onPress}>
      <Ionicons name={icon} size={17} color={accent ? C.accent2 : C.sub} style={{ width: 22 }} />
      <Text style={[s.rowText, { flex: 1 }]} numberOfLines={1}>{label}</Text>
      <Ionicons name="arrow-up-outline" size={15} color={C.dim} style={{ transform: [{ rotate: '-45deg' }] }} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 52,
  },
  boxFocused: { borderColor: 'rgba(34,211,238,0.6)', backgroundColor: 'rgba(34,211,238,0.06)' },
  input: { flex: 1, color: C.text, fontSize: 16 },
  list: {
    marginTop: 8,
    backgroundColor: C.bg2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    overflow: 'hidden',
    paddingVertical: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  rowText: { color: C.text, fontSize: 15 },
  rowSub: { color: C.sub, fontSize: 12, marginTop: 1 },
  fav: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#fff' },
});
