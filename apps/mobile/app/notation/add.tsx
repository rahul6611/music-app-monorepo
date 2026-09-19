import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getOrCreateNotationDocId, getRaagNotationById, updateRaagNotation } from '@music-app/firebase';
import { useNotationStore, type NotationTab } from '@music-app/store';
import { DEFAULT_LINE_TYPES, SONG_LINE_TYPES, flattenParsedTokens, getFingerPresets, getStrokePresets, parseLyricsMusicInput, parseNestedMusicInput, parsePercussionBolInput, parseStrokeMusicInput, type ParsedPhraseCell } from '@music-app/utils';
import BolKeyboard, { BolHeaderControls } from '../../components/notation/BolKeyboard';
import NotationFooter from '../../components/notation/NotationFooter';
import NotationGrid, { type NotationGridInputs, type NotationPhraseRange } from '../../components/notation/NotationGrid';
import NotationSymbolModal from '../../components/notation/NotationSymbolModal';
import SwarKeyboard from '../../components/notation/SwarKeyboard';
import { getNotationPositions, moveNotationPosition } from '@music-app/utils';
import { useUserPreferences } from '../../hooks/useUserPreferences';

import { Image } from 'react-native';

const swarIcon = require('../../assets/notation/Group.png');
const strokeIcon = require('../../assets/notation/solar_keyboard-linear.png');
const fingerIcon = require('../../assets/notation/Group 939.png');
const lyricsIcon = require('../../assets/notation/solar_keyboard-linear (1).png');
const percussionIcon = require('../../assets/notation/Group 941.png');

type Dropdown = 'line' | 'start' | 'beats' | null;
const BEAT_OPTIONS = [4, 6, 7, 8, 10, 12, 14, 16];
const TAB_META: Array<{ tab: NotationTab; label: string; image: any }> = [
  { tab: 'swar', label: 'Swar', image: swarIcon },
  { tab: 'stroke', label: 'Stroke', image: strokeIcon },
  { tab: 'finger', label: 'Finger', image: fingerIcon },
  { tab: 'lyrics', label: 'Lyrics', image: lyricsIcon },
  { tab: 'bol', label: 'Tabla', image: percussionIcon },
  { tab: 'pakhawajBol', label: 'Pakhawaj', image: percussionIcon },
  { tab: 'mridangamBol', label: 'Mridangam', image: percussionIcon },
];

function parserFor(tab: NotationTab, value: string) {
  if (tab === 'swar') return parseNestedMusicInput(value);
  if (['bol', 'pakhawajBol', 'mridangamBol'].includes(tab)) return parsePercussionBolInput(value);
  if (tab === 'lyrics') return parseLyricsMusicInput(value);
  return parseStrokeMusicInput(value);
}

function currentSegment(text: string, cursor: number) {
  const parts = text.split(','); let offset = 0;
  for (let index = 0; index < parts.length; index += 1) { if (cursor <= offset + parts[index].length) return index; offset += parts[index].length + 1; }
  return Math.max(0, parts.length - 1);
}

type StoredNotationField = 'explicitSwarSplit' | 'swar' | 'tabla' | 'lyric' | 'stroke' | 'pakhawaj' | 'mridangam' | 'finger' | 'layakari';

function reconstructStoredText(rows: any[], field: StoredNotationField, beatsPerCycle: number, startBeat: number) {
  const entries: any[] = [];
  let accumulatedBeat = 0;
  rows.forEach(row => {
    (row?.entries || []).forEach((entry: any) => {
      const cyclePosition = ((Number(entry.absoluteBeat || entry.beat || 1) - 1) % beatsPerCycle) + 1;
      entries.push({ ...entry, absoluteBeat: accumulatedBeat + cyclePosition });
    });
    accumulatedBeat += beatsPerCycle;
  });
  entries.sort((a, b) => a.absoluteBeat - b.absoluteBeat);
  if (!entries.length) return '';
  const lastBeat = Math.max(startBeat, Number(entries[entries.length - 1].absoluteBeat || startBeat));
  const parts: string[] = [];
  let beat = 1;
  while (beat <= lastBeat) {
    if (beat < startBeat) { parts.push(''); beat += 1; continue; }
    const entry = entries.find(value => Number(value.absoluteBeat) === beat);
    if (!entry) { parts.push(''); beat += 1; continue; }
    const value = String(field === 'lyric' ? (entry.lyric || entry.lyrics || '') : (entry[field] || ''));
    parts.push(value);
    const spanMatch = (field === 'explicitSwarSplit' ? String(entry.swar || '') : value).match(/\/(\d+)/);
    const span = spanMatch ? Math.max(1, Number(spanMatch[1]) || 1) : 1;
    beat += span;
  }
  while (parts.length && parts[parts.length - 1] === '') parts.pop();
  return parts.join(', ');
}

function DropdownField({ label, value, open, onToggle, options, onSelect }: { label: string; value: string; open: boolean; onToggle: () => void; options: string[]; onSelect: (value: string) => void }) {
  return <View style={[styles.field, open && styles.fieldRaised]}><Text style={styles.fieldLabel}>{label}</Text><TouchableOpacity style={styles.select} onPress={onToggle}><Text style={styles.selectText} numberOfLines={1}>{value}</Text><Feather name={open ? 'chevron-up' : 'chevron-down'} size={14} color="#666" /></TouchableOpacity>{open && <View style={styles.dropdown}><ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">{options.map(option => <TouchableOpacity key={option} style={styles.dropdownItem} onPress={() => onSelect(option)}><Text style={[styles.dropdownText, option === value && styles.dropdownSelected]}>{option}</Text></TouchableOpacity>)}</ScrollView></View>}</View>;
}

export default function AddNotation() {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const params = useLocalSearchParams<{ raagId?: string; collectionName?: string; isSong?: string; compositionEntryId?: string; notationId?: string; taalName?: string; beats?: string }>();
  const store = useNotationStore();
  const { musicSubStyleTypes, primaryInstrument } = useUserPreferences();
  const [dropdown, setDropdown] = useState<Dropdown>(null);
  const [symbolsOpen, setSymbolsOpen] = useState(false);
  const dotted = false;
  const [targetDocId, setTargetDocId] = useState<string | null>(params.notationId ?? (params.compositionEntryId ? `gatBandish_${params.compositionEntryId}` : null));
  const [baseRows, setBaseRows] = useState<any[]>([]);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [phraseRanges, setPhraseRanges] = useState<NotationPhraseRange[]>([]);
  const [isPhraseSelectionMode, setIsPhraseSelectionMode] = useState(false);
  const [phraseDraft, setPhraseDraft] = useState<{ startBeat: number | null; endBeat: number | null } | null>(null);
  const [bolManagerOpen, setBolManagerOpen] = useState(false);
  const sessionPhraseId = useRef(`mobile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).current;
  const initialized = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelAnim = useRef(new Animated.Value(1)).current;
  const initialRowsLoaded = useRef(false);

  const { activeTab, setActiveTab, isMenuView, setIsMenuView, beatsPerCycle, setBeatsPerCycle, startBeat, setStartBeat, selectedLineType, setSelectedLineType, swarText, strokeText, lyricsText, bolText, pakhawajBolText, mridangamBolText, fingerText, layakariText, getActiveText, setActiveText, cursorPositions, setCursorPosition, showSwarEffects, setShowSwarEffects, clearAll } = store;
  const isSong = params.isSong === 'true';
  const lineOptions = isSong ? SONG_LINE_TYPES : DEFAULT_LINE_TYPES;
  const instrumentHints = useMemo(() => [primaryInstrument, ...musicSubStyleTypes].map(value => value.toLowerCase()), [musicSubStyleTypes, primaryInstrument]);
  const hasInstrument = useCallback((name: string) => instrumentHints.some(value => value === name || value.includes(name)), [instrumentHints]);
  const isSitar = hasInstrument('sitar');
  const isRudraVeena = hasInstrument('rudra veena');
  const isStringEffectInstrument = isSitar || isRudraVeena;
  const strokePresets = useMemo(() => getStrokePresets(instrumentHints), [instrumentHints]);
  const fingerPresets = useMemo(() => getFingerPresets(instrumentHints), [instrumentHints]);

  useEffect(() => {
    if (initialized.current) return; initialized.current = true; clearAll(); setIsMenuView(true);
    const requestedBeats = Number(params.beats); if (BEAT_OPTIONS.includes(requestedBeats)) setBeatsPerCycle(requestedBeats);
  }, [clearAll, params.beats, setBeatsPerCycle, setIsMenuView]);

  useEffect(() => { Animated.spring(panelAnim, { toValue: isMenuView ? 1 : 0, useNativeDriver: true, damping: 20, stiffness: 180 }).start(); }, [isMenuView, panelAnim]);

  useEffect(() => {
    if (!params.raagId) return;
    let cancelled = false;
    (async () => {
      const id = targetDocId || await getOrCreateNotationDocId(params.raagId!, params.collectionName || 'raags');
      if (cancelled) return; setTargetDocId(id);
      const existing = await getRaagNotationById(params.raagId!, id, params.collectionName || 'raags');
      if (!cancelled) {
        const data: any = existing?.notationData || {};
        const rows = Array.isArray(data.notationRows) ? data.notationRows : [];
        // compositionEntryId only identifies which composition owns the notation
        // document. The Add Notation action supplies it as well, so it must not be
        // treated as a request to restore the existing notation into the editor.
        // Only an explicit notationId opens the editor in edit mode.
        const editingExisting = !!params.notationId;
        setBaseRows(editingExisting ? [] : rows);
        const restoredPhraseRanges: NotationPhraseRange[] = rows
          .flatMap((row: any): unknown[] => Array.isArray(row?.phraseRanges) ? row.phraseRanges : [])
          .filter((range: unknown): range is NotationPhraseRange => {
            if (!range || typeof range !== 'object') return false;
            const candidate = range as Partial<NotationPhraseRange>;
            return typeof candidate.id === 'string' && Number.isFinite(candidate.startBeat) && Number.isFinite(candidate.endBeat);
          });
        setPhraseRanges(editingExisting
          ? Array.from(new Map(restoredPhraseRanges.map(range => [range.id, range] as const)).values())
          : []);
        if (editingExisting && rows.length) {
          const cycle = Number(data.beatsPerCycle) || beatsPerCycle;
          const firstBeat = Number(data.startBeat) || startBeat;
          setBeatsPerCycle(cycle);
          setStartBeat(firstBeat);
          if (data.selectedLineType) setSelectedLineType(data.selectedLineType);
          const restored = {
            swar: reconstructStoredText(rows, 'swar', cycle, firstBeat),
            stroke: reconstructStoredText(rows, 'stroke', cycle, firstBeat),
            lyrics: reconstructStoredText(rows, 'lyric', cycle, firstBeat),
            tabla: reconstructStoredText(rows, 'tabla', cycle, firstBeat),
            pakhawaj: reconstructStoredText(rows, 'pakhawaj', cycle, firstBeat),
            mridangam: reconstructStoredText(rows, 'mridangam', cycle, firstBeat),
            finger: reconstructStoredText(rows, 'finger', cycle, firstBeat),
            layakari: reconstructStoredText(rows, 'layakari', cycle, firstBeat),
          };
          store.setSwarText(restored.swar); store.setStrokeText(restored.stroke); store.setLyricsText(restored.lyrics);
          // Persist explicit mode separately; normal multi-note beats are not splits.
          reconstructStoredText(rows, 'explicitSwarSplit', cycle, firstBeat).split(',').forEach((flag, index) => {
            if (flag.trim() === 'true') store.setExplicitSwarSplit(index, true);
          });
          store.setBolText(restored.tabla); store.setPakhawajBolText(restored.pakhawaj); store.setMridangamBolText(restored.mridangam);
          store.setFingerText(restored.finger); store.setLayakariText(restored.layakari);
          (Object.entries({ swar: restored.swar, stroke: restored.stroke, lyrics: restored.lyrics, bol: restored.tabla, pakhawajBol: restored.pakhawaj, mridangamBol: restored.mridangam, finger: restored.finger, layakari: restored.layakari }) as Array<[NotationTab, string]>).forEach(([tab, value]) => setCursorPosition(tab, value.length));
        }
        initialRowsLoaded.current = true;
      }
    })().catch(error => { console.error(error); setSaveState('error'); });
    return () => { cancelled = true; };
  }, [params.raagId, params.collectionName, params.compositionEntryId, params.notationId, targetDocId]);

  const inputs = useMemo<NotationGridInputs>(() => ({ swar: swarText, stroke: strokeText, lyrics: lyricsText, tabla: bolText, pakhawaj: pakhawajBolText, mridangam: mridangamBolText, finger: fingerText, layakari: layakariText }), [swarText, strokeText, lyricsText, bolText, pakhawajBolText, mridangamBolText, fingerText, layakariText]);
  const activeText = getActiveText();
  const activeCells = useMemo(() => parserFor(activeTab, activeText), [activeTab, activeText]);
  const activeSegment = currentSegment(activeText, cursorPositions[activeTab]);
  const currentBeat = (activeCells[activeSegment]?.beatIndex ?? activeSegment + 1) + startBeat - 1;
  const meaningful = Object.values(inputs).some(value => value.replace(/[\s,]/g, '').length > 0);
  const isPercussionTab = ['bol', 'pakhawajBol', 'mridangamBol'].includes(activeTab);
  const editorPanelHeight = Math.min(
    activeTab === 'swar' && showSwarEffects
      ? Math.max(370, windowHeight * 0.48)
      : isPercussionTab
        ? Math.max(340, windowHeight * 0.44)
        : Math.max(300, windowHeight * 0.39),
    Math.max(300, windowHeight - 210),
  );

  const prepareRows = useCallback(() => {
    const maps: Record<keyof NotationGridInputs, ParsedPhraseCell[]> = {
      swar: parseNestedMusicInput(inputs.swar), stroke: parseStrokeMusicInput(inputs.stroke), lyrics: parseLyricsMusicInput(inputs.lyrics), tabla: parsePercussionBolInput(inputs.tabla),
      pakhawaj: parsePercussionBolInput(inputs.pakhawaj), mridangam: parsePercussionBolInput(inputs.mridangam), finger: parseStrokeMusicInput(inputs.finger), layakari: parseStrokeMusicInput(inputs.layakari),
    };
    const byBeat = new Map<number, any>();
    const storedField: Record<string, string> = { lyrics: 'lyric' };
    Object.entries(maps).forEach(([field, cells]) => cells.forEach((cell, segmentIndex) => { const value = flattenParsedTokens(cell.data); if (!value) return; const absoluteBeat = cell.beatIndex + startBeat - 1; const entry = byBeat.get(absoluteBeat) ?? { phraseId: sessionPhraseId, absoluteBeat, beat: ((absoluteBeat - 1) % beatsPerCycle) + 1 }; entry[storedField[field] || field] = value; if (field === 'swar') entry.explicitSwarSplit = !!store.explicitSwarSplits[segmentIndex]; byBeat.set(absoluteBeat, entry); }));
    const entries = Array.from(byBeat.values()).sort((a, b) => a.absoluteBeat - b.absoluteBeat);
    const rowCount = entries.length ? Math.ceil(entries[entries.length - 1].absoluteBeat / beatsPerCycle) : 0;
    return Array.from({ length: rowCount }, (_, index) => ({ index: baseRows.length + index, phraseId: sessionPhraseId, sectionLabel: selectedLineType, entries: entries.filter(entry => entry.absoluteBeat > index * beatsPerCycle && entry.absoluteBeat <= (index + 1) * beatsPerCycle), phraseRanges: index === 0 ? phraseRanges : [] }));
  }, [baseRows.length, beatsPerCycle, inputs, phraseRanges, selectedLineType, sessionPhraseId, startBeat, store.explicitSwarSplits]);

  const save = useCallback(async () => {
    if (!meaningful) return true;
    if (!params.raagId || !targetDocId || !initialRowsLoaded.current) return false;
    setSaveState('saving');
    try {
      const sessionRows = prepareRows();
      await updateRaagNotation(params.raagId, targetDocId, { beatsPerCycle, selectedLineType, startBeat, showDottedNoteSeparators: dotted, sectionLabels: { [sessionPhraseId]: selectedLineType }, compositionEntryId: params.compositionEntryId, notationRows: [...baseRows, ...sessionRows] }, params.collectionName || 'raags');
      setSaveState('saved');
      return true;
    } catch (error) { console.error('Unable to save notation', error); setSaveState('error'); return false; }
  }, [baseRows, beatsPerCycle, dotted, meaningful, params.collectionName, params.compositionEntryId, params.raagId, prepareRows, selectedLineType, sessionPhraseId, startBeat, targetDocId]);

  useEffect(() => { if (!meaningful) return; setSaveState('idle'); if (saveTimer.current) clearTimeout(saveTimer.current); saveTimer.current = setTimeout(save, 300); return () => { if (saveTimer.current) clearTimeout(saveTimer.current); }; }, [meaningful, inputs, phraseRanges, beatsPerCycle, selectedLineType, startBeat, dotted, save]);

  const goBack = async () => { const saved = await save(); if (!saved) Alert.alert('Save failed', 'Your notation could not be saved. Please check your connection and try again.'); else router.back(); };
  const openTab = (tab: NotationTab) => { setBolManagerOpen(false); setActiveTab(tab); setIsMenuView(false); };
  const jumpBeat = (direction: 'prev' | 'next') => {
    if (activeTab === 'swar') {
      const next = moveNotationPosition(activeText, cursorPositions.swar,
        { subIndex: store.swarSubIndex, kanIndex: store.swarKanSubIndex }, store.explicitSwarSplits, direction);
      setActiveText(next.text);
      setCursorPosition('swar', next.cursor);
      store.setSwarSubIndex(next.subIndex);
      store.setSwarKanSubIndex(next.kanIndex);
      return;
    }
    const parts = activeText.split(',');
    const index = currentSegment(activeText, cursorPositions[activeTab]);
    const target = Math.max(0, index + (direction === 'prev' ? -1 : 1));
    while (parts.length <= target) parts.push('');
    setActiveText(parts.join(','));
    setCursorPosition(activeTab, parts.slice(0, target).reduce((sum, part) => sum + part.length + 1, 0) + parts[target].length);
  };
  const selectBeat = (beat: number) => {
    const parsedIndex = activeCells.findIndex(cell => cell.beatIndex + startBeat - 1 === beat);
    const target = parsedIndex >= 0 ? parsedIndex : Math.max(0, beat - startBeat);
    const parts = activeText.split(',');
    while (parts.length <= target) parts.push('');
    setActiveText(parts.join(','));
    setCursorPosition(activeTab, parts.slice(0, target).reduce((sum, part) => sum + part.length + 1, 0) + parts[target].length);
    const positions = getNotationPositions(parts[target], !!store.explicitSwarSplits[target]);
    const selected = positions[positions.length - 1];
    store.setSwarSubIndex(selected?.subIndex ?? null);
    store.setSwarKanSubIndex(selected?.kanIndex ?? null);
  };
  const beginPhraseSelection = () => { setIsPhraseSelectionMode(true); setPhraseDraft({ startBeat: null, endBeat: null }); };
  const cancelPhraseSelection = () => { setIsPhraseSelectionMode(false); setPhraseDraft(null); };
  const selectPreviewBeat = (beat: number) => {
    if (!isPhraseSelectionMode) { selectBeat(beat); return; }
    setPhraseDraft(current => {
      if (!current || current.startBeat === null) return { startBeat: beat, endBeat: null };
      if (current.endBeat === null) return beat === current.startBeat ? { startBeat: null, endBeat: null } : { startBeat: current.startBeat, endBeat: beat };
      const low = Math.min(current.startBeat, current.endBeat);
      const high = Math.max(current.startBeat, current.endBeat);
      return beat >= low && beat <= high ? { startBeat: null, endBeat: null } : { startBeat: current.startBeat, endBeat: beat };
    });
  };
  const finishPhraseSelection = () => {
    if (phraseDraft?.startBeat == null || phraseDraft.endBeat == null) return;
    const palette = ['#8b5cf6', '#0ea5e9'];
    setPhraseRanges(current => [...current, {
      id: `phrase-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      startBeat: Math.min(phraseDraft.startBeat!, phraseDraft.endBeat!),
      endBeat: Math.max(phraseDraft.startBeat!, phraseDraft.endBeat!),
      color: palette[current.length % palette.length],
    }]);
    cancelPhraseSelection();
  };
  const visiblePhraseRanges = useMemo<NotationPhraseRange[]>(() => {
    if (!isPhraseSelectionMode || phraseDraft?.startBeat == null) return phraseRanges;
    const endBeat = phraseDraft.endBeat ?? phraseDraft.startBeat;
    return [...phraseRanges, { id: 'phrase-draft', startBeat: Math.min(phraseDraft.startBeat, endBeat), endBeat: Math.max(phraseDraft.startBeat, endBeat), color: '#8b5cf6', isDraft: true }];
  }, [isPhraseSelectionMode, phraseDraft, phraseRanges]);
  const clearBeat = () => { if (activeTab === 'swar') store.setExplicitSwarSplit(currentSegment(activeText, cursorPositions.swar), false); const parts = activeText.split(','); const index = currentSegment(activeText, cursorPositions[activeTab]); parts[index] = ''; const next = parts.join(','); setActiveText(next); setCursorPosition(activeTab, parts.slice(0, index).reduce((sum, part) => sum + part.length + 1, 0)); store.setSwarSubIndex(null); store.setSwarKanSubIndex(null); };
  const isBolTab = ['bol', 'pakhawajBol', 'mridangamBol'].includes(activeTab);
  const insert = (value: string) => { const position = cursorPositions[activeTab]; const next = activeText.slice(0, position) + value + activeText.slice(position); setActiveText(next); setCursorPosition(activeTab, position + value.length); };

  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.appBar}><TouchableOpacity onPress={goBack}><Feather name="menu" size={24} color="#fff" /></TouchableOpacity><Text style={styles.appTitle}>Music App</Text><Feather name="user" size={23} color="#fff" /></View>
    <View style={styles.preview}><View style={styles.previewHeader}><Text style={styles.previewTitle}>Preview</Text></View><NotationGrid explicitSplitSegments={store.explicitSwarSplits} inputs={inputs} bolLanguage={store.bolLanguage} activeBeatIndex={currentBeat} activeSubSplitIndex={activeTab === 'swar' ? store.swarSubIndex : null} activeKanSubSplitIndex={activeTab === 'swar' ? store.swarKanSubIndex : null} beatsPerCycle={beatsPerCycle} startBeat={startBeat} sectionLabel={selectedLineType} taalName={params.taalName || 'Teental'} dottedSeparators={false} phraseRanges={visiblePhraseRanges} phraseSelectionMode={isPhraseSelectionMode} onBeatClick={selectPreviewBeat} onSubSplitClick={(subIndex, kanSubIndex) => { if (activeTab !== 'swar' || isPhraseSelectionMode) return; store.setSwarSubIndex(subIndex); store.setSwarKanSubIndex(kanSubIndex ?? null); }} />{saveState !== 'idle' && <View style={styles.saveChip}><Text style={[styles.saveText, saveState === 'error' && styles.errorText]}>{saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? '✓ Saved' : 'Save failed'}</Text></View>}</View>
    <Animated.View style={[styles.card, !isMenuView && styles.editorCard, !isMenuView && { maxHeight: editorPanelHeight }]}>
      {isMenuView ? <>
        <View style={styles.cardTop}><TouchableOpacity onPress={goBack} style={styles.back}><Feather name="chevron-left" size={27} color="#242830" /></TouchableOpacity><TouchableOpacity onPress={() => setSymbolsOpen(true)} style={styles.symbolLink}><Feather name="help-circle" size={15} color="#286bd6" /><Text style={styles.symbolText}>Symbols</Text></TouchableOpacity></View>
        <View style={styles.fields}><DropdownField label="Line:" value={selectedLineType} open={dropdown === 'line'} onToggle={() => setDropdown(dropdown === 'line' ? null : 'line')} options={lineOptions} onSelect={value => { setSelectedLineType(value); setDropdown(null); }} /><DropdownField label="Start Beat:" value={String(startBeat)} open={dropdown === 'start'} onToggle={() => setDropdown(dropdown === 'start' ? null : 'start')} options={Array.from({ length: beatsPerCycle }, (_, index) => String(index + 1))} onSelect={value => { setStartBeat(Number(value)); setDropdown(null); }} /><DropdownField label="Beats/Cycle:" value={String(beatsPerCycle)} open={dropdown === 'beats'} onToggle={() => setDropdown(dropdown === 'beats' ? null : 'beats')} options={BEAT_OPTIONS.map(String)} onSelect={value => { setBeatsPerCycle(Number(value)); if (startBeat > Number(value)) setStartBeat(1); setDropdown(null); }} /></View>
        <ScrollView contentContainerStyle={styles.menuGrid}>{TAB_META.map(item => <TouchableOpacity key={item.tab} style={styles.menuButton} onPress={() => openTab(item.tab)}><View style={styles.menuIcon}><Image source={item.image} style={styles.menuImage} /></View><Text style={styles.menuLabel}>{item.label}</Text></TouchableOpacity>)}</ScrollView>
      </> : <>
        <View style={styles.editorHeader}><TouchableOpacity style={styles.editorBack} onPress={() => setIsMenuView(true)}><Feather name="chevron-left" size={26} color="#242830" /><Text numberOfLines={1} style={styles.editorTitle}>{TAB_META.find(item => item.tab === activeTab)?.label ?? 'Swar'}</Text></TouchableOpacity><View style={styles.actions}>{isBolTab && <BolHeaderControls onManagePress={() => setBolManagerOpen(true)} />}<TouchableOpacity style={styles.action} onPress={clearBeat}><Feather name="refresh-cw" size={15} color="#818993" /><Text style={styles.clear}>Clear</Text></TouchableOpacity>{activeTab === 'swar' && <TouchableOpacity style={[styles.action, showSwarEffects && styles.actionActive]} onPress={() => setShowSwarEffects(!showSwarEffects)} accessibilityState={{ selected: showSwarEffects }}><MaterialCommunityIcons name="music-note" size={18} color={showSwarEffects ? '#fff' : '#4c6fe7'} /><Text style={[styles.effects, showSwarEffects && styles.effectsActive]}>Effects</Text></TouchableOpacity>}</View></View>
        <ScrollView style={styles.keyboardScroll} contentContainerStyle={styles.keyboard} keyboardShouldPersistTaps="handled">
          {activeTab === 'swar' && <SwarKeyboard currentBeatIndex={currentBeat} phraseSelectionMode={isPhraseSelectionMode} phraseDraft={phraseDraft} onBeginPhrase={beginPhraseSelection} onFinishPhrase={finishPhraseSelection} onCancelPhrase={cancelPhraseSelection} showStringInstrumentEffects={isStringEffectInstrument} />}
          {activeTab === 'bol' && <BolKeyboard instrument="tabla" managerOpen={bolManagerOpen} onManagerOpenChange={setBolManagerOpen} />}{activeTab === 'pakhawajBol' && <BolKeyboard instrument="pakhawaj" managerOpen={bolManagerOpen} onManagerOpenChange={setBolManagerOpen} />}{activeTab === 'mridangamBol' && <BolKeyboard instrument="mridangam" managerOpen={bolManagerOpen} onManagerOpenChange={setBolManagerOpen} />}
          {activeTab === 'stroke' && <View style={styles.compactKeyboard}><View style={styles.pills}>{strokePresets.map(preset => <TouchableOpacity key={preset.label} style={styles.pill} onPress={() => insert(preset.value)}><Text style={styles.pillText}>{preset.label}</Text></TouchableOpacity>)}</View></View>}
          {activeTab === 'finger' && <View style={styles.compactKeyboard}><View style={styles.pills}>{fingerPresets.map(value => <TouchableOpacity key={value} style={styles.pill} onPress={() => insert(`${value} `)}><Text style={styles.pillText}>{value}</Text></TouchableOpacity>)}</View></View>}
          {activeTab === 'lyrics' && <TextInput autoFocus style={styles.lyrics} value={lyricsText} placeholder="Type lyrics here..." onChangeText={value => { store.setLyricsText(value); setCursorPosition('lyrics', value.length); }} onSelectionChange={event => setCursorPosition('lyrics', event.nativeEvent.selection.start)} />}
        </ScrollView><NotationFooter onJumpBeat={jumpBeat} />
      </>}
    </Animated.View>
    <NotationSymbolModal isOpen={symbolsOpen} onClose={() => setSymbolsOpen(false)} isSitar={isStringEffectInstrument} />
  </KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1f1e2c' }, screen: { flex: 1, backgroundColor: '#e5eaed' }, appBar: { height: 64, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 24, backgroundColor: '#1f1e2c', elevation: 4 }, appTitle: { flex: 1, color: '#fff', fontSize: 20, fontWeight: '800' },
  preview: { flex: 1, paddingHorizontal: 11, paddingTop: 12 }, previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }, previewTitle: { fontSize: 15, fontWeight: '800', color: '#30343a' }, saveChip: { position: 'absolute', right: 16, bottom: 12, backgroundColor: 'rgba(255,255,255,.9)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 }, saveText: { color: '#16835b', fontSize: 11, fontWeight: '700' }, errorText: { color: '#d23c3c' },
  card: { maxHeight: '58%', minHeight: 270, backgroundColor: '#f4f6f9', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 12, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 8 : 5, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: .08, shadowRadius: 12, elevation: 12, overflow: 'hidden' }, editorCard: { flexShrink: 0, minHeight: 0 }, cardTop: { height: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { width: 32 }, symbolLink: { flexDirection: 'row', alignItems: 'center', gap: 4 }, symbolText: { color: '#286bd6', fontSize: 12, fontWeight: '600' },
  fields: { flexDirection: 'row', gap: 10, zIndex: 20, marginTop: 5, marginBottom: 11 }, field: { flex: 1 }, fieldRaised: { zIndex: 100 }, fieldLabel: { fontSize: 12, fontWeight: '600', color: '#4a5058', marginBottom: 5 }, select: { height: 44, borderWidth: 1, borderColor: '#d7dce2', borderRadius: 9, backgroundColor: '#fff', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, selectText: { flex: 1, fontSize: 14, color: '#4a4e53' }, dropdown: { position: 'absolute', top: 66, width: '100%', maxHeight: 175, backgroundColor: '#fff', borderRadius: 9, borderWidth: 1, borderColor: '#d7dce2', elevation: 12, shadowColor: '#000', shadowOpacity: .15, shadowRadius: 8 }, dropdownItem: { paddingHorizontal: 11, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#eff1f4' }, dropdownText: { fontSize: 13, color: '#3f454b' }, dropdownSelected: { color: '#526ee2', fontWeight: '800' },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 8 }, menuButton: { width: '31%', minHeight: 76, borderRadius: 14, backgroundColor: '#e2e6ef', alignItems: 'center', justifyContent: 'center', gap: 4 }, menuIcon: { height: 30, alignItems: 'center', justifyContent: 'center' }, menuImage: { width: 28, height: 28, resizeMode: 'contain' }, menuLabel: { color: '#34383f', fontSize: 12, fontWeight: '600' },
  editorHeader: { height: 42, flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 }, editorBack: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, minWidth: 0 }, editorTitle: { flexShrink: 1, fontSize: 17, fontWeight: '800', color: '#30343a' }, actions: { flexDirection: 'row', flexShrink: 1, minWidth: 0, alignItems: 'center', justifyContent: 'flex-end', gap: 3 }, action: { flexDirection: 'row', flexShrink: 0, alignItems: 'center', gap: 3, paddingHorizontal: 4, paddingVertical: 6, borderRadius: 9 }, actionActive: { backgroundColor: '#4c6fe7' }, clear: { fontSize: 11, color: '#818993', textDecorationLine: 'underline' }, effects: { fontSize: 13, color: '#4c6fe7', textDecorationLine: 'underline' }, effectsActive: { color: '#fff', textDecorationLine: 'none' }, keyboardScroll: { flexGrow: 0, flexShrink: 1, minHeight: 0 }, keyboard: { paddingVertical: 3, paddingBottom: 8 },
  compactKeyboard: { paddingTop: 2, paddingBottom: 2 }, pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, pill: { minWidth: 52, height: 44, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: .06, shadowRadius: 3 }, pillText: { fontSize: 16, fontWeight: '600' }, lyrics: { height: 46, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce0e5', paddingHorizontal: 16, paddingVertical: 10, color: '#20242a', fontSize: 15, fontWeight: '500' },
});
