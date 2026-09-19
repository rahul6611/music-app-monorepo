import React from 'react';
import { ActivityIndicator, View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Platform, useWindowDimensions } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, useNotationStore } from '@music-app/store';

import {
  parseNestedMusicInput,
  getBeatMarker,
  getBeatColor,
  getBilingualBol,
  flattenParsedTokens,
  resolveNotationColumnWidths,
  type CellWidthRequirement,
  splitKanSuperscriptLetters,
} from '@music-app/utils';
import { MurkiWavyLine } from './NotationGrid';
import { TopArcSlur } from './MeendSlur';

const isKanSwarToken = (s: string): boolean => Boolean(s && s !== '/' && s !== ')');

interface CellProps {
  content: any[];
  isDark: boolean;
}

type NotationSystem = 'hindustani_bhatkhande' | 'paluskar' | 'carnatic';

const normalizeApostrophes = (input: string): string =>
  input.replace(/[\u2018\u2019\u02BC\u2032]/g, "'");

const capitalizeFirstLetter = (s: string) => {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const PhoneticDotChar = ({ char, color }: { char: string, color: string }) => (
  <View style={{ alignItems: 'center' }}>
    <Text style={[styles.noteText, { color }]}>{char}</Text>
    <View style={{
      width: 2.5,
      height: 2.5,
      borderRadius: 1.25,
      backgroundColor: color,
      marginTop: 2, // Added space between character and dot
    }} />
  </View>
);

const renderBolText = (raw: string, color: string): React.ReactNode => {
  if (!raw) return null;
  const text = capitalizeFirstLetter(raw);
  const dottedMap: { [key: string]: string } = {
    'ṭ': 't', 'Ṭ': 'T', 'ḍ': 'd', 'Ḍ': 'D', 'ṇ': 'n', 'Ṇ': 'N', 'ṣ': 's', 'Ṣ': 'S', 'ḷ': 'l', 'Ḷ': 'L', 'ṛ': 'r', 'Ṛ': 'R'
  };
  
  const parts: React.ReactNode[] = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (dottedMap[char]) {
      parts.push(<PhoneticDotChar key={i} char={dottedMap[char]} color={color} />);
    } else {
      parts.push(<Text key={i} style={[styles.noteText, { color }]}>{char}</Text>);
    }
  }
  return <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>{parts}</View>;
};

const renderSwarWithSystem = (
  raw: string,
  notationSystem: NotationSystem,
  isSmall: boolean = false,
  hasKan: boolean = false,
  hasPhrases: boolean = false,
  hasMeend: boolean = false
): React.ReactNode => {
  const swar = normalizeApostrophes(raw);
  const originalSwar = swar;
  const isKomal = /^[rgdn]$/.test(swar);
  const isTeevraMa = swar.toUpperCase() === "M'" || swar === "M'" || originalSwar.includes("'") || originalSwar.includes('\u030D');
  const upperSwar = swar.replace(/['\u030D]/g, '').toUpperCase();

  const swarColor = '#000000';

  if (isKomal && notationSystem !== 'carnatic') {
    return (
      <View style={{ alignItems: 'center' }}>
        <Text style={[styles.noteText, { color: swarColor, fontSize: isSmall ? 11 : 17, fontWeight: '700' }]}>{upperSwar}</Text>
        <View style={{
          width: '110%',
          height: 1.5,
          backgroundColor: swarColor,
          marginTop: 1, 
        }} />
      </View>
    );
  }

  if (isTeevraMa && upperSwar === 'M' && notationSystem !== 'carnatic') {
    return (
      <View style={{ alignItems: 'center' }}>
        <View style={{
          width: 1.8,
          height: isSmall ? 6 : 9,
          backgroundColor: swarColor,
          marginBottom: 2, 
        }} />
        <Text style={[styles.noteText, { color: swarColor, fontSize: isSmall ? 11 : 17, fontWeight: '700' }]}>M</Text>
      </View>
    );
  }

  return <Text style={[styles.noteText, { color: swarColor, fontSize: isSmall ? 11 : 17, fontWeight: '700' }]}>{upperSwar}</Text>;
};

const renderOctaveDot = (
  swarNode: React.ReactNode,
  octave: 'lower' | 'higher' | 'double-lower' | 'double-higher' | 'triple-lower' | 'triple-higher',
  isSmall: boolean = false,
) => {
  const isLower = octave.includes('lower');
  const dotsCount = octave.startsWith('triple') ? 3 : octave.startsWith('double') ? 2 : 1;
  const dotStr = '.'.repeat(dotsCount);
  const swarColor = '#000000';

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      {!isLower && (
        <Text style={{ 
          fontSize: 12, 
          color: swarColor, 
          fontWeight: 'bold', 
          lineHeight: 10,
          marginBottom: -2, 
          letterSpacing: 1
        }}>
          {dotStr}
        </Text>
      )}
      {swarNode}
      {isLower && (
        <Text style={{ 
          fontSize: 12, 
          color: swarColor, 
          fontWeight: 'bold', 
          lineHeight: 10,
          marginTop: -2, 
          letterSpacing: 1
        }}>
          {dotStr}
        </Text>
      )}
    </View>
  );
};

const renderTextPiece = (
  pieceRaw: string,
  notationSystem: NotationSystem,
  hasMeend: boolean,
  hasPhrases: boolean = false,
  isSmall: boolean = false,
  hasKan: boolean = false,
  isGamak: boolean = false,
): React.ReactNode => {
  let piece = normalizeApostrophes(pieceRaw).trim();
  if (!piece) return null;

  const isAsteriskPrefix = piece.startsWith('*') || isGamak;
  if (piece.startsWith('*')) piece = piece.substring(1).trim();
  if (!piece) return null;

  // Octave patterns
  const patterns = [
    { reg: /^\.\.\.\s*([A-Za-z]['’\u030D\u0304\u0305]?)$/, oct: 'triple-lower' },
    { reg: /^\.\.\s*([A-Za-z]['’\u030D\u0304\u0305]?)$/, oct: 'double-lower' },
    { reg: /^\.\s*([A-Za-z]['’\u030D\u0304\u0305]?)$/, oct: 'lower' },
    { reg: /^([A-Za-z]['’\u030D\u0304\u0305]?)\s*\.\.\.$/, oct: 'triple-higher' },
    { reg: /^([A-Za-z]['’\u030D\u0304\u0305]?)\s*\.\.$/, oct: 'double-higher' },
    { reg: /^([A-Za-z]['’\u030D\u0304\u0305]?)\s*\.$/, oct: 'higher' },
  ];

  for (const p of patterns) {
    const m = piece.match(p.reg);
    if (m) {
      const s = m[1];
      const swarNode = renderSwarWithSystem(s, notationSystem, isSmall, hasKan, hasPhrases, hasMeend);
      return renderOctaveDot(swarNode, p.oct as any, isSmall);
    }
  }

  if (piece === '|') {
    return <View style={{ width: 1, height: 20, backgroundColor: '#000', marginHorizontal: 4 }} />;
  }

  if (/^[A-Za-z]['’\u030D\u0304\u0305]?$/.test(piece)) {
    return renderSwarWithSystem(piece, notationSystem, isSmall, hasKan, hasPhrases, hasMeend);
  }

  return <Text style={[styles.noteText, { color: '#000' }, isAsteriskPrefix && { fontWeight: '900' }]}>{piece}</Text>;
};

const renderKanBlock = (
  superscriptRaw: string,
  mainRaw: string,
  notationSystem: NotationSystem,
  hasMeend: boolean,
  hasPhrases: boolean,
  keyPrefix: string,
  isGamak: boolean = false,
): React.ReactNode => {
  const supLetters = splitKanSuperscriptLetters(superscriptRaw);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <View style={{ flexDirection: 'row', marginTop: -4, marginRight: 1, transform: [{ scale: 0.65 }], gap: 0 }}>
        {supLetters.map((letter, idx) => (
          <View key={`${keyPrefix}-sup-${idx}`} style={{ marginLeft: idx > 0 ? -3 : 0 }}>
            {renderTextPiece(letter, notationSystem, hasMeend, hasPhrases, true, true, isGamak)}
          </View>
        ))}
      </View>
      {renderTextPiece(mainRaw, notationSystem, hasMeend, hasPhrases, false, true, isGamak)}
    </View>
  );
};

const renderToken = (
  token: any,
  notationSystem: NotationSystem,
  hasMeend: boolean = false,
  hasPhrases: boolean = false,
  isSmall: boolean = false,
  isGamak: boolean = false,
): React.ReactNode => {
  if (typeof token === 'string') {
    const trimmedToken = token.trim();
    // Closing syntax delimiters are retained in parsed content so nested groups
    // can be reconstructed when saving. They are structural, not renderable
    // notation, and reparsing "/" would otherwise recurse without making progress.
    if (['/', ')', ']', '}'].includes(trimmedToken)) return null;

    // If string contains notation markers, parse it
    if (token.includes('/') || token.includes('(')) {
       const parsed = parseNestedMusicInput(token);
       if (parsed.length > 0) {
          return (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {parsed[0].data.map((t, i) => (
                <React.Fragment key={i}>
                  {renderToken(t, notationSystem, hasMeend, hasPhrases, isSmall, isGamak)}
                </React.Fragment>
              ))}
            </View>
          );
       }
    }

    const parts = token.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return null;

    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {parts.map((p, idx) => (
          <React.Fragment key={idx}>
            {renderTextPiece(p, notationSystem, hasMeend, hasPhrases, isSmall, false, isGamak)}
          </React.Fragment>
        ))}
      </View>
    );
  }

  const t = token.type;
  const content = token.content || [];

  if (t === '/md') {
    // Meend (Smooth Top Arc Slur Curve matching screenshot ⌒)
    const validContent = content.filter((c: any) => !(typeof c === 'string' && (c.trim() === '/' || c.trim() === '')));
    return (
      <View style={{ alignItems: 'center', alignSelf: 'center', paddingTop: 2, paddingHorizontal: 2 }}>
        <TopArcSlur content={validContent} />
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 }}>
          {validContent.map((c: any, idx: number) => (
            <React.Fragment key={idx}>
              {renderToken(c, notationSystem, true, hasPhrases, isSmall)}
            </React.Fragment>
          ))}
        </View>
      </View>
    );
  }

  if (t === '/gh') {
    // Ghasit (Straight line with side ticks)
    return (
      <View style={{ alignItems: 'center', alignSelf: 'center', paddingTop: 4, paddingHorizontal: 2 }}>
        <View style={{
          alignSelf: 'stretch',
          height: 2,
          backgroundColor: '#000',
          position: 'relative',
        }}>
          {/* Side Ticks */}
          <View style={{ position: 'absolute', left: 0, top: 0, width: 2, height: 6, backgroundColor: '#000' }} />
          <View style={{ position: 'absolute', right: 0, top: 0, width: 2, height: 6, backgroundColor: '#000' }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 3 }}>
          {content.map((c: any, idx: number) => (
            <React.Fragment key={idx}>
              {renderToken(c, notationSystem, true, hasPhrases, isSmall)}
            </React.Fragment>
          ))}
        </View>
      </View>
    );
  }

  if (t === '/mu') {
    // Murki: bottom wavy sine curve matching web .notation-murki-style & Murki button icon ~~~
    const validContent = content.filter((c: any) => !(typeof c === 'string' && (c.trim() === '/' || c.trim() === '')));
    return (
      <View style={{ position: 'relative', alignItems: 'center', alignSelf: 'center', paddingBottom: 9, paddingHorizontal: 2 }}>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
          {validContent.map((c: any, idx: number) => (
            <React.Fragment key={idx}>
              {renderToken(c, notationSystem, hasMeend, hasPhrases, isSmall)}
            </React.Fragment>
          ))}
        </View>
        <MurkiWavyLine />
      </View>
    );
  }

  if (t === '/aa') {
    // Aandolan (Top arc with italic S symbol)
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 2 }}>
        <View style={{ alignItems: 'center', alignSelf: 'center' }}>
          <View style={{
            alignSelf: 'stretch',
            height: 6,
            borderTopWidth: 2,
            borderLeftWidth: 1.5,
            borderRightWidth: 1.5,
            borderColor: '#000',
            borderTopLeftRadius: 50,
            borderTopRightRadius: 50,
            marginBottom: 1,
          }} />
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {content.map((c: any, idx: number) => (
              <React.Fragment key={idx}>
                {renderToken(c, notationSystem, true, hasPhrases, isSmall)}
              </React.Fragment>
            ))}
          </View>
        </View>
        <Text style={{ fontSize: 16, fontStyle: 'italic', color: '#000', fontWeight: '400', marginLeft: 2 }}>S</Text>
      </View>
    );
  }

  if (t === '(' || t === '/kh') {
    // Khatka: parenthesized turn notation ( S R G )
    const validContent = content.filter((c: any) => !(typeof c === 'string' && (c.trim() === '/' || c.trim() === ')' || c.trim() === '(' || c.trim() === '')));
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 3 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>(</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {validContent.length === 0 ? (
            <Text style={{ opacity: 0.35, minWidth: 20, textAlign: 'center' }}>-</Text>
          ) : (
            validContent.map((c: any, idx: number) => (
              <React.Fragment key={idx}>
                {renderToken(c, notationSystem, hasMeend, hasPhrases, isSmall)}
              </React.Fragment>
            ))
          )}
        </View>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>)</Text>
      </View>
    );
  }

  if (t === '/kn' || t === '/k') {
    const swars = content
      .filter((c: unknown): c is string => typeof c === 'string')
      .map((s: string) => s.trim())
      .filter(isKanSwarToken);
    if (swars.length >= 2) {
      return renderKanBlock(
        swars.slice(0, -1).join(''),
        swars[swars.length - 1],
        notationSystem,
        hasMeend,
        hasPhrases,
        'kn',
        isGamak
      );
    }
    if (swars.length === 1) {
      return renderKanBlock('-', swars[0], notationSystem, hasMeend, hasPhrases, 'kn', isGamak);
    }
    return renderKanBlock('-', '-', notationSystem, hasMeend, hasPhrases, 'kn', isGamak);
  }

  if (t === '/gm') {
    // Gamak (Heavy Bold)
    return (
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', alignSelf: 'center' }}>
        {content.map((c: any, idx: number) => (
          <React.Fragment key={idx}>
            {renderToken(c, notationSystem, hasMeend, hasPhrases, isSmall, true)}
          </React.Fragment>
        ))}
      </View>
    );
  }

  if (t === '/th_start' || t === '/th_middle' || t === '/th_end') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {content
          .filter((c: any) => typeof c !== 'string' || c.trim() !== '/')
          .map((c: any, idx: number) => (
            <React.Fragment key={idx}>
              {renderToken(c, notationSystem, hasMeend, hasPhrases, isSmall, isGamak)}
            </React.Fragment>
          ))}
      </View>
    );
  }

  if (t === '[' || t === '{') {
    // Bracket Sub-Beat Grouping
    return (
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
      }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#333' }}>[</Text>
        <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
          {content.map((c: any, idx: number) => (
            <React.Fragment key={idx}>
              {renderToken(c, notationSystem, hasMeend, hasPhrases, isSmall)}
            </React.Fragment>
          ))}
        </View>
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#333' }}>]</Text>
      </View>
    );
  }

  if (t === '/ch') {
    // Chhand Style (Box/Bracket around notes)
    return (
      <View style={{ 
        borderWidth: 2, 
        borderColor: '#000', 
        borderRadius: 4, 
        padding: 4,
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center'
      }}>
        {content.map((c: any, idx: number) => (
          <React.Fragment key={idx}>
            {renderToken(c, notationSystem, hasMeend, hasPhrases, isSmall)}
          </React.Fragment>
        ))}
      </View>
    );
  }

  // Generic Grouping
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {content.map((c: any, idx: number) => (
        <React.Fragment key={idx}>
          {renderToken(c, notationSystem, hasMeend, hasPhrases, isSmall)}
        </React.Fragment>
      ))}
    </View>
  );
};

const BilingualBolText = ({ value, language }: { value: string; language: 'en' | 'hi' }) => {
  const pair = getBilingualBol(value);
  const primary = pair ? pair[language] : value;
  const secondary = pair ? pair[language === 'hi' ? 'en' : 'hi'] : '';
  return <View style={styles.bilingualBol}><Text style={[styles.bolPrimary, language === 'hi' && styles.bolPrimaryHindi]}>{primary}</Text>{!!secondary && <Text style={styles.bolSecondary}>{secondary}</Text>}</View>;
};

const NotationCell = ({ content, notationSystem = 'hindustani_bhatkhande', isDark, onWidth, plain = false, bilingualBol = false, bolLanguage = 'en' }: { content: any[], notationSystem?: NotationSystem, isDark?: boolean; onWidth?: (width: number) => void; plain?: boolean; bilingualBol?: boolean; bolLanguage?: 'en' | 'hi' }) => {
  const plainText = (tokens: any[]): string => tokens.map(token => typeof token === 'string'
    ? (['/', ')', ']', '}'].includes(token.trim()) ? '' : token)
    : plainText(token.content || [])).filter(Boolean).join(' ');
  const renderedContent = React.useMemo(() => bilingualBol
    ? <View style={styles.bolRow}>{plainText(content).split(/\s+/).filter(Boolean).map((token, index) => <BilingualBolText key={`${token}-${index}`} value={token.replace(/^\*/, '')} language={bolLanguage} />)}</View>
    : plain ? <Text style={styles.noteText}>{plainText(content)}</Text> : content.map((token, idx) => (
        <React.Fragment key={idx}>
          {renderToken(token, notationSystem)}
        </React.Fragment>
      )), [content, plain, bilingualBol, bolLanguage, notationSystem]);
  return (
    <View testID="notation-cell-content" style={styles.cellContent} onLayout={onWidth ? event => onWidth(event.nativeEvent.layout.width) : undefined}>
      {renderedContent}
    </View>
  );
};

interface NotationTableEnhancedProps {
  sections: Array<{
    label: string;
    rows: Array<{ key: string; cells: any[] }>;
    phraseRanges?: Array<{ id: string; startBeat: number; endBeat: number; color?: string; isDraft?: boolean }>;
  }>;
  beatsPerCycle: number;
  activeBeatIndex?: number;
  notationSystem?: string;
  taalName?: string;
  isAalap?: boolean;
  hideHeader?: boolean;
  onSectionReorder?: (fromIndex: number, toIndex: number) => void;
  onDuplicateSection?: (index: number) => void;
  onEditSection?: (index: number) => void;
  onDeleteSection?: (index: number) => void;
}


const getCellSpanFromContent = (content: any[]): number => {
  if (!content || content.length === 0) return 1;
  const first = content[0];
  if (first && typeof first === 'object' && first.type) {
    const m = String(first.type).trim().match(/^\/(\d+)$/);
    if (m) {
      const span = parseInt(m[1], 10);
      if (Number.isFinite(span) && span > 1) return span;
    }
  }
  return 1;
};

type TableRow = { key: string; cells: any[] };

const getTableRowKind = (key: string): 'swar' | 'bol' | 'stroke' | 'finger' | 'other' => {
  const normalized = key.toLowerCase();
  if (normalized === 'swar' || normalized.startsWith('swar-')) return 'swar';
  if (normalized === 'stroke' || normalized.startsWith('stroke-')) return 'stroke';
  if (normalized === 'finger' || normalized.startsWith('finger-')) return 'finger';
  if (/^(bol|tabla|pakhawaj|mridangam)/.test(normalized)) return 'bol';
  return 'other';
};

const rowHasAnyContent = (row: TableRow) => row.cells.some(cell => {
  const content = cell?.data || cell?.cells || [];
  return flattenParsedTokens(content).trim().length > 0;
});

export default function NotationTableEnhanced({ 
  sections, 
  beatsPerCycle = 16, 
  activeBeatIndex,
  taalName,
  isAalap = false,
  hideHeader = false,
  onSectionReorder,
  onDuplicateSection,
  onEditSection,
  onDeleteSection
}: NotationTableEnhancedProps) {
  const theme = useTheme();
  const bolLanguage = useNotationStore(state => state.bolLanguage);
  const isDark = theme.background === '#000000';
  const [activeMenuIndex, setActiveMenuIndex] = React.useState<number | null>(null);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const [containerWidth, setContainerWidth] = React.useState(0);
  const hasActions = Boolean(onDuplicateSection || onEditSection || onDeleteSection);
  const labelWidth = 100;
  const actionWidth = hasActions ? 40 : 0;
  const { fontScale } = useWindowDimensions();
  const [measurements, setMeasurements] = React.useState<{ scope: string; cells: Record<string, CellWidthRequirement> }>({ scope: '', cells: {} });
  const measurementScope = React.useMemo(() => JSON.stringify([sections, beatsPerCycle, fontScale]), [sections, beatsPerCycle, fontScale]);
  const columnWidths = React.useMemo(() => resolveNotationColumnWidths(
    beatsPerCycle, containerWidth - labelWidth - actionWidth,
    measurements.scope === measurementScope ? Object.values(measurements.cells) : [],
  ), [beatsPerCycle, containerWidth, actionWidth, measurements, measurementScope]);
  const contentWidth = columnWidths.reduce((sum, width) => sum + width, 0);

  const sectionData = React.useMemo(() => sections.map(section => {
    const rowMaps = new Map<string, Map<number, any>>();
    let maxBeat = 1;
    section.rows.forEach(row => {
      const byBeat = new Map<number, any>();
      row.cells.forEach((cell: any, index: number) => {
        const beatIndex = Number(cell?.beatIndex) || index + 1;
        const content = cell?.data || cell?.cells || [];
        byBeat.set(beatIndex, { ...cell, beatIndex, data: content });
        maxBeat = Math.max(maxBeat, beatIndex + getCellSpanFromContent(content) - 1);
      });
      rowMaps.set(row.key, byBeat);
    });
    let contentfulRows = section.rows.filter(rowHasAnyContent);
    if (!contentfulRows.length && section.rows.length) contentfulRows = [section.rows[0]];
    const primaryRow = contentfulRows.find(row => getTableRowKind(row.key) === 'swar')
      ?? contentfulRows.find(row => getTableRowKind(row.key) === 'bol');
    const strokeRow = contentfulRows.find(row => getTableRowKind(row.key) === 'stroke');
    const fingerRow = contentfulRows.find(row => getTableRowKind(row.key) === 'finger');
    const rowsToRender = primaryRow
      ? contentfulRows.filter(row => row.key !== strokeRow?.key && row.key !== fingerRow?.key)
      : contentfulRows;
    return { section, rowMaps, maxBeat, rowsToRender, primaryRowKey: primaryRow?.key, strokeRowKey: strokeRow?.key, fingerRowKey: fingerRow?.key };
  }), [sections]);

  // Empty cells already fit the 55px minimum. Only content can expand a column.
  const expectedCellKeys = React.useMemo(() => {
    const keys: string[] = [];
    sectionData.forEach(({ rowMaps, maxBeat, rowsToRender, primaryRowKey, strokeRowKey, fingerRowKey }, sIdx) => {
      const cycles = Math.max(1, Math.ceil(maxBeat / beatsPerCycle));
      for (let cycle = 0; cycle < cycles; cycle++) {
        rowsToRender.forEach(row => {
          const byBeat = rowMaps.get(row.key);
          let column = 0;
          while (column < beatsPerCycle) {
            const beat = cycle * beatsPerCycle + column + 1;
            const cell = byBeat?.get(beat);
            const strokeCell = row.key === primaryRowKey && strokeRowKey ? rowMaps.get(strokeRowKey)?.get(beat) : undefined;
            const fingerCell = row.key === primaryRowKey && fingerRowKey ? rowMaps.get(fingerRowKey)?.get(beat) : undefined;
            if (cell?.data?.length || strokeCell?.data?.length || fingerCell?.data?.length) keys.push(`${sIdx}-${cycle}-${row.key}-${beat}`);
            const span = Math.max(
              cell?.span || getCellSpanFromContent(cell?.data || []),
              strokeCell?.span || getCellSpanFromContent(strokeCell?.data || []),
              fingerCell?.span || getCellSpanFromContent(fingerCell?.data || []),
            );
            column += Math.min(span, beatsPerCycle - column);
          }
        });
      }
    });
    return keys;
  }, [sectionData, beatsPerCycle]);
  // Collect native layout events without cloning state/re-rendering the entire
  // table once per cell. Publish all intrinsic widths in a single update.
  const measurementBatch = React.useMemo(() => ({
    cells: {} as Record<string, CellWidthRequirement>,
    remaining: new Set(expectedCellKeys),
  }), [measurementScope, expectedCellKeys]);
  const measureCell = (key: string, column: number, span: number, width: number) => {
    if (!measurementBatch.remaining.has(key)) return;
    measurementBatch.cells[key] = { column, span, width: Math.ceil(width) + 24 };
    measurementBatch.remaining.delete(key);
    if (measurementBatch.remaining.size === 0) {
      setMeasurements({ scope: measurementScope, cells: measurementBatch.cells });
    }
  };
  // A batch is published only when complete. Final widths and visibility are
  // applied in the same render, with no extra render or animation-frame wait.
  const layoutReady = containerWidth > 0 && (
    expectedCellKeys.length === 0 || measurements.scope === measurementScope
  );

  React.useEffect(() => {
    if (activeBeatIndex === undefined || activeBeatIndex === null || !scrollViewRef.current) return;
    const column = (activeBeatIndex - 1) % beatsPerCycle;
    const cellX = labelWidth + columnWidths.slice(0, column).reduce((sum, w) => sum + w, 0);
    const targetX = Math.max(0, cellX - containerWidth / 2 + columnWidths[column] / 2);
    scrollViewRef.current.scrollTo({ x: targetX, animated: true });
  }, [activeBeatIndex, containerWidth, columnWidths, beatsPerCycle]);

  const beatColors = React.useMemo(() => {
    const colors = new Map<number, string>();
    for (let b = 1; b <= beatsPerCycle; b++) {
      colors.set(b, getBeatColor(b, taalName || '', beatsPerCycle));
    }
    return colors;
  }, [beatsPerCycle, taalName]);

  const getBeatColStyle = (beat: number) => {
    const color = beatColors.get(beat);
    if (!color) return { backgroundColor: '#f5f5f5' };
    
    let rgba = '';
    if (color === '#9FA8DA') rgba = 'rgba(159, 168, 218, 0.2)';
    else if (color === '#80CBC4') rgba = 'rgba(128, 203, 196, 0.2)';
    
    return rgba ? { backgroundColor: rgba } : { backgroundColor: '#f5f5f5' };
  };

  const handleAction = (type: 'duplicate' | 'edit' | 'delete' | 'up' | 'down', index: number) => {
    setActiveMenuIndex(null);
    switch (type) {
      case 'duplicate': onDuplicateSection?.(index); break;
      case 'edit': onEditSection?.(index); break;
      case 'delete': onDeleteSection?.(index); break;
      case 'up': 
        if (index > 0) onSectionReorder?.(index, index - 1);
        break;
      case 'down':
        if (index < sections.length - 1) onSectionReorder?.(index, index + 1);
        break;
    }
  };

  return (
    <View style={[styles.container, { borderColor: layoutReady ? '#858b91' : 'transparent', backgroundColor: '#fff' }]}>
      {!layoutReady && (
        <View style={styles.loadingOverlay} accessibilityRole="progressbar" accessibilityLabel="Preparing notation table">
          <ActivityIndicator color="#6366f1" />
        </View>
      )}
      <ScrollView
        testID="notation-table-layout"
        style={{ opacity: layoutReady ? 1 : 0 }}
        pointerEvents={layoutReady ? 'auto' : 'none'}
        accessibilityElementsHidden={!layoutReady}
        importantForAccessibility={layoutReady ? 'auto' : 'no-hide-descendants'}
        ref={scrollViewRef}
        horizontal
        removeClippedSubviews={false}
        showsHorizontalScrollIndicator
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        <View style={{ width: labelWidth + contentWidth + actionWidth }}>
          {/* Header Row */}
          {!hideHeader && (
            <View style={styles.row}>
              <View style={[styles.labelCell, { backgroundColor: '#80CBC4', borderColor: theme.border }]}>
                <Text style={[styles.labelText, { color: '#000000', fontWeight: '900' }]}>BEAT</Text>
              </View>
              {Array.from({ length: beatsPerCycle }, (_, b) => {
                  const beat = b + 1;
                  const marker = getBeatMarker(beat, taalName || '');
                  const bgColor = beatColors.get(beat);
                  return (
                    <View
                      key={beat}
                      testID={`notation-header-${beat}`}
                      style={[
                        styles.beatCell,
                        { width: columnWidths[b], backgroundColor: bgColor, borderColor: '#858b91' },
                      ]}
                    >
                      {!isAalap && <Text style={[styles.beatNumber, { color: '#000000' }]}>{beat}</Text>}
                      {!isAalap && (marker === 'X' && beat > 1
                        ? <MaterialCommunityIcons name="hand-clap" size={18} color="#111" />
                        : <Text style={[styles.beatSymbol, { color: '#000000' }]}>{marker || ''}</Text>)}
                    </View>
                  );
              })}
              {hasActions && (
                <View style={[styles.actionCellHeader, { backgroundColor: '#80CBC4', borderColor: theme.border }]} />
              )}
            </View>
          )}

          {/* Sections and Rows */}
          {sectionData.map(({ section, rowMaps, maxBeat, rowsToRender, primaryRowKey, strokeRowKey, fingerRowKey }, sIdx) => (
            <View key={sIdx} style={styles.sectionContainer}>
              {/* Spanned Label Cell with Drag Handle */}
              <View style={[styles.labelCell, { width: labelWidth, backgroundColor: '#ffffff', borderColor: theme.border, flexDirection: 'row', paddingHorizontal: 4 }]}>
                <View style={{ marginRight: 4 }}>
                  <MaterialIcons name="drag-indicator" size={18} color="#9ca3af" />
                </View>
                <Text style={[styles.sectionLabel, { color: '#000000', fontWeight: '700', flex: 1 }]}>
                  {section.label}
                </Text>
              </View>
              
              {/* Rows Column */}
              <View style={[styles.rowsColumn, { width: contentWidth, backgroundColor: '#fff' }]}>
                {Array.from({ length: Math.max(1, Math.ceil(maxBeat / beatsPerCycle)) }, (_, cycleIndex) =>
                  rowsToRender.map(row => {
                    const byBeat = rowMaps.get(row.key) || new Map<number, any>();
                    const rowCells: React.ReactNode[] = [];
                    let cIdx = 0;
                    while (cIdx < beatsPerCycle) {
                      const absoluteBeat = cycleIndex * beatsPerCycle + cIdx + 1;
                      const cellObj = byBeat.get(absoluteBeat);
                      const content = cellObj?.data || [];
                      const strokeCell = row.key === primaryRowKey && strokeRowKey ? rowMaps.get(strokeRowKey)?.get(absoluteBeat) : undefined;
                      const fingerCell = row.key === primaryRowKey && fingerRowKey ? rowMaps.get(fingerRowKey)?.get(absoluteBeat) : undefined;
                      const strokeText = strokeCell ? flattenParsedTokens(strokeCell.data).trim() : '';
                      const fingerText = fingerCell ? flattenParsedTokens(fingerCell.data).trim() : '';
                      const span = Math.max(
                        cellObj?.span || getCellSpanFromContent(content),
                        strokeCell?.span || getCellSpanFromContent(strokeCell?.data || []),
                        fingerCell?.span || getCellSpanFromContent(fingerCell?.data || []),
                      );
                      const effectiveSpan = Math.min(span, beatsPerCycle - cIdx);
                      const cellEndBeat = absoluteBeat + effectiveSpan - 1;
                      const phraseRanges = (section.phraseRanges || []).filter(
                        range => range.startBeat <= cellEndBeat && range.endBeat >= absoluteBeat,
                      );
                      rowCells.push(
                        <View
                          key={absoluteBeat}
                          testID={`notation-cell-${sIdx}-${row.key}-${absoluteBeat}`}
                          style={[
                            styles.dataCell,
                            { width: columnWidths.slice(cIdx, cIdx + effectiveSpan).reduce((sum, w) => sum + w, 0), borderColor: '#858b91' },
                            getBeatColStyle(cIdx + 1),
                          ]}
                        >
                          {(content.length > 0 || strokeText || fingerText) && <View
                            key={measurementScope}
                            style={styles.mergedCellContent}
                            onLayout={event => measureCell(`${sIdx}-${cycleIndex}-${row.key}-${absoluteBeat}`, (absoluteBeat - 1) % beatsPerCycle, effectiveSpan, event.nativeEvent.layout.width)}
                          >
                            {content.length > 0 && <NotationCell
                              content={content}
                              isDark={isDark}
                              plain={/^(bol|tabla|pakhawaj|mridangam|lyrics|stroke|finger|layakari)/i.test(row.key)}
                              bilingualBol={/^(bol|tabla|pakhawaj|mridangam)/i.test(row.key)}
                              bolLanguage={bolLanguage}
                            />}
                            {!!strokeText && <View style={styles.accessoryBadge}><Text style={styles.accessoryBadgeText}>{strokeText}</Text></View>}
                            {!!fingerText && <View style={styles.accessoryBadge}><Text style={styles.accessoryBadgeText}>{fingerText}</Text></View>}
                          </View>}
                          {phraseRanges.length > 0 && (
                            <View pointerEvents="none" style={styles.phraseLines}>
                              {phraseRanges.map(range => (
                                <View
                                  key={range.id}
                                  style={[
                                    styles.phraseLine,
                                    { backgroundColor: range.color || '#8b5cf6' },
                                    range.startBeat >= absoluteBeat && range.startBeat <= cellEndBeat && styles.phraseLineStart,
                                    range.endBeat >= absoluteBeat && range.endBeat <= cellEndBeat && styles.phraseLineEnd,
                                    range.isDraft && styles.phraseLineDraft,
                                  ]}
                                />
                              ))}
                            </View>
                          )}
                        </View>,
                      );
                      cIdx += effectiveSpan;
                    }
                    return <View key={`${cycleIndex}-${row.key}`} style={styles.row}>{rowCells}</View>;
                  })
                )}
              </View>

              {/* Action Column */}
              {hasActions && (
                <View style={[styles.actionCell, { backgroundColor: '#ffffff', borderColor: theme.border }]}>
                  <TouchableOpacity onPress={() => setActiveMenuIndex(sIdx)}>
                    <MaterialIcons name="more-vert" size={20} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Action Menu Modal */}
      <Modal
        visible={activeMenuIndex !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActiveMenuIndex(null)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setActiveMenuIndex(null)}
        >
          <View style={[styles.menuContainer, { backgroundColor: theme.card }]}>
            <Text style={styles.menuTitle}>Section Actions</Text>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => handleAction('duplicate', activeMenuIndex!)}>
              <MaterialIcons name="content-copy" size={22} color={theme.text} />
              <Text style={[styles.menuItemText, { color: theme.text }]}>Duplicate</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => handleAction('edit', activeMenuIndex!)}>
              <MaterialIcons name="edit" size={22} color={theme.text} />
              <Text style={[styles.menuItemText, { color: theme.text }]}>Edit</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => handleAction('delete', activeMenuIndex!)}>
              <MaterialIcons name="delete-outline" size={22} color="#ef4444" />
              <Text style={[styles.menuItemText, { color: '#ef4444' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bolRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8 },
  bilingualBol: { alignItems: 'center', justifyContent: 'center', minWidth: 22 },
  bolPrimary: { fontSize: 16, lineHeight: 19, fontWeight: '600', color: '#000' },
  bolPrimaryHindi: { fontSize: 17, lineHeight: 21, fontWeight: '700' },
  bolSecondary: { fontSize: 11, lineHeight: 13, fontWeight: '500', color: '#5f6772' },
  mergedCellContent: { flexShrink: 0, alignItems: 'center', justifyContent: 'center', gap: 2 },
  accessoryBadge: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d7dce2', borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 },
  accessoryBadgeText: { color: '#28303a', fontSize: 9, lineHeight: 11, fontWeight: '600', textAlign: 'center' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: 8,
  },
  phraseLines: { position: 'absolute', left: 0, right: 0, bottom: 4, height: 7, justifyContent: 'center' },
  phraseLine: { height: 3, alignSelf: 'stretch' },
  phraseLineStart: { marginLeft: 8, borderTopLeftRadius: 3, borderBottomLeftRadius: 3 },
  phraseLineEnd: { marginRight: 8, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  phraseLineDraft: { opacity: 0.7 },
  sectionContainer: {
    flexDirection: 'row',
  },
  rowsColumn: {
    flexShrink: 0,
  },
  row: {
    flexDirection: 'row',
  },
  dragCellHeader: {
    width: 35,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragCell: {
    width: 35,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionCellHeader: {
    width: 40,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionCell: {
    width: 40,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelCell: {
    width: 100,
    padding: 8,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelText: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  beatCell: {
    minWidth: 54,
    flexShrink: 0,
    height: 62,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  beatNumber: {
    fontSize: 12,
    fontWeight: '700',
  },
  beatSymbol: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
  dataCell: {
    // Yoga's scroll overflow measures children unconstrained along this row's
    // main axis. Hidden overflow instead caps the FIRST intrinsic measurement
    // at the provisional cell width, permanently clipping long effect groups.
    // This View is not a ScrollView: the whole table remains the scroll target.
    overflow: Platform.OS === 'web' ? 'hidden' : 'scroll',
    minWidth: 54,
    flexShrink: 0,
    minHeight: 58,
    paddingHorizontal: 11,
    paddingVertical: 10,
    flexDirection: 'row',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    width: '85%',
    borderRadius: 16,
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 20,
    textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 15,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '600',
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginVertical: 10,
  },
  noteText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 2,
    paddingHorizontal: 1,
  },
  cellContent: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    flexShrink: 0,
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nestedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
});
