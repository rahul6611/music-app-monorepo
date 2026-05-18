import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@music-app/store';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import { parseNestedMusicInput } from '@music-app/utils';
import { generateAutoPatterns } from '@music-app/utils';

const { width, height } = Dimensions.get('window');

interface NewExerciseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (exercise: any) => void;
  mode: 'different' | 'anchored';
  editExercise?: any;
  anchorPattern?: string[];
  anchorBeatsBreakdown?: string;
  category?: 'exercises' | 'laya' | 'tihai';
}

const DEFAULT_NOTES_PER_ROW = 8;

export default function NewExerciseModal({
  isOpen,
  onClose,
  onSave,
  mode,
  editExercise,
  anchorPattern,
  anchorBeatsBreakdown,
  category = 'exercises'
}: NewExerciseModalProps) {
  const theme = useTheme();
  const { notationSystem, musicSubStyleTypes } = useUserPreferences();
  
  const [beatsPerCycle, setBeatsPerCycle] = useState('8');
  const [beatsBreakdown, setBeatsBreakdown] = useState('');
  const [activeTab, setActiveTab] = useState<'swar' | 'bol' | 'pakhawajBol' | 'mridangamBol' | 'stroke' | 'finger' | 'lyrics' | 'layakari'>('swar');
  const [swarOctaveMode, setSwarOctaveMode] = useState<'lower' | 'normal' | 'higher'>('normal');
  
  const [noteText, setNoteText] = useState('');
  const [noteRows, setNoteRows] = useState<string[][]>([Array(DEFAULT_NOTES_PER_ROW).fill('')]);
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const inputRef = useRef<TextInput>(null);
  const [cursorPosition, setCursorPosition] = useState(0);

  const subStyles = useMemo(() => musicSubStyleTypes?.map(s => s.toLowerCase()) || [], [musicSubStyleTypes]);
  const isHindustani = !subStyles.some(s => s.includes('carnatic') || s === 'mridangam');
  const isBhatkhandeStyle = notationSystem === 'hindustani_bhatkhande' || notationSystem === 'paluskar';

  useEffect(() => {
    if (isOpen) {
      if (editExercise) {
        setBeatsPerCycle(editExercise.beatsPerCycle || '8');
        setBeatsBreakdown(editExercise.beatsBreakdown || '');
        const notes = editExercise.notes || [];
        setNoteText(notes.filter((n: string) => n.trim()).join(', '));
        setAutoGenerate(editExercise.autoGenerate || false);
      } else {
        if (mode === 'anchored' && anchorPattern) {
          setBeatsPerCycle(anchorPattern.length.toString());
          setBeatsBreakdown(anchorBeatsBreakdown || '');
          setNoteText(anchorPattern.filter(n => n.trim()).join(', '));
          setAutoGenerate(true);
        } else {
          setBeatsPerCycle('8');
          setBeatsBreakdown('');
          setNoteText('');
          setAutoGenerate(false);
        }
      }
    }
  }, [isOpen, editExercise, mode, anchorPattern]);

  const handleBeatsChange = (val: string) => {
    setBeatsPerCycle(val);
  };

  const insertAtCursor = (text: string) => {
    const nextText = noteText.slice(0, cursorPosition) + text + noteText.slice(cursorPosition);
    setNoteText(nextText);
    setCursorPosition(cursorPosition + text.length);
  };

  const deleteAtCursor = () => {
    if (cursorPosition > 0) {
      const nextText = noteText.slice(0, cursorPosition - 1) + noteText.slice(cursorPosition);
      setNoteText(nextText);
      setCursorPosition(cursorPosition - 1);
    }
  };

  const handleAutoGenerate = () => {
    if (isGenerating) return;

    const beats = parseInt(beatsPerCycle, 10);
    if (isNaN(beats) || beats < 1) {
      Alert.alert('Error', 'Please enter a valid number of beats.');
      return;
    }

    setIsGenerating(true);
    setTimeout(() => {
      try {
        const swaras = noteText.split(',').map(s => s.trim()).filter(s => s.length > 0);
        if (swaras.length < 2) {
          Alert.alert('Error', 'Please enter at least 2 swars/notes to generate a pattern.');
          return;
        }

        const generated = generateAutoPatterns(swaras, beats);
        if (generated.length > 0) {
          const flatNotes = generated.map(item => item.row).flat();
          setNoteText(flatNotes.join(', '));
        }
      } catch (error) {
        console.error('Generation failed:', error);
      } finally {
        setIsGenerating(false);
      }
    }, 500);
  };

  const handleSave = () => {
    const notes = noteText.split(',').map(n => n.trim());
    onSave({
      mode,
      beatsPerCycle,
      beatsBreakdown,
      notes,
      autoGenerate,
    });
  };

  const getSwarTokens = () => {
    if (swarOctaveMode === 'lower') return ['..S', '.r', '.R', '.g', '.G', '.M', ".M'", '.P', '.d', '.D', '.n', '.N', 'S'];
    if (swarOctaveMode === 'higher') return ['S.', 'r.', 'R.', 'g.', 'G.', 'M.', "M'.", 'P.', 'd.', 'D.', 'n.', 'N.', 'S..'];
    return ['S', 'r', 'R', 'g', 'G', 'M', "M'", 'P', 'd', 'D', 'n', 'N', 'S.'];
  };

  const renderSwarGrid = () => {
    const tokens = getSwarTokens();
    return (
      <View style={styles.swarGrid}>
        <View style={styles.octaveRow}>
          <TouchableOpacity 
            style={[styles.octaveBtn, { backgroundColor: theme.primarySoft }]}
            onPress={() => setSwarOctaveMode(prev => prev === 'higher' ? 'normal' : 'lower')}
          >
            <Feather name="chevron-left" size={20} color={theme.primary} />
          </TouchableOpacity>
          
          <View style={styles.swarPillsContainer}>
            {tokens.map((t, idx) => (
              <TouchableOpacity 
                key={idx} 
                style={[styles.swarPill, { borderColor: theme.border }]}
                onPress={() => insertAtCursor(`${t}, `)}
              >
                <Text style={[styles.swarPillText, { color: theme.text }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity 
            style={[styles.octaveBtn, { backgroundColor: theme.primarySoft }]}
            onPress={() => setSwarOctaveMode(prev => prev === 'lower' ? 'normal' : 'higher')}
          >
            <Feather name="chevron-right" size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderBolGrid = (instrument: 'tabla' | 'pakhawaj' | 'mridangam') => {
    const commonBols = instrument === 'tabla' 
      ? ['Dha', 'Dhin', 'Ge', 'Na', 'Ti', 'Ka', 'Ta', 'DhaDha', 'DhinDhin']
      : ['Dha', 'Dhi', 'Na', 'Ti', 'Ge', 'Dhe', 'Dhet', 'Ki', 'Ta'];
      
    return (
      <View style={styles.pillRow}>
        {commonBols.map((bol, idx) => (
          <TouchableOpacity 
            key={idx} 
            style={[styles.navPill, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => insertAtCursor(`${bol}, `)}
          >
            <Text style={[styles.navPillText, { color: theme.text }]}>{bol}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderLyricsKeyboard = () => (
    <View style={styles.pillRow}>
      {['-', '|', '...', 'SA', 'RE', 'GA', 'MA'].map((l, idx) => (
        <TouchableOpacity 
          key={idx} 
          style={[styles.navPill, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => insertAtCursor(`${l}, `)}
        >
          <Text style={[styles.navPillText, { color: theme.text }]}>{l}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const navigationPills = [
    { label: ',', insert: ', ' },
    { label: '-', insert: '- ' },
    { label: '/', insert: '/ ' },
    { label: '(', insert: '( ' },
    { label: ')', insert: ') ' },
    { label: 'Spc', insert: ' ' },
    { label: '*', insert: '* ' },
    { label: '|', insert: '| ' },
  ];

  return (
    <Modal visible={isOpen} animationType="slide" transparent>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={[styles.content, { backgroundColor: theme.background }]}>

          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.text }]}>
              {editExercise ? 'Edit exercise' : 'New exercise'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.formRow}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Beats/Cycle:</Text>
                <TextInput 
                  style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                  value={beatsPerCycle}
                  onChangeText={handleBeatsChange}
                  keyboardType="numeric"
                  editable={mode !== 'anchored'}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 2 }]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Beats breakdown:</Text>
                <TextInput 
                  style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                  value={beatsBreakdown}
                  onChangeText={setBeatsBreakdown}
                  placeholder="Ex: 4/4 or 4/2/2"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
              {['swar', 'layakari', 'pakhawajBol', 'bol', 'mridangamBol', 'lyrics'].map((tab) => (
                <TouchableOpacity 
                  key={tab}
                  onPress={() => setActiveTab(tab as any)}
                  style={[
                    styles.tab, 
                    activeTab === tab && { backgroundColor: theme.text, borderColor: theme.text }
                  ]}
                >
                  <Text style={[
                    styles.tabText, 
                    { color: activeTab === tab ? theme.background : theme.textSecondary }
                  ]}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1).replace('Bol', '')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.inputArea}>
              <TextInput 
                ref={inputRef}
                multiline
                style={[styles.textArea, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                value={noteText}
                onChangeText={setNoteText}
                onSelectionChange={(e) => setCursorPosition(e.nativeEvent.selection.start)}
                placeholder="Enter notes separated by commas (e.g. S, R, G, M)"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

           
            {activeTab === 'swar' && renderSwarGrid()}
            {activeTab === 'bol' && renderBolGrid('tabla')}
            {activeTab === 'pakhawajBol' && renderBolGrid('pakhawaj')}
            {activeTab === 'mridangamBol' && renderBolGrid('mridangam')}
            {activeTab === 'lyrics' && renderLyricsKeyboard()}

         
            <View style={styles.pillRow}>
               {navigationPills.map((p, i) => (
                 <TouchableOpacity 
                  key={i} 
                  style={[styles.navPill, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => insertAtCursor(p.insert)}
                 >
                   <Text style={[styles.navPillText, { color: theme.text }]}>{p.label}</Text>
                 </TouchableOpacity>
               ))}
               <TouchableOpacity 
                style={[styles.navPill, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={deleteAtCursor}
               >
                 <Text style={[styles.navPillText, { color: theme.text }]}>Del</Text>
               </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cellGrid}>
              {Array.from({ length: parseInt(beatsPerCycle) || 8 }).map((_, i) => (
                <View key={i} style={[styles.cell, { backgroundColor: theme.primarySoft, borderColor: theme.border }]}>
                  <Text style={[styles.cellText, { color: theme.primary }]}>{noteText.split(',')[i]?.trim() || ''}</Text>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity 
              style={styles.addRowBtn}
              onPress={() => {}}
            >
              <Ionicons name="add" size={16} color={theme.primary} />
              <Text style={[styles.addRowText, { color: theme.primary }]}>Add row</Text>
            </TouchableOpacity>

          </ScrollView>

          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <View style={styles.footerLeft}>
              <TouchableOpacity 
                style={styles.checkboxContainer}
                onPress={handleAutoGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Ionicons 
                    name={autoGenerate ? "checkbox" : "square-outline"} 
                    size={20} 
                    color={autoGenerate ? theme.primary : theme.textSecondary} 
                  />
                )}
                <Text style={[styles.checkboxLabel, { color: theme.text }]}>
                  {isGenerating ? 'Generating...' : 'Auto generate'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footerRight}>
              <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
                <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={[styles.saveBtn, { backgroundColor: theme.text }]}>
                <Text style={[styles.saveBtnText, { color: theme.background }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    height: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    flex: 1,
    padding: 20,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  inputGroup: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '600',
  },
  tabsContainer: {
    marginBottom: 20,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
    marginRight: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  inputArea: {
    marginBottom: 16,
  },
  textArea: {
    minHeight: 80,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    fontSize: 16,
    fontWeight: '600',
    textAlignVertical: 'top',
  },
  swarGrid: {
    marginBottom: 16,
  },
  octaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  octaveBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swarPillsContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  swarPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 36,
    alignItems: 'center',
  },
  swarPillText: {
    fontSize: 14,
    fontWeight: '800',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  navPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 44,
    alignItems: 'center',
  },
  navPillText: {
    fontSize: 14,
    fontWeight: '700',
  },
  cellGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  cell: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  cellText: {
    fontSize: 14,
    fontWeight: '800',
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 40,
  },
  addRowText: {
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  footerLeft: {
    flex: 1,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  saveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
