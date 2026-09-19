import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { TopArcSlur } from './MeendSlur';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import NotationViewHeader from './NotationViewHeader';
import {
  flattenParsedTokens,
  getBeatMarker,
  getBeatColor,
  getBilingualBol,
  parseLyricsMusicInput,
  parseNestedMusicInput,
  parsePercussionBolInput,
  parseStrokeMusicInput,
  parseSwarToken,
  splitKanSuperscriptLetters,
  type ParsedPhraseCell,
  type PhraseRow,
} from '@music-app/utils';

export interface NotationGridInputs {
  swar: string;
  stroke: string;
  lyrics: string;
  tabla: string;
  pakhawaj: string;
  mridangam: string;
  finger: string;
  layakari: string;
}

export interface NotationPhraseRange {
  id: string;
  startBeat: number;
  endBeat: number;
  color?: string;
  sectionIndex?: number;
  isDraft?: boolean;
}

interface Props {
  inputs: NotationGridInputs;
  activeBeatIndex?: number;
  activeSubSplitIndex?: number | null;
  activeKanSubSplitIndex?: number | null;
  bolLanguage?: 'en' | 'hi';
  explicitSplitSegments?: Record<number, boolean>;
  taalName?: string;
  beatsPerCycle?: number;
  startBeat?: number;
  sectionLabel?: string;
  dottedSeparators?: boolean;
  phraseRanges?: NotationPhraseRange[];
  phraseSelectionMode?: boolean;
  onBeatClick?: (beat: number) => void;
  onSubSplitClick?: (subIndex: number, kanSubIndex?: number) => void;
}

const EMPTY: NotationGridInputs = {
  swar: '',
  stroke: '',
  lyrics: '',
  tabla: '',
  pakhawaj: '',
  mridangam: '',
  finger: '',
  layakari: '',
};

const isPercussionKind = (kind: string) => kind === 'tabla' || kind === 'pakhawaj' || kind === 'mridangam';

export function MurkiWavyLine() {
  const [width, setWidth] = useState(0);
  return (
    <View
      pointerEvents="none"
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      style={{
        position: 'absolute',
        left: 2,
        right: 2,
        bottom: 0,
        flexDirection: 'row',
        overflow: 'hidden',
        height: 7,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {Array.from({ length: Math.ceil(width / 4.2) + 2 }).map((_, i) => {
        const isUp = i % 2 === 0;
        return (
          <View
            key={i}
            style={{
              width: 5,
              flexShrink: 0,
              height: 4,
              borderTopWidth: isUp ? 1.8 : 0,
              borderBottomWidth: isUp ? 0 : 1.8,
              borderColor: '#111827',
              borderTopLeftRadius: isUp ? 3 : 0,
              borderTopRightRadius: isUp ? 3 : 0,
              borderBottomLeftRadius: isUp ? 0 : 3,
              borderBottomRightRadius: isUp ? 0 : 3,
              marginHorizontal: -0.4,
            }}
          />
        );
      })}
    </View>
  );
}

function Note({ value, isGamak = false, active = false }: { value: string; isGamak?: boolean; active?: boolean }) {
  const bold = value.startsWith('*') || isGamak;
  const raw = value.startsWith('*') ? value.slice(1) : value;

  if (!/^(\.{1,3})?[srgmpdnSRGMPDN]['’\u030D\u0304\u0305]?(\.{1,3})?$/.test(raw)) {
    return (
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55} style={[styles.token, bold && styles.bold, active && styles.activeToken]}>
        {raw}
      </Text>
    );
  }

  const { baseNote, octaveType } = parseSwarToken(raw);
  const normalized = baseNote.replace(/[‘’ʼ′]/g, "'");
  const teevra = normalized === "M'" || normalized.includes('\u030D');
  const komal = /^[rgdn]$/.test(normalized);
  const label = teevra ? 'M' : normalized.replace(/[\u030D']/g, '');
  const above = octaveType.includes('higher');
  const below = octaveType.includes('lower');
  const dotCount = octaveType.startsWith('double') ? 2 : octaveType.startsWith('triple') ? 3 : 1;

  return (
    <View style={styles.note}>
      {above && <Text style={[styles.dot, active && styles.activeToken]}>{'•'.repeat(dotCount)}</Text>}
      {teevra && <View style={[styles.teevra, active && styles.activeMark]} />}
      <Text style={[styles.token, bold && styles.bold, active && styles.activeToken]}>{komal ? label.toUpperCase() : label}</Text>
      {komal && <View style={[styles.komal, active && styles.activeMark]} />}
      {below && <Text style={[styles.dot, active && styles.activeToken]}>{'•'.repeat(dotCount)}</Text>}
    </View>
  );
}

interface TokenRenderProps {
  data: Array<string | PhraseRow>;
  isGamak?: boolean;
  kanActive?: boolean;
  activeKanSubIndex?: number | null;
  onKanSubClick?: (subIndex: number) => void;
}

function Tokens({ data, isGamak = false, kanActive = false, activeKanSubIndex = null, onKanSubClick }: TokenRenderProps) {
  if (data.length === 1 && typeof data[0] === 'string') return <Note value={data[0]} isGamak={isGamak} />;

  return (
    <View style={styles.tokenRow}>
      {data.map((item, index) => {
        if (typeof item === 'string') {
          const trimmed = item.trim();
          if (/^\/kh\b/i.test(trimmed)) {
            const khatkaContent = trimmed.replace(/^\/kh\b/i, '').replace(/\/\s*$/, '').trim() || '-';
            const swarList = khatkaContent.split(/\s+/).filter(Boolean);
            return (
              <View key={index} style={styles.khatkaContainer}>
                <Text style={styles.parenSymbol}>(</Text>
                <View style={styles.khatkaContent}>
                  {swarList.map((sw, idx) => (
                    <Note key={idx} value={sw} isGamak={isGamak} />
                  ))}
                </View>
                <Text style={styles.parenSymbol}>)</Text>
              </View>
            );
          }
          return ['/', ')', ']', '}'].includes(trimmed) ? null : (
            <Note key={`${item}-${index}`} value={item} isGamak={isGamak} />
          );
        }

        const t = item.type;

        if (t === '/md' || t === '/aa') {
          return (
            <View key={index} style={styles.meendContainer}>
              <TopArcSlur content={item.content} />
              <Tokens data={item.content} isGamak={isGamak} kanActive={kanActive} activeKanSubIndex={activeKanSubIndex} onKanSubClick={onKanSubClick} />
            </View>
          );
        }

        if (t === '/gh') {
          return (
            <View key={index} style={styles.ghasitContainer}>
              <View style={styles.ghasitLine}>
                <View style={styles.ghasitTickLeft} />
                <View style={styles.ghasitTickRight} />
              </View>
              <Tokens data={item.content} isGamak={isGamak} kanActive={kanActive} activeKanSubIndex={activeKanSubIndex} onKanSubClick={onKanSubClick} />
            </View>
          );
        }

        if (t === '(' || t === '/kh') {
          return (
            <View key={index} style={styles.khatkaContainer}>
              <Text style={styles.parenSymbol}>(</Text>
              <View style={styles.khatkaContent}>
                <Tokens data={item.content} isGamak={isGamak} kanActive={kanActive} activeKanSubIndex={activeKanSubIndex} onKanSubClick={onKanSubClick} />
              </View>
              <Text style={styles.parenSymbol}>)</Text>
            </View>
          );
        }

        if (t === '[' || t === '{') {
          return (
            <View key={index} style={styles.bracketContainer}>
              <Text style={styles.bracketSymbol}>[</Text>
              <Tokens data={item.content} isGamak={isGamak} kanActive={kanActive} activeKanSubIndex={activeKanSubIndex} onKanSubClick={onKanSubClick} />
              <Text style={styles.bracketSymbol}>]</Text>
            </View>
          );
        }

        if (t === '/kn' || t === '/k') {
          const nestedMeend = item.content.find((value): value is PhraseRow => typeof value !== 'string' && value.type === '/md');
          const collectSwars = (values: Array<string | PhraseRow>): string[] => values.flatMap(value => {
            if (typeof value === 'string') {
              const trimmed = value.trim();
              return trimmed && trimmed !== '/' ? [trimmed] : [];
            }
            return collectSwars(value.content || []);
          });
          const visible = nestedMeend
            ? collectSwars(nestedMeend.content)
            : item.content.filter((value): value is string => typeof value === 'string' && value.trim() !== '/');
          const renderKanPosition = (value: string, position: number, grace = false) => {
            const active = kanActive && activeKanSubIndex === position;
            return (
              <Pressable key={`${value}-${position}`} onPress={(event) => { event.stopPropagation(); onKanSubClick?.(position); }} style={active && styles.activeKanPosition}>
                {grace
                  ? <Text style={[styles.kanGraceText, active && styles.activeToken]}>{value}</Text>
                  : <Note value={value} isGamak={isGamak} active={active} />}
              </Pressable>
            );
          };
          if (nestedMeend) {
            const superscript = splitKanSuperscriptLetters(visible.slice(0, -1).join('') || '-');
            return (
              <View key={index} style={styles.meendContainer}>
                <TopArcSlur content={nestedMeend.content} />
                <View style={styles.kanContainer}>
                  <View style={styles.kanSuperscriptBox}>
                    {superscript.map((letter, lIdx) => renderKanPosition(letter, lIdx, true))}
                  </View>
                  {renderKanPosition(String(visible[visible.length - 1] || '-'), superscript.length)}
                </View>
              </View>
            );
          }
          if (visible.length >= 2) {
            const main = visible[visible.length - 1];
            const superRaw = visible.slice(0, -1).join('');
            const supLetters = splitKanSuperscriptLetters(superRaw);
            return (
              <View key={index} style={styles.kanContainer}>
                <View style={styles.kanSuperscriptBox}>
                  {supLetters.map((letter, lIdx) => renderKanPosition(letter, lIdx, true))}
                </View>
                {renderKanPosition(String(main), supLetters.length)}
              </View>
            );
          }
          if (visible.length === 1) {
            return (
              <View key={index} style={styles.kanContainer}>
                <View style={styles.kanSuperscriptBox}>
                  {renderKanPosition('-', 0, true)}
                </View>
                {renderKanPosition(String(visible[0]), 1)}
              </View>
            );
          }
        }

        if (t === '/gm') {
          return (
            <View key={index} style={styles.gamakContainer}>
              <Tokens data={item.content} isGamak={true} kanActive={kanActive} activeKanSubIndex={activeKanSubIndex} onKanSubClick={onKanSubClick} />
            </View>
          );
        }

        if (t === '/kh') {
          return (
            <View key={index} style={styles.khatkaContainer}>
              <Text style={styles.parenSymbol}>(</Text>
              <Tokens data={item.content} isGamak={isGamak} kanActive={kanActive} activeKanSubIndex={activeKanSubIndex} onKanSubClick={onKanSubClick} />
              <Text style={styles.parenSymbol}>)</Text>
            </View>
          );
        }

        if (t === '/mu') {
          return (
            <View key={index} style={styles.murkiContainer}>
              <Tokens data={item.content} isGamak={isGamak} kanActive={kanActive} activeKanSubIndex={activeKanSubIndex} onKanSubClick={onKanSubClick} />
              <MurkiWavyLine />
            </View>
          );
        }

        if (t === '/ch' || /^\/\d+$/.test(t)) {
          return (
            <View key={index} style={styles.chhandContainer}>
              <Tokens data={item.content} isGamak={isGamak} kanActive={kanActive} activeKanSubIndex={activeKanSubIndex} onKanSubClick={onKanSubClick} />
            </View>
          );
        }

        return <Tokens key={index} data={item.content} isGamak={isGamak} kanActive={kanActive} activeKanSubIndex={activeKanSubIndex} onKanSubClick={onKanSubClick} />;
      })}
    </View>
  );
}

function containsKan(item: string | PhraseRow): boolean {
  if (typeof item === 'string') return false;
  return item.type === '/kn' || item.type === '/k' || item.content.some(containsKan);
}

function SwarCellTokens({
  data,
  isActiveCell,
  activeSubSplitIndex,
  activeKanSubSplitIndex,
  explicitSplit,
  onSubSplitClick,
}: {
  data: Array<string | PhraseRow>;
  isActiveCell: boolean;
  activeSubSplitIndex: number | null;
  activeKanSubSplitIndex: number | null;
  explicitSplit: boolean;
  onSubSplitClick?: (subIndex: number, kanSubIndex?: number) => void;
}) {
  const numericWrapper = data.length === 1 && typeof data[0] !== 'string' && /^\/\d+$/.test(data[0].type)
    ? data[0]
    : null;
  const pieces = numericWrapper
    ? numericWrapper.content.filter(item => typeof item !== 'string' || item.trim() !== '/')
    : data;
  const showSplitPosition = isActiveCell && activeSubSplitIndex !== null && pieces.length > 1;

  return (
    <View style={styles.tokenRow}>
      {pieces.map((piece, index) => {
        const pieceHasKan = containsKan(piece);
        const activeSplit = showSplitPosition && index === activeSubSplitIndex && !pieceHasKan;
        const activeKan = isActiveCell && pieceHasKan && (!showSplitPosition || index === activeSubSplitIndex);
        return (
          <React.Fragment key={index}>
            {explicitSplit && index > 0 && (
              <View pointerEvents="none" style={styles.splitDivider}>
                {Array.from({ length: 6 }, (_, dashIndex) => <View key={dashIndex} style={styles.splitDash} />)}
              </View>
            )}
            <Pressable
              onPress={(event) => { event.stopPropagation(); onSubSplitClick?.(index, pieceHasKan ? 0 : undefined); }}
              style={[styles.activePieceBase, activeSplit && styles.activeSplitPosition]}
            >
              <Tokens
                data={[piece]}
                kanActive={activeKan}
                activeKanSubIndex={activeKanSubSplitIndex}
                onKanSubClick={(kanIndex) => onSubSplitClick?.(index, kanIndex)}
              />
            </Pressable>
          </React.Fragment>
        );
      })}
    </View>
  );
}

function PercussionCellTokens({ data, language }: { data: Array<string | PhraseRow>; language: 'en' | 'hi' }) {
  const tokens = flattenParsedTokens(data).split(/\s+/).filter(value => value && value !== '/');
  return <View style={styles.percussionRow}>{tokens.map((rawToken, index) => {
    const bold = rawToken.startsWith('*');
    const token = rawToken.replace(/^\*/, '');
    const pair = getBilingualBol(token);
    const primary = pair ? pair[language] : token;
    const secondary = pair ? pair[language === 'hi' ? 'en' : 'hi'] : '';
    return <View key={`${rawToken}-${index}`} style={styles.bilingualBol}>
      <Text style={[styles.bolPrimary, language === 'hi' && styles.bolPrimaryHindi, bold && styles.bold]}>{primary}</Text>
      {!!secondary && <Text style={styles.bolSecondary}>{secondary}</Text>}
    </View>;
  })}</View>;
}

function getCellSpan(cell: ParsedPhraseCell | undefined): number {
  if (!cell || !cell.data || cell.data.length === 0) return 1;
  const first = cell.data[0];
  if (first && typeof first !== 'string' && first.type) {
    const m = String(first.type).trim().match(/^\/(\d+)$/);
    if (m) {
      const span = parseInt(m[1], 10);
      if (Number.isFinite(span) && span > 1) return span;
    }
  }
  return 1;
}

function toMap(cells: ParsedPhraseCell[], startBeat: number) {
  const map = new Map<number, ParsedPhraseCell>();
  cells.forEach((cell) => map.set(cell.beatIndex + startBeat - 1, cell));
  return map;
}

export default function NotationGrid({
  inputs = EMPTY,
  activeBeatIndex = 1,
  activeSubSplitIndex = null,
  activeKanSubSplitIndex = null,
  bolLanguage = 'en',
  explicitSplitSegments = {},
  taalName = 'Teental',
  beatsPerCycle = 16,
  startBeat = 1,
  sectionLabel = 'Sthayi',
  dottedSeparators = false,
  phraseRanges = [],
  phraseSelectionMode = false,
  onBeatClick,
  onSubSplitClick,
}: Props) {
  const [fullscreen, setFullscreen] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const splitBeats = useMemo(() => new Set(parseNestedMusicInput(inputs.swar)
    .filter((_, index) => explicitSplitSegments[index])
    .map(cell => cell.beatIndex + startBeat - 1)), [inputs.swar, explicitSplitSegments, startBeat]);

  useEffect(() => {
    if (activeBeatIndex === undefined || activeBeatIndex === null || !scrollViewRef.current || containerWidth <= 0) return;
    const cycleBeat = ((Math.max(1, activeBeatIndex) - 1) % beatsPerCycle) + 1;
    const cellCenterX = LABEL_WIDTH + (cycleBeat - 1) * CELL + CELL / 2;
    const targetX = Math.max(0, cellCenterX - containerWidth / 2);
    scrollViewRef.current.scrollTo({ x: targetX, animated: true });
  }, [activeBeatIndex, beatsPerCycle, containerWidth, inputs]);

  const maps = useMemo(
    () => ({
      swar: toMap(parseNestedMusicInput(inputs.swar), startBeat),
      stroke: toMap(parseStrokeMusicInput(inputs.stroke), startBeat),
      lyrics: toMap(parseLyricsMusicInput(inputs.lyrics), startBeat),
      tabla: toMap(parsePercussionBolInput(inputs.tabla), startBeat),
      pakhawaj: toMap(parsePercussionBolInput(inputs.pakhawaj), startBeat),
      mridangam: toMap(parsePercussionBolInput(inputs.mridangam), startBeat),
      finger: toMap(parseStrokeMusicInput(inputs.finger), startBeat),
      layakari: toMap(parseStrokeMusicInput(inputs.layakari), startBeat),
    }),
    [inputs, startBeat]
  );
  type GridKind = keyof typeof maps;
  const visibleKinds = useMemo<GridKind[]>(() => {
    const order: GridKind[] = ['tabla', 'pakhawaj', 'mridangam', 'swar', 'lyrics', 'stroke', 'finger', 'layakari'];
    const contentful = order.filter(kind => Array.from(maps[kind].values()).some(cell => flattenParsedTokens(cell.data).trim().length > 0));
    const hasMergeTarget = contentful.includes('swar') || contentful.some(isPercussionKind);
    const rows = hasMergeTarget ? contentful.filter(kind => kind !== 'stroke' && kind !== 'finger') : contentful;
    return rows.length ? rows : ['swar'];
  }, [maps]);
  const primaryKind: GridKind = visibleKinds.includes('swar')
    ? 'swar'
    : visibleKinds.find(isPercussionKind) ?? visibleKinds[0];
  const mergeAccessories = primaryKind === 'swar' || isPercussionKind(primaryKind);
  const previewHeight = 50 + visibleKinds.length * ROW_HEIGHT;

  const renderTable = () => {
    const columns = [];
    let beat = 1;
    while (beat <= beatsPerCycle) {
      const currentBeat = beat;
      const marker = getBeatMarker(currentBeat, taalName);
      const rowCells = visibleKinds.map(kind => ({ kind, cell: maps[kind].get(currentBeat) }));
      const mergedCells = mergeAccessories ? [maps.stroke.get(currentBeat), maps.finger.get(currentBeat)] : [];
      const rawSpan = Math.max(1, ...rowCells.map(row => getCellSpan(row.cell)), ...mergedCells.map(getCellSpan));
      const effectiveSpan = Math.min(rawSpan, beatsPerCycle - currentBeat + 1);

      const beatLabel = effectiveSpan > 1
        ? `${currentBeat}-${currentBeat + effectiveSpan - 1}`
        : `${currentBeat}`;
      const isActiveCell = activeBeatIndex >= currentBeat && activeBeatIndex < currentBeat + effectiveSpan;
      const cellEndBeat = currentBeat + effectiveSpan - 1;
      const cellPhraseRanges = phraseRanges.filter(
        range => range.startBeat <= cellEndBeat && range.endBeat >= currentBeat,
      );

      columns.push(
        <View
          key={currentBeat}
          style={[
            styles.column, { height: previewHeight },
            effectiveSpan > 1 && { minWidth: CELL * effectiveSpan },
          ]}
        >
          <View
            style={[
              styles.headerCell,
              { backgroundColor: getBeatColor(currentBeat, taalName, beatsPerCycle) },
              effectiveSpan > 1 && { minWidth: CELL * effectiveSpan },
            ]}
          >
            <Text style={styles.beat}>{beatLabel}</Text>
            {marker ? <Text style={styles.marker}>{marker}</Text> : null}
          </View>

          {rowCells.map(({ kind, cell }) => {
            const strokeCell = mergeAccessories && kind === primaryKind ? maps.stroke.get(currentBeat) : undefined;
            const fingerCell = mergeAccessories && kind === primaryKind ? maps.finger.get(currentBeat) : undefined;
            // Empty inputs still have parsed cells; only entered content gets a badge.
            const strokeText = strokeCell ? flattenParsedTokens(strokeCell.data).trim() : '';
            const fingerText = fingerCell ? flattenParsedTokens(fingerCell.data).trim() : '';
            return <Pressable
              key={kind}
              onPress={() => onBeatClick?.(currentBeat)}
              style={[
                styles.cell,
                { backgroundColor: getBeatColor(currentBeat, taalName, beatsPerCycle) === '#9FA8DA' ? '#ececf6' : '#e4f4f2' },
                effectiveSpan > 1 && { minWidth: CELL * effectiveSpan },
                isActiveCell && styles.activeCell,
                phraseSelectionMode && styles.phraseSelectableCell,
              ]}
            >
              <View style={[styles.cellLine, dottedSeparators && styles.dotted]}>
                {kind === 'swar' && cell ? (
                  <SwarCellTokens
                    data={cell.data}
                    isActiveCell={isActiveCell}
                    activeSubSplitIndex={activeSubSplitIndex}
                    activeKanSubSplitIndex={activeKanSubSplitIndex}
                    explicitSplit={splitBeats.has(currentBeat)}
                    onSubSplitClick={(index, kanIndex) => {
                      onBeatClick?.(currentBeat);
                      onSubSplitClick?.(index, kanIndex);
                    }}
                  />
                ) : cell && ['tabla', 'pakhawaj', 'mridangam'].includes(kind) ? (
                  <PercussionCellTokens data={cell.data} language={bolLanguage} />
                ) : cell ? <Tokens data={cell.data} /> : null}
                {(!!strokeText || !!fingerText) && <View style={styles.mergedBadges}>
                  {!!strokeText && <View style={styles.mergedBadge}><Text style={styles.mergedBadgeText}>{strokeText}</Text></View>}
                  {!!fingerText && <View style={styles.mergedBadge}><Text style={styles.mergedBadgeText}>{fingerText}</Text></View>}
                </View>}
              </View>
            {kind === primaryKind && cellPhraseRanges.length > 0 && (
              <View pointerEvents="none" style={styles.phraseLines}>
                {cellPhraseRanges.map(range => {
                  const startsHere = range.startBeat >= currentBeat && range.startBeat <= cellEndBeat;
                  const endsHere = range.endBeat >= currentBeat && range.endBeat <= cellEndBeat;
                  return (
                    <View
                      key={range.id}
                      style={[
                        styles.phraseLine,
                        { backgroundColor: range.color || '#8b5cf6' },
                        startsHere && styles.phraseLineStart,
                        endsHere && styles.phraseLineEnd,
                        range.isDraft && styles.phraseLineDraft,
                      ]}
                    />
                  );
                })}
              </View>
            )}
          </Pressable>;
          })}
        </View>
      );

      beat += effectiveSpan;
    }

    return (
      <View style={[styles.table, { height: previewHeight }]}>
        <View style={[styles.column, { height: previewHeight }]}>
          <TouchableOpacity
            style={styles.corner}
            onPress={() => setFullscreen(true)}
            accessibilityLabel="Open full-screen notation preview"
          >
            <Feather name="maximize" size={14} color="#5d676f" />
          </TouchableOpacity>
          <View style={[styles.labelCell, { height: ROW_HEIGHT * visibleKinds.length }]}>
            <Text style={styles.label} numberOfLines={2}>
              {sectionLabel}
            </Text>
          </View>
        </View>
        {columns}
      </View>
    );
  };

  return (
    <View style={[styles.container, { height: previewHeight + 2 }]}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        contentContainerStyle={{ paddingRight: Math.max(0, containerWidth / 2 - CELL / 2) }}
      >
        {renderTable()}
      </ScrollView>

      <Modal visible={fullscreen} animationType="slide" presentationStyle="fullScreen"
        supportedOrientations={['portrait', 'landscape']} onRequestClose={() => setFullscreen(false)}>
        <SafeAreaProvider>
        <SafeAreaView style={styles.fullscreen}>
          <NotationViewHeader onClose={() => setFullscreen(false)} backgroundColor="#fff"
            color="#20232d" secondaryColor="#64748b" borderColor="#ddd" />

          <ScrollView style={{ flex: 1, minWidth: 0 }}>
            <ScrollView horizontal contentContainerStyle={styles.fullContent}>
              {renderTable()}
            </ScrollView>
          </ScrollView>
        </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </View>
  );
}

const CELL = 55;
const LABEL_WIDTH = 70;
const ROW_HEIGHT = 64;
const styles = StyleSheet.create({
  percussionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 7 },
  bilingualBol: { alignItems: 'center', justifyContent: 'center', minWidth: 20 },
  bolPrimary: { fontSize: 14, lineHeight: 17, fontWeight: '600', color: '#111' },
  bolPrimaryHindi: { fontSize: 16, lineHeight: 19, fontWeight: '700' },
  bolSecondary: { fontSize: 9, lineHeight: 11, fontWeight: '500', color: '#59616b' },
  splitDivider: { width: 1, height: 22, marginHorizontal: 4, flexShrink: 0, justifyContent: 'space-between' },
  splitDash: { width: 1, height: 2, backgroundColor: '#30343b' },
  mergedBadges: { marginTop: 3, gap: 2, alignItems: 'center', justifyContent: 'center' },
  mergedBadge: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d7dce2', borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 },
  mergedBadgeText: { color: '#28303a', fontSize: 9, lineHeight: 11, fontWeight: '600', textAlign: 'center' },
  container: {
    height: 120,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#798087',
    backgroundColor: '#fff',
  },
  table: {
    height: 118,
    flexDirection: 'row',
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  column: { height: 118, flexGrow: 0, flexShrink: 0, overflow: 'hidden' },
  corner: {
    width: LABEL_WIDTH,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#80cbc4',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#667078',
  },
  headerCell: {
    minWidth: CELL,
    height: 50,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#667078',
  },
  beat: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 13,
    color: '#101820',
  },
  marker: { fontSize: 16, fontWeight: '800', lineHeight: 17 },
  labelCell: {
    width: LABEL_WIDTH,
    height: ROW_HEIGHT,
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderColor: '#667078',
    padding: 4,
    overflow: 'hidden',
  },
  label: { fontSize: 12, fontWeight: '700', color: '#111', textAlign: 'center' },
  cell: {
    minWidth: CELL,
    height: 68,
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: 6,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderColor: '#667078',
    overflow: 'hidden',
  },
  phraseSelectableCell: { backgroundColor: 'rgba(139, 92, 246, 0.06)' },
  phraseLines: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 4,
    height: 7,
    justifyContent: 'center',
  },
  phraseLine: { height: 3, alignSelf: 'stretch' },
  phraseLineStart: { marginLeft: 8, width: undefined, borderTopLeftRadius: 3, borderBottomLeftRadius: 3 },
  phraseLineEnd: { marginRight: 8, width: undefined, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  phraseLineDraft: { opacity: 0.7 },
  activeCell: { backgroundColor: '#b9caf8' },
  cellLine: {
    minHeight: ROW_HEIGHT - 8,
    maxHeight: ROW_HEIGHT - 8,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  dotted: { borderBottomWidth: 1, borderStyle: 'dotted', borderBottomColor: '#aaa' },
  tokenRow: {
    minWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'nowrap',
    maxWidth: '100%',
    overflow: 'visible',
  },
  token: { fontSize: 14, color: '#151515', paddingHorizontal: 1, letterSpacing: 2 },
  activeToken: { color: '#fff' },
  activeMark: { backgroundColor: '#fff' },
  bold: { fontWeight: '900' },
  note: { alignItems: 'center', justifyContent: 'center', paddingVertical: 1, overflow: 'visible' },
  komal: { height: 1.5, width: 10, backgroundColor: '#111', marginTop: -1 },
  teevra: { height: 6, width: 1.5, backgroundColor: '#111', marginBottom: -1 },
  dot: { fontSize: 7, lineHeight: 7 },
  meendContainer: { alignItems: 'center', alignSelf: 'center', paddingTop: 2, paddingHorizontal: 2 },
  ghasitContainer: { alignItems: 'center', alignSelf: 'center', paddingTop: 2, paddingHorizontal: 2 },
  ghasitLine: { alignSelf: 'stretch', height: 2, backgroundColor: '#111', position: 'relative', marginBottom: 2 },
  ghasitTickLeft: { position: 'absolute', left: 0, top: 0, width: 2, height: 6, backgroundColor: '#111' },
  ghasitTickRight: { position: 'absolute', right: 0, top: 0, width: 2, height: 6, backgroundColor: '#111' },
  phraseContainer: { alignItems: 'center', alignSelf: 'center', paddingBottom: 2, paddingHorizontal: 2 },
  phraseArc: {
    alignSelf: 'stretch',
    height: 5,
    borderBottomWidth: 1.8,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#111',
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
    marginTop: 1,
  },
  bracketContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 2,
    gap: 1,
  },
  bracketSymbol: { fontSize: 16, fontWeight: '500', color: '#333' },
  kanContainer: { flexDirection: 'row', alignItems: 'flex-start', alignSelf: 'center', marginHorizontal: 2 },
  kanSuperscriptBox: { flexDirection: 'row', marginTop: -5, marginRight: 1, gap: 1 },
  kanGraceText: { fontSize: 9, fontWeight: '700', color: '#111' },
  activePieceBase: { paddingHorizontal: 3, paddingVertical: 2, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  activeSplitPosition: {
    backgroundColor: '#3b82f6',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 3,
  },
  activeKanPosition: {
    backgroundColor: '#2563eb',
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
    shadowColor: '#2563eb',
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  gamakContainer: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center' },
  khatkaContainer: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 2 },
  khatkaContent: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  parenSymbol: { fontSize: 13, fontWeight: '700', color: '#111' },
  murkiContainer: { position: 'relative', alignItems: 'center', alignSelf: 'center', paddingBottom: 9, paddingHorizontal: 2 },
  murkiLine: {
    alignSelf: 'stretch',
    height: 5,
    borderBottomWidth: 1.8,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#111',
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
    marginTop: 2,
    opacity: 0.85,
  },
  chhandContainer: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 3,
    alignItems: 'center',
  },
  fullscreen: { flex: 1, minWidth: 0, backgroundColor: '#f2f4f7' },
  fullContent: { padding: 18 },
});
