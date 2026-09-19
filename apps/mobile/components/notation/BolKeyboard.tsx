import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { useNotationStore, type NotationTab } from '@music-app/store';
import { MRIDANGAM_BOL_GROUPS, PAKHAVAJ_BOL_GROUPS, TABLA_BOL_GROUPS } from '@music-app/utils';

type Instrument = 'tabla' | 'pakhawaj' | 'mridangam';
type Section = 'favorite' | 'left' | 'right' | 'both' | 'phrases';
interface Props {
  instrument: Instrument;
  managerOpen: boolean;
  onManagerOpenChange: (open: boolean) => void;
}

export function BolHeaderControls({ onManagePress }: { onManagePress: () => void }) {
  const { bolLanguage, setBolLanguage } = useNotationStore();
  return <View style={styles.headerControls}>
    <View style={styles.language}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Use English bols"
        style={[styles.languageButton, bolLanguage === 'en' && styles.languageActive]}
        onPress={() => setBolLanguage('en')}><Text numberOfLines={1} style={styles.languageText}>EN</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Use Hindi bols"
        style={[styles.languageButton, bolLanguage === 'hi' && styles.languageActive]}
        onPress={() => setBolLanguage('hi')}><Text numberOfLines={1} style={styles.languageText}>हि</Text></TouchableOpacity>
    </View>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Manage bols" style={styles.manageButton} onPress={onManagePress}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={styles.manage}>Manage Bols</Text>
    </TouchableOpacity>
  </View>;
}

export default function BolKeyboard({ instrument, managerOpen, onManagerOpenChange }: Props) {
  const { bolLanguage, bolText, setBolText, pakhawajBolText, setPakhawajBolText, mridangamBolText, setMridangamBolText, cursorPositions, setCursorPosition } = useNotationStore();
  const [section, setSection] = useState<Section>('favorite');
  const [favorites, setFavorites] = useState<string[]>(instrument === 'tabla' ? ['ghe_group:1', 'ghe_group:2'] : []);
  const [hidden, setHidden] = useState<string[]>([]);
  const groups = instrument === 'pakhawaj' ? PAKHAVAJ_BOL_GROUPS : instrument === 'mridangam' ? MRIDANGAM_BOL_GROUPS : TABLA_BOL_GROUPS;
  const storageKey = `notation-bols:${instrument}`;
  const tab: NotationTab = instrument === 'pakhawaj' ? 'pakhawajBol' : instrument === 'mridangam' ? 'mridangamBol' : 'bol';

  useEffect(() => { AsyncStorage.getItem(storageKey).then(value => { if (!value) return; const saved = JSON.parse(value); setFavorites(saved.favorites ?? []); setHidden(saved.hidden ?? []); }).catch(() => undefined); }, [storageKey]);
  const persist = (nextFavorites: string[], nextHidden: string[]) => AsyncStorage.setItem(storageKey, JSON.stringify({ favorites: nextFavorites, hidden: nextHidden })).catch(() => undefined);
  const getText = () => instrument === 'pakhawaj' ? pakhawajBolText : instrument === 'mridangam' ? mridangamBolText : bolText;
  const setText = (value: string) => instrument === 'pakhawaj' ? setPakhawajBolText(value) : instrument === 'mridangam' ? setMridangamBolText(value) : setBolText(value);
  const allBols = useMemo(() => groups.flatMap(group => [group.mainBol, ...(group.additionalBols ?? [])].map((bol, index) => ({ group, bol, key: `${group.id}:${index}` }))), [groups]);
  const visible = allBols.filter(item => !hidden.includes(item.key) && (section === 'favorite' ? favorites.includes(item.key) : item.group.section === section));

  const insert = (value: string) => { const text = getText(); const position = cursorPositions[tab]; const next = text.slice(0, position) + `${value} ` + text.slice(position); setText(next); setCursorPosition(tab, position + value.length + 1); };
  const toggleFavorite = (key: string) => { const next = favorites.includes(key) ? favorites.filter(value => value !== key) : [...favorites, key]; setFavorites(next); persist(next, hidden); };
  const toggleHidden = (key: string) => { const next = hidden.includes(key) ? hidden.filter(value => value !== key) : [...hidden, key]; setHidden(next); persist(favorites, next); };

  return <View style={styles.container}>
    <ScrollView style={styles.tabList} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{(['favorite', 'left', 'right', 'both', 'phrases'] as Section[]).map(value => <TouchableOpacity key={value} onPress={() => setSection(value)} style={[styles.tab, styles[`${value}Tab`], section === value && styles.tabActive]}><Text style={styles.tabText}>{value === 'favorite' ? '★ FAVORITE' : value.toUpperCase()}</Text></TouchableOpacity>)}</ScrollView>
    <ScrollView style={styles.bolList} contentContainerStyle={styles.bols} nestedScrollEnabled showsVerticalScrollIndicator={false}>{visible.length ? visible.map(({ bol, key }) => {
      const primary = bolLanguage === 'hi' ? bol.hi : bol.en;
      const secondary = bolLanguage === 'hi' ? bol.en : bol.hi;
      return <View key={key} style={styles.bolWrapper}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Insert ${primary}`} style={styles.bol} onPress={() => insert(primary || bol.en)} onLongPress={() => toggleFavorite(key)}>
          <View style={styles.bolContent}><Text style={[styles.bolPrimary, bolLanguage === 'hi' && styles.bolPrimaryHindi]}>{primary}</Text><Text style={styles.bolSecondary}>{secondary}</Text></View>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={favorites.includes(key) ? `Remove ${bol.en} from favorites` : `Add ${bol.en} to favorites`} hitSlop={8} style={styles.starButton} onPress={() => toggleFavorite(key)}><Text style={[styles.star, favorites.includes(key) && styles.starred]}>★</Text></TouchableOpacity>
      </View>;
    }) : <Text style={styles.empty}>{section === 'favorite' ? 'Long-press any bol to add it to Favorites.' : 'No visible bols in this section.'}</Text>}</ScrollView>
    <Modal visible={managerOpen} transparent animationType="slide" onRequestClose={() => onManagerOpenChange(false)}><View style={styles.overlay}><View style={styles.manager}><View style={styles.managerHeader}><Text style={styles.managerTitle}>Manage {instrument === 'tabla' ? 'Tabla' : instrument === 'pakhawaj' ? 'Pakhawaj' : 'Mridangam'} Bols</Text><TouchableOpacity onPress={() => onManagerOpenChange(false)}><Feather name="x" size={24} color="#222" /></TouchableOpacity></View><ScrollView>{allBols.map(({ bol, key }) => <TouchableOpacity key={key} style={styles.manageRow} onPress={() => toggleHidden(key)}><Text style={styles.manageBol}>{bol.en} · {bol.hi}</Text><Feather name={hidden.includes(key) ? 'eye-off' : 'eye'} size={19} color={hidden.includes(key) ? '#9aa0a6' : '#3567d6'} /></TouchableOpacity>)}</ScrollView></View></View></Modal>
  </View>;
}

const styles: any = StyleSheet.create({
  container: { height: 180 },
  headerControls: { flexDirection: 'row', flexShrink: 1, minWidth: 0, alignItems: 'center', gap: 4 },
  language: { flexDirection: 'row', flexShrink: 0, backgroundColor: '#e1e6ef', borderRadius: 15, padding: 2 },
  languageButton: { minWidth: 25, height: 25, paddingHorizontal: 4, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  languageActive: { backgroundColor: '#fff', elevation: 2 }, languageText: { fontSize: 11, fontWeight: '700' },
  manageButton: { minHeight: 30, flexShrink: 1, justifyContent: 'center', paddingHorizontal: 2 },
  manage: { color: '#0967b8', textDecorationLine: 'underline', fontWeight: '600', fontSize: 11 },
  tabList: { height: 42, flexGrow: 0, flexShrink: 0 },
  tabs: { gap: 8, paddingVertical: 4, paddingRight: 12, alignItems: 'center' },
  tab: { height: 34, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center' },
  tabActive: { elevation: 2, shadowColor: '#000', shadowOpacity: .12, shadowRadius: 2 },
  tabText: { fontSize: 11, fontWeight: '800' },
  favoriteTab: { backgroundColor: '#fff1ce', borderColor: '#f5a000' },
  leftTab: { backgroundColor: '#e5f0ff', borderColor: '#b5d0ff' },
  rightTab: { backgroundColor: '#dcfbe8', borderColor: '#b0ebc8' },
  bothTab: { backgroundColor: '#f5e7ff', borderColor: '#e3c4fa' },
  phrasesTab: { backgroundColor: '#fff0e4', borderColor: '#ffd0ad' },
  bolList: { flex: 1, minHeight: 0 },
  bols: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 8 },
  bolWrapper: { position: 'relative' },
  bol: { minWidth: 58, minHeight: 58, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10, backgroundColor: '#fff', elevation: 2, alignItems: 'center', justifyContent: 'center' },
  bolContent: { alignItems: 'center', justifyContent: 'center' },
  bolPrimary: { fontSize: 18, lineHeight: 22, fontWeight: '600', color: '#20242b' },
  bolPrimaryHindi: { fontSize: 20, lineHeight: 24, fontWeight: '700' },
  bolSecondary: { fontSize: 11, lineHeight: 14, fontWeight: '500', color: '#667085' },
  starButton: { position: 'absolute', top: 1, right: 3, zIndex: 3, padding: 2 },
  star: { color: '#cbd5e1', opacity: .55, fontSize: 11, lineHeight: 12 },
  starred: { color: '#ff9800' },
  empty: { color: '#7b828a', fontSize: 12, padding: 10 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.45)', justifyContent: 'flex-end' }, manager: { maxHeight: '80%', backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 24 }, managerHeader: { padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: '#e4e7eb' }, managerTitle: { fontSize: 18, fontWeight: '800' }, manageRow: { paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: '#eef0f2' }, manageBol: { fontSize: 16 },
});
