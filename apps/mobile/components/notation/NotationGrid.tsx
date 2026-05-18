import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Modal, Platform } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { parseNestedMusicInput, ParsedPhraseCell, PhraseRow } from '@music-app/utils';
import { getBeatMarker } from '@music-app/utils';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface NotationGridProps {
  swarText: string;
  activeBeatIndex?: number;
  taalName?: string;
  beatsPerCycle?: number;
  onBeatClick?: (beat: number) => void;
}

const NotationGrid: React.FC<NotationGridProps> = ({
  swarText,
  activeBeatIndex = 1,
  taalName = 'Teental',
  beatsPerCycle = 16,
  onBeatClick
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const cells = useMemo(() => {
    return parseNestedMusicInput(swarText);
  }, [swarText]);

  const beatMap = useMemo(() => {
    const map = new Map<number, ParsedPhraseCell>();
    cells.forEach(c => {
      map.set(c.beatIndex, c);
    });
    return map;
  }, [cells]);

  const cycleBeats = Array.from({ length: beatsPerCycle }, (_, i) => i + 1);

  const renderTokens = (data: (string | PhraseRow)[], isKomalLine = false) => {
    return data.map((item, idx) => {
      if (typeof item === 'string') {
        const isHyphen = item === '-';
        const isDot = item === '.';
        return (
          <Text key={idx} style={[s.noteText, isHyphen && s.hyphenText, isDot && s.dotText]}>
            {item}
          </Text>
        );
      }
      
      const type = item.type;
      
      if (type === '/md') {
        return (
          <View key={idx} style={s.meendWrapper}>
            <View style={s.meendCurve} />
            <View style={s.row}>{renderTokens(item.content)}</View>
          </View>
        );
      }
      
      if (type === '(') {
        return (
          <View key={idx} style={s.phraseWrapper}>
            <View style={s.row}>{renderTokens(item.content)}</View>
            <View style={s.phraseCurve} />
          </View>
        );
      }
      
      return (
        <View key={idx} style={s.row}>
          {renderTokens(item.content)}
        </View>
      );
    });
  };

  const renderCell = (beat: number) => {
    const cell = beatMap.get(beat);
    const isActive = activeBeatIndex === beat;

    return (
      <TouchableOpacity 
        key={beat} 
        style={[s.cell, isActive && s.activeCell]}
        onPress={() => onBeatClick?.(beat)}
      >
        <View style={s.cellContent}>
          {cell ? renderTokens(cell.data) : <Text style={s.emptyNote}> </Text>}
        </View>
      </TouchableOpacity>
    );
  };

  const TableHeader = () => (
    <View style={s.headerRow}>
      <View style={s.sectionCol}>
        <TouchableOpacity style={s.zoomBtn} onPress={() => setIsFullscreen(true)}>
          <Feather name="maximize" size={16} color="#555" />
        </TouchableOpacity>
        <Text style={s.sectionText}>Beat</Text>
      </View>
      {cycleBeats.map(beat => {
        const marker = getBeatMarker(beat, taalName);
        const segment = Math.floor((beat - 1) / 4);
        const bgColor = segment % 2 === 0 ? '#9FA8DA33' : '#80CBC433';
        
        return (
          <View key={beat} style={[s.headerCell, { backgroundColor: bgColor }]}>
            <Text style={s.beatNum}>{beat}</Text>
            {marker && <Text style={s.beatMarker}>{marker}</Text>}
          </View>
        );
      })}
    </View>
  );

  const TableBody = () => (
    <View style={s.bodyRow}>
      <View style={s.sectionColLabel}>
        <Text style={s.sectionLabelText}>Sthayi</Text>
      </View>
      {cycleBeats.map(beat => renderCell(beat))}
    </View>
  );

  return (
    <View style={s.container}>
      <ScrollView horizontal contentContainerStyle={s.scrollContent} showsHorizontalScrollIndicator={false}>
        <View style={s.tableContainer}>
          <TableHeader />
          <TableBody />
        </View>
      </ScrollView>

      <Modal visible={isFullscreen} transparent={false} animationType="slide">
        <View style={s.fullscreenContainer}>
          <View style={s.fullscreenHeader}>
            <Text style={s.fullscreenTitle}>Notation View</Text>
            <TouchableOpacity onPress={() => setIsFullscreen(false)} style={s.closeBtn}>
              <Feather name="x" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <ScrollView style={s.fullscreenScroll}>
             <ScrollView horizontal contentContainerStyle={[s.scrollContent, { padding: 20 }]}>
                <View style={s.tableContainer}>
                  <TableHeader />
                  <TableBody />
                </View>
             </ScrollView>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const CELL_WIDTH = 70;
const HEADER_HEIGHT = 45;

const s = StyleSheet.create({
  container: {
    marginVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee',
  },
  scrollContent: {
    paddingBottom: 5,
  },
  tableContainer: {
    flexDirection: 'column',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#636363',
  },
  bodyRow: {
    flexDirection: 'row',
  },
  sectionCol: {
    width: 60,
    backgroundColor: '#A9DFBF',
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 2,
    borderColor: '#d0d0d0',
    borderBottomWidth: 1,
  },
  sectionColLabel: {
    width: 60,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#636363',
  },
  zoomBtn: {
    padding: 4,
    marginBottom: 2,
  },
  sectionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#333',
  },
  sectionLabelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
  },
  headerCell: {
    width: CELL_WIDTH,
    height: HEADER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderColor: '#636363',
  },
  beatNum: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  beatMarker: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1a1a1a',
    marginTop: -2,
  },
  cell: {
    width: CELL_WIDTH,
    minHeight: 50,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#636363',
    padding: 5,
  },
  activeCell: {
    backgroundColor: '#c2d2fd',
  },
  cellContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'nowrap',
    width: '100%',
  },
  emptyNote: {
    fontSize: 18,
    color: '#ccc',
  },
  noteText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1b5e20',
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  hyphenText: {
    fontSize: 20,
    color: '#1b5e20',
  },
  dotText: {
    fontSize: 22,
    color: '#000',
    transform: [{ translateY: 4 }],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meendWrapper: {
    alignItems: 'center',
    paddingTop: 8,
  },
  meendCurve: {
    position: 'absolute',
    top: 2,
    width: '90%',
    height: 10,
    borderTopWidth: 2,
    borderColor: '#333',
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
  },
  phraseWrapper: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  phraseCurve: {
    position: 'absolute',
    bottom: 2,
    width: '90%',
    height: 10,
    borderBottomWidth: 2,
    borderColor: '#333',
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  fullscreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  fullscreenTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeBtn: {
    padding: 5,
  },
  fullscreenScroll: {
    flex: 1,
  },
});

export default NotationGrid;
