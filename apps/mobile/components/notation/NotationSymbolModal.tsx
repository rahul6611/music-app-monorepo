import React from 'react';
import { 
  View, Text, TouchableOpacity, ScrollView, Modal, 
  StyleSheet, Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@music-app/store';

interface SymbolRow {
  name: string;
  description?: string;
  input: string;
  style: React.ReactNode;
}

interface SymbolCategory {
  categoryName: string;
  rows: SymbolRow[];
}

interface NotationSymbolModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSitar?: boolean;
}

export default function NotationSymbolModal({ isOpen, onClose, isSitar }: NotationSymbolModalProps) {
  const theme = useTheme();
  const isDark = theme.background === '#000000';
  const s = createStyles(theme, isDark);

  const styleRows: SymbolRow[] = [
    {
      name: 'Meend',
      description: 'A smooth glide from one note to another',
      input: '/md S R G /',
      style: (
        <View style={s.stylePreviewMeend}>
          <Text style={s.stylePreviewNoteText}>S R G</Text>
        </View>
      )
    },
    {
      name: 'Kan',
      description: 'A grace note played before the main note',
      input: '/kn S R /',
      style: (
        <View style={s.stylePreviewKan}>
          <Text style={s.stylePreviewSupText}>S</Text>
          <Text style={s.stylePreviewNoteText}>R</Text>
        </View>
      )
    }
  ];

  if (isSitar) {
    styleRows.push(
      {
        name: 'Murki',
        description: 'A fast, delicate trill around a note',
        input: '/mu S R G /',
        style: (
          <View style={s.stylePreviewMurki}>
            <Text style={s.stylePreviewNoteText}>S R G</Text>
            <View style={s.murkiWavyLine} />
          </View>
        )
      },
      {
        name: 'Ghasit',
        description: 'A slide on the strings on sitar/sarod',
        input: '/gh S R /',
        style: (
          <View style={s.stylePreviewGhasit}>
            <Text style={s.stylePreviewNoteText}>S R</Text>
          </View>
        )
      }
    );
  }

  const categories: SymbolCategory[] = [
    {
      categoryName: 'SWAR',
      rows: [
        { 
          name: 'Shuddha Swar', 
          description: 'The natural notes: Sa, Re, Ga, Ma, Pa, Dha, Ni', 
          input: 'S, R, G, M, P, D, N', 
          style: <Text style={s.stylePreviewNoteText}>S R G M P D N</Text> 
        },
        { 
          name: 'Komal Swar', 
          description: 'The flat versions of Re, Ga, Dha, and Ni', 
          input: 'r, g, d, n', 
          style: (
            <View style={s.row}>
              {['R', 'G', 'D', 'N'].map((n, i) => (
                <View key={i} style={s.komalContainer}>
                  <Text style={s.stylePreviewNoteText}>{n}</Text>
                  <View style={s.komalLine} />
                </View>
              ))}
            </View>
          ) 
        },
        { 
          name: 'Teevra Swar', 
          description: 'The sharp version of Madhyam (Ma)', 
          input: "M'", 
          style: (
            <View style={s.teevraContainer}>
              <View style={s.teevraMark} />
              <Text style={s.stylePreviewNoteText}>M</Text>
            </View>
          ) 
        }
      ]
    },
    {
      categoryName: 'OCTAVE',
      rows: [
        { 
          name: 'Lower Octave', 
          description: 'Notes in the Mandra Saptak (Mandra)', 
          input: '.S, .r, .R etc', 
          style: (
            <View style={s.row}>
              {['S', 'R'].map((n, i) => (
                <View key={i} style={s.octaveLowerContainer}>
                  <Text style={s.stylePreviewNoteText}>{n}</Text>
                  <Text style={s.octaveDotBelow}>·</Text>
                </View>
              ))}
            </View>
          ) 
        },
        { 
          name: 'Upper Octave', 
          description: 'Notes in the Taar Saptak (Taar)', 
          input: 'S., r., R. etc', 
          style: (
            <View style={s.row}>
              {['S', 'R'].map((n, i) => (
                <View key={i} style={s.octaveUpperContainer}>
                  <Text style={s.octaveDotAbove}>·</Text>
                  <Text style={s.stylePreviewNoteText}>{n}</Text>
                </View>
              ))}
            </View>
          ) 
        }
      ]
    },
    {
      categoryName: 'DURATION & GROUPING',
      rows: [
        { 
          name: 'Multiple beats', 
          input: '/2 S R G /', 
          style: (
            <View style={s.miniTable}>
              <View style={s.miniHeader}>
                <Text style={s.miniHeaderText}>1</Text>
                <Text style={s.miniHeaderText}>2</Text>
              </View>
              <View style={s.miniCell}>
                <Text style={s.stylePreviewNoteText}>S R G</Text>
              </View>
            </View>
          ) 
        },
        { 
          name: 'Phrase', 
          input: '( S R G )', 
          style: (
            <View style={s.phraseContainer}>
               <Text style={s.stylePreviewNoteText}>S R G</Text>
               <View style={s.phraseUnderline} />
            </View>
          ) 
        }
      ]
    },
    {
      categoryName: 'STYLES',
      rows: styleRows
    }
  ];

  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <SafeAreaView style={s.safeArea}>
          <View style={s.content}>
            <View style={s.header}>
              <Text style={s.headerTitle}>Notation Reference</Text>
              <TouchableOpacity onPress={onClose} style={s.closeBtn}>
                <Feather name="x" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={s.body}>
              <View style={s.tableHeader}>
                <Text style={[s.th, { width: '35%' }]}>Name</Text>
                <Text style={[s.th, { width: '30%' }]}>Input</Text>
                <Text style={[s.th, { width: '35%' }]}>Notation style</Text>
              </View>

              {categories.map((cat, catIdx) => (
                <View key={catIdx}>
                  <View style={s.categoryHeader}>
                    <Text style={s.categoryText}>{cat.categoryName}</Text>
                  </View>
                  {cat.rows.map((row, rowIdx) => (
                    <View key={rowIdx} style={s.tableRow}>
                      <View style={[s.td, { width: '35%' }]}>
                        <Text style={s.nameTitle}>{row.name}</Text>
                        {row.description && <Text style={s.nameDesc}>{row.description}</Text>}
                      </View>
                      <View style={[s.td, { width: '30%' }]}>
                        <View style={s.inputCode}>
                          <Text style={s.inputText}>{row.input}</Text>
                        </View>
                      </View>
                      <View style={[s.td, { width: '35%', alignItems: 'center' }]}>
                        <View style={s.stylePreviewWrapper}>
                          {row.style}
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    backgroundColor: isDark ? '#1a1a1a' : '#fff',
    marginTop: Platform.OS === 'ios' ? 40 : 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: isDark ? '#111' : '#f8f9fa',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: theme.border,
  },
  th: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textSecondary,
    paddingHorizontal: 12,
  },
  categoryHeader: {
    backgroundColor: isDark ? '#222' : '#f1f3f5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.textSecondary,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#222' : '#edf2f7',
    paddingVertical: 12,
  },
  td: {
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  nameTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 4,
  },
  nameDesc: {
    fontSize: 11,
    color: theme.textSecondary,
    lineHeight: 14,
  },
  inputCode: {
    backgroundColor: isDark ? '#111' : '#f8f9fa',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 6,
    padding: 6,
    alignItems: 'center',
  },
  inputText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: theme.text,
  },
  stylePreviewWrapper: {
    minHeight: 44,
    minWidth: 80,
    backgroundColor: isDark ? '#111' : '#f5f5f5',
    borderWidth: 1,
    borderColor: isDark ? '#333' : '#636363',
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stylePreviewNoteText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  komalContainer: {
    alignItems: 'center',
  },
  komalLine: {
    width: '100%',
    height: 1.5,
    backgroundColor: theme.text,
    marginTop: -1,
  },
  teevraContainer: {
    alignItems: 'center',
  },
  teevraMark: {
    width: 2,
    height: 6,
    backgroundColor: theme.text,
    marginBottom: -2,
  },
  octaveLowerContainer: {
    alignItems: 'center',
  },
  octaveDotBelow: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: -8,
    color: theme.text,
  },
  octaveUpperContainer: {
    alignItems: 'center',
  },
  octaveDotAbove: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: -8,
    color: theme.text,
  },
  miniTable: {
    width: 60,
    borderWidth: 1,
    borderColor: '#636363',
  },
  miniHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#636363',
  },
  miniHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9,
    backgroundColor: '#9FA8DA',
    fontWeight: '600',
    color: '#333',
  },
  miniCell: {
    padding: 4,
    alignItems: 'center',
  },
  phraseContainer: {
    alignItems: 'center',
  },
  phraseUnderline: {
    width: '100%',
    height: 2,
    backgroundColor: theme.text,
    borderRadius: 1,
    marginTop: 2,
  },
  stylePreviewMeend: {
    borderTopWidth: 2,
    borderTopColor: theme.text,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    paddingTop: 2,
    paddingHorizontal: 8,
  },
  stylePreviewKan: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stylePreviewSupText: {
    fontSize: 10,
    fontWeight: '700',
    marginRight: 1,
    marginTop: -2,
    color: theme.text,
  },
  stylePreviewMurki: {
    alignItems: 'center',
  },
  murkiWavyLine: {
      width: 40,
      height: 2,
      borderTopWidth: 1,
      borderColor: theme.text,
      borderStyle: 'dashed',
      marginTop: 2,
  },
  stylePreviewGhasit: {
    borderTopWidth: 2,
    borderTopColor: theme.text,
    paddingTop: 2,
    paddingHorizontal: 8,
    position: 'relative',
  },
});
