import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@music-app/store';

import { parseNestedMusicInput } from '@music-app/utils';

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
): React.ReactNode => {
  let piece = normalizeApostrophes(pieceRaw).trim();
  if (!piece) return null;

  const isAsteriskPrefix = piece.startsWith('*');
  if (isAsteriskPrefix) piece = piece.substring(1).trim();
  if (!piece) return null;

  // Kan patterns <S R>
  const kanMatch = piece.match(/^<\s*([A-Za-z]['’\u030D\u0304\u0305]?)\s*([A-Za-z]['’\u030D\u0304\u0305]?)\s*>$/);
  if (kanMatch) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ marginTop: -4 }}>
          {renderTextPiece(kanMatch[1], notationSystem, false, false, true, true)}
        </View>
        {renderTextPiece(kanMatch[2], notationSystem, false, false, false, true)}
      </View>
    );
  }

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

  return <Text style={[styles.noteText, { color: '#000' }]}>{piece}</Text>;
};

const renderToken = (
  token: any,
  notationSystem: NotationSystem,
  hasMeend: boolean = false,
  hasPhrases: boolean = false,
  isSmall: boolean = false,
): React.ReactNode => {
  if (typeof token === 'string') {
    // If string contains notation markers, parse it
    if (token.includes('/') || token.includes('(') || token.includes('<')) {
       const parsed = parseNestedMusicInput(token);
       if (parsed.length > 0) {
          return (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {parsed[0].data.map((t, i) => (
                <React.Fragment key={i}>
                  {renderToken(t, notationSystem, hasMeend, hasPhrases, isSmall)}
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
            {renderTextPiece(p, notationSystem, hasMeend, hasPhrases, isSmall)}
          </React.Fragment>
        ))}
      </View>
    );
  }

  const t = token.type;
  const content = token.content || [];

  if (t === '/md') {
    // Meend (Top Arc) - Premium fluid slur
    return (
      <View style={{ alignItems: 'center', width: '100%', paddingTop: 4 }}>
        <View style={{
          width: '108%',
          height: 7,
          borderTopWidth: 1.6,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: '#000',
          borderTopLeftRadius: 100,
          borderTopRightRadius: 100,
          marginBottom: 1,
          opacity: 0.85,
        }} />
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end', paddingHorizontal: 2 }}>
          {content.map((c: any, idx: number) => (
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
      <View style={{ alignItems: 'center', width: '100%', paddingTop: 6 }}>
        <View style={{
          width: '100%',
          height: 2,
          backgroundColor: '#000',
          position: 'relative',
        }}>
          {/* Side Ticks */}
          <View style={{ position: 'absolute', left: 0, top: 0, width: 2, height: 8, backgroundColor: '#000' }} />
          <View style={{ position: 'absolute', right: 0, top: 0, width: 2, height: 8, backgroundColor: '#000' }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
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
    // Murki (Wavy approximation)
    return (
      <View style={{ alignItems: 'center', width: '100%' }}>
        <View style={{
          width: '100%',
          height: 6,
          borderTopWidth: 1.5,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: '#000',
          borderTopLeftRadius: 50,
          borderTopRightRadius: 50,
          marginBottom: 1,
          opacity: 0.8,
        }} />
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {content.map((c: any, idx: number) => (
            <React.Fragment key={idx}>
              {renderToken(c, notationSystem, hasMeend, hasPhrases, isSmall)}
            </React.Fragment>
          ))}
        </View>
      </View>
    );
  }

  if (t === '/aa') {
    // Aandolan (Top arc with italic S symbol)
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <View style={{ alignItems: 'center' }}>
          <View style={{
            width: '100%',
            height: 8,
            borderTopWidth: 2,
            borderLeftWidth: 1.5,
            borderRightWidth: 1.5,
            borderColor: '#000',
            borderTopLeftRadius: 100,
            borderTopRightRadius: 100,
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

  if (t === '(') {
    // Khatka / Phrases (Bottom Arc) - Premium fluid slur
    return (
      <View style={{ alignItems: 'center', width: '100%', paddingBottom: 4 }}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingHorizontal: 2 }}>
          {content.map((c: any, idx: number) => (
            <React.Fragment key={idx}>
              {renderToken(c, notationSystem, hasMeend, true, isSmall)}
            </React.Fragment>
          ))}
        </View>
        <View style={{
          width: '108%',
          height: 7,
          borderBottomWidth: 1.6,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: '#000',
          borderBottomLeftRadius: 100,
          borderBottomRightRadius: 100,
          marginTop: 1,
          opacity: 0.85,
        }} />
      </View>
    );
  }

  if (t === '<' || t === '/kn') {
    // Kan Note style (Grace Note)
    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {content.map((c: any, idx: number) => {
          const isKanNote = idx === 0 && content.length > 1;
          return (
            <View key={idx} style={isKanNote ? { 
              transform: [{ scale: 0.65 }], 
              marginTop: -10,
              marginRight: -4
            } : {}}>
               {renderToken(c, notationSystem, hasMeend, hasPhrases, isKanNote)}
            </View>
          );
        })}
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

const NotationCell = ({ content, notationSystem = 'hindustani_bhatkhande' }: { content: any[], notationSystem?: NotationSystem }) => {
  return (
    <View style={styles.cellContent}>
      {content.map((token, idx) => (
        <React.Fragment key={idx}>
          {renderToken(token, notationSystem)}
        </React.Fragment>
      ))}
    </View>
  );
};

interface NotationTableEnhancedProps {
  sections: Array<{
    label: string;
    rows: Array<{ key: string; cells: any[] }>;
  }>;
  beatsPerCycle: number;
  notationSystem?: string;
  taalName?: string;
  isAalap?: boolean;
  hideHeader?: boolean;
  onSectionReorder?: (fromIndex: number, toIndex: number) => void;
  onDuplicateSection?: (index: number) => void;
  onEditSection?: (index: number) => void;
  onDeleteSection?: (index: number) => void;
}

interface TaalStructure {
  taali: number[];
  khaali: number[];
}

const TAAL_STRUCTURES: Record<string, TaalStructure> = {
  'ektaal': { taali: [1, 5, 9, 11], khaali: [3, 7] },
  'chautaal': { taali: [1, 5, 9, 11], khaali: [3, 7] },
  'teentaal': { taali: [1, 5, 13], khaali: [9] },
  'rupak': { taali: [4, 6], khaali: [1] },
  'jhaptal': { taali: [1, 3, 8], khaali: [6] },
  'dhamar': { taali: [1, 6, 11], khaali: [8] },
  'deepchandi': { taali: [1, 4, 11], khaali: [8] },
  'tilwada': { taali: [1, 5, 13], khaali: [9] },
  'kaharwa': { taali: [1], khaali: [5] },
  'dadra': { taali: [1], khaali: [4] },
  'matta taal': { taali: [1, 3, 7], khaali: [5] },
  'sultal': { taali: [1, 5, 7], khaali: [3, 9] },
  'shultal': { taali: [1, 5, 7], khaali: [3, 9] },
};

const normalizeTaalName = (name: string): string => {
  if (!name) return '';
  const clean = name.toLowerCase().split(/[—–-]/)[0].trim();
  return clean;
};

const getBeatMarker = (beat: number, taalName: string): string | null => {
  const normalized = normalizeTaalName(taalName);
  const structure = TAAL_STRUCTURES[normalized];
  if (!structure) return null;

  if (structure.taali.includes(beat)) {
    if (beat === 1) return 'X';
    return structure.taali.indexOf(beat) + 1 + '';
  }
  if (structure.khaali.includes(beat)) return 'O';
  return null;
};

export default function NotationTableEnhanced({ 
  sections, 
  beatsPerCycle = 16, 
  taalName,
  isAalap = false,
  hideHeader = false,
  onSectionReorder,
  onDuplicateSection,
  onEditSection,
  onDeleteSection
}: NotationTableEnhancedProps) {
  const theme = useTheme();
  const isDark = theme.background === '#000000';
  const [activeMenuIndex, setActiveMenuIndex] = React.useState<number | null>(null);

  const beatColors = React.useMemo(() => {
    const colors = new Map<number, string>();
    let colorIndex = 0;
    for (let b = 1; b <= beatsPerCycle; b++) {
      const m = getBeatMarker(b, taalName || '');
      if (m && b > 1) {
        colorIndex = (colorIndex + 1) % 2;
      }
      colors.set(b, ['#9FA8DA', '#80CBC4'][colorIndex]);
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
    <View style={[styles.container, { borderColor: theme.border, backgroundColor: isDark ? '#111' : '#fff' }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Header Row */}
          {!hideHeader && (
            <View style={styles.row}>
              <View style={[styles.labelCell, { backgroundColor: '#80CBC4', borderColor: theme.border }]}>
                <Text style={[styles.labelText, { color: '#000000', fontWeight: '900' }]}>BEAT</Text>
              </View>
              {Array.from({ length: beatsPerCycle }).map((_, i) => {
                const beat = i + 1;
                const marker = getBeatMarker(beat, taalName || '');
                const bgColor = beatColors.get(beat);
                
                return (
                  <View 
                    key={i} 
                    style={[
                      styles.beatCell, 
                      { 
                        backgroundColor: bgColor, 
                        borderColor: theme.border 
                      }
                    ]}
                  >
                    <Text style={[styles.beatNumber, { color: '#000000' }]}>{beat}</Text>
                    <Text style={[styles.beatSymbol, { color: '#000000' }]}>{marker || ''}</Text>
                  </View>
                );
              })}
              {(onDuplicateSection || onEditSection || onDeleteSection) && (
                <View style={[styles.actionCellHeader, { backgroundColor: '#80CBC4', borderColor: theme.border }]} />
              )}
            </View>
          )}

          {/* Sections and Rows */}
          {sections.map((section, sIdx) => (
            <View key={sIdx} style={styles.sectionContainer}>
              {/* Spanned Label Cell with Drag Handle */}
              <View style={[styles.labelCell, { backgroundColor: '#ffffff', borderColor: theme.border, flexDirection: 'row', paddingHorizontal: 4 }]}>
                <View style={{ marginRight: 4 }}>
                  <MaterialIcons name="drag-indicator" size={18} color="#9ca3af" />
                </View>
                <Text style={[styles.sectionLabel, { color: '#000000', fontWeight: '700', flex: 1 }]}>
                  {section.label}
                </Text>
              </View>
              
              {/* Rows Column */}
              <View style={[styles.rowsColumn, { backgroundColor: '#f5f5f5' }]}>
                {section.rows.map((row, rIdx) => (
                  <View key={row.key} style={styles.row}>
                    {row.cells.map((cell, cIdx) => (
                      <View 
                        key={cIdx} 
                        style={[
                          styles.dataCell, 
                          { borderColor: theme.border },
                          getBeatColStyle(cIdx + 1)
                        ]}
                      >
                        <NotationCell content={cell.cells || []} isDark={isDark} />
                      </View>
                    ))}
                    {/* Fill empty beats if needed */}
                    {row.cells.length < beatsPerCycle && Array.from({ length: beatsPerCycle - row.cells.length }).map((_, i) => {
                      const beat = row.cells.length + i + 1;
                      return (
                        <View 
                          key={`empty-${i}`} 
                          style={[
                            styles.dataCell, 
                            { borderColor: theme.border },
                            getBeatColStyle(beat)
                          ]} 
                        />
                      );
                    })}
                  </View>
                ))}
              </View>

              {/* Action Column */}
              {(onDuplicateSection || onEditSection || onDeleteSection) && (
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
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: 8,
  },
  sectionContainer: {
    flexDirection: 'row',
  },
  rowsColumn: {
    flex: 1,
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
    width: 80,
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
    width: 50,
    height: 45,
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
    textTransform: 'uppercase',
  },
  dataCell: {
    width: 50,
    minHeight: 45,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
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
  },
  cellContent: {
    flexDirection: 'column',
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
