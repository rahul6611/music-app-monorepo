import React, { useCallback, useEffect, useMemo } from 'react';
import { 
  View, Text, TouchableOpacity, ScrollView, TextInput, 
  StyleSheet, Platform, KeyboardAvoidingView, Image, Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@music-app/store';
import { useNotationStore, NotationTab } from '@music-app/store';
import { DEFAULT_LINE_TYPES, SONG_LINE_TYPES, getStrokePresets } from '@music-app/utils';
import SwarKeyboard from '../../components/notation/SwarKeyboard';
import BolKeyboard from '../../components/notation/BolKeyboard';
import NotationFooter from '../../components/notation/NotationFooter';
import NotationGrid from '../../components/notation/NotationGrid';
import NotationSymbolModal from '../../components/notation/NotationSymbolModal';
import { parseNestedMusicInput } from '@music-app/utils';

export default function AddNotation() {
  const router = useRouter();
  const params = useLocalSearchParams<{ raagId?: string; collectionName?: string; isSong?: string }>();
  const theme = useTheme();
  const isDark = theme.background === '#000000';
  const s = createStyles(theme, isDark);
  const [openedDropdown, setOpenedDropdown] = React.useState<'line' | 'startBeat' | 'beatsPerCycle' | null>(null);
  const [isSymbolModalOpen, setIsSymbolModalOpen] = React.useState(false);

  const {
    activeTab, setActiveTab,
    isMenuView, setIsMenuView,
    beatsPerCycle, setBeatsPerCycle,
    startBeat, setStartBeat,
    selectedLineType, setSelectedLineType,
    swarOctaveMode, setSwarOctaveMode,
    showSwarEffects, setShowSwarEffects,
    swarText, setSwarText,
    strokeText, setStrokeText,
    lyricsText, setLyricsText,
    bolText, setBolText,
    fingerText, setFingerText,
    getActiveText, setActiveText,
    cursorPositions, setCursorPosition,
    showSavedMessage,
  } = useNotationStore();

  useEffect(() => {
    setIsMenuView(true);
  }, []);

  const isSong = params.isSong === 'true';
  const lineTypeOptions = isSong ? SONG_LINE_TYPES : DEFAULT_LINE_TYPES;

  const currentText = getActiveText();
  const parsedData = useMemo(() => parseNestedMusicInput(currentText), [currentText]);

  const jumpBeat = useCallback((direction: 'prev' | 'next') => {
    const text = getActiveText();
    const pos = cursorPositions[activeTab];
    const parts = text.split(',');
    
    let accum = 0;
    let segIndex = 0;
    for (let i = 0; i < parts.length; i++) {
      if (pos <= accum + parts[i].length) {
        segIndex = i;
        break;
      }
      accum += parts[i].length + 1; 
    }

    if (direction === 'prev' && segIndex > 0) {
      let newPos = 0;
      for (let i = 0; i < segIndex - 1; i++) newPos += parts[i].length + 1;
      newPos += parts[segIndex - 1].length;
      setCursorPosition(activeTab, newPos);
    } else if (direction === 'next') {
      if (segIndex < parts.length - 1) {
        let newPos = 0;
        for (let i = 0; i <= segIndex; i++) newPos += parts[i].length + 1;
        newPos += parts[segIndex + 1].length;
        setCursorPosition(activeTab, newPos);
      } else {
        const next = text + (text.endsWith(', ') ? '' : ', ');
        setActiveText(next);
        setCursorPosition(activeTab, next.length);
      }
    }
  }, [activeTab, getActiveText, cursorPositions, setCursorPosition, setActiveText]);

  const handleClearCurrent = useCallback(() => {
    const text = getActiveText();
    const pos = cursorPositions[activeTab];
    const parts = text.split(',');
    
    let accum = 0;
    let segIndex = 0;
    for (let i = 0; i < parts.length; i++) {
      if (pos <= accum + parts[i].length) {
        segIndex = i;
        break;
      }
      accum += parts[i].length + 1;
    }
    
    if (segIndex >= 0 && segIndex < parts.length) {
      parts[segIndex] = ' ';
      const next = parts.join(',');
      setActiveText(next);
      
      let newPos = 0;
      for (let i = 0; i < segIndex; i++) newPos += parts[i].length + 1;
      setCursorPosition(activeTab, newPos);
    }
  }, [activeTab, getActiveText, cursorPositions, setActiveText, setCursorPosition]);

  const getTabTitle = (tab: NotationTab): string => {
    const titles: Record<NotationTab, string> = {
      swar: 'Swar', stroke: 'Stroke', lyrics: 'Lyrics',
      bol: 'Tabla', pakhawajBol: 'Pakhawaj', mridangamBol: 'Mridangam',
      finger: 'Finger', layakari: 'Layakari',
    };
    return titles[tab];
  };

  const getTabIcon = (tab: NotationTab): string => {
    const icons: Record<NotationTab, string> = {
      swar: 'music', stroke: 'edit-3', lyrics: 'type',
      bol: 'disc', pakhawajBol: 'disc', mridangamBol: 'disc',
      finger: 'hand', layakari: 'grid',
    };
    return icons[tab] as any;
  };

  const currentBeatIndex = useMemo(() => {
    const text = activeTab === 'swar' ? swarText : getActiveText();
    const pos = cursorPositions[activeTab];
    const parts = text.split(',');
    let accum = 0;
    for (let i = 0; i < parts.length; i++) {
      if (pos <= accum + parts[i].length) return i + 1;
      accum += parts[i].length + 1;
    }
    return parts.length;
  }, [activeTab, swarText, getActiveText, cursorPositions]);

  if (isMenuView) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.container}>
          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
              <Feather name="chevron-left" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Add Notation</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Main content - flexible space */}
          <View style={{ flex: 1 }} />

          {/* Bottom Card for Selection */}
          <View style={s.bottomSelectionCard}>
            <View style={s.configRowHeader}>
              <TouchableOpacity style={s.symbolsBtn} onPress={() => setIsSymbolModalOpen(true)}>
                <Feather name="help-circle" size={16} color={theme.primary} />
                <Text style={s.symbolsText}>Symbols</Text>
              </TouchableOpacity>
            </View>

            {/* Config Selectors Row */}
            <View style={s.configSection}>
              {/* Line Dropdown */}
              <View style={[s.configField, { zIndex: 3000 }]}>
                <Text style={s.configLabel}>Line:</Text>
                <TouchableOpacity 
                    style={[s.configSelect, openedDropdown === 'line' && s.dropdownActive]}
                    onPress={() => setOpenedDropdown(openedDropdown === 'line' ? null : 'line')}
                >
                  <Text style={s.configValue} numberOfLines={1}>{selectedLineType}</Text>
                  <Feather name={openedDropdown === 'line' ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textSecondary} />
                </TouchableOpacity>
                {openedDropdown === 'line' && (
                    <View style={s.dropdownListContainer}>
                        <ScrollView style={s.dropdownList} nestedScrollEnabled>
                            {lineTypeOptions.map(opt => (
                                <TouchableOpacity 
                                    key={opt} 
                                    style={s.dropdownItem}
                                    onPress={() => { setSelectedLineType(opt); setOpenedDropdown(null); }}
                                >
                                    <Text style={[s.dropdownItemText, selectedLineType === opt && { color: theme.primary, fontWeight: '700' }]}>{opt}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}
              </View>

              {/* Start Beat Dropdown */}
              <View style={[s.configField, { zIndex: 3000 }]}>
                <Text style={s.configLabel}>Start Beat:</Text>
                <TouchableOpacity 
                    style={[s.configSelect, openedDropdown === 'startBeat' && s.dropdownActive]}
                    onPress={() => setOpenedDropdown(openedDropdown === 'startBeat' ? null : 'startBeat')}
                >
                  <Text style={s.configValue}>{startBeat}</Text>
                  <Feather name={openedDropdown === 'startBeat' ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textSecondary} />
                </TouchableOpacity>
                {openedDropdown === 'startBeat' && (
                    <View style={s.dropdownListContainer}>
                        <ScrollView style={s.dropdownList} nestedScrollEnabled>
                            {Array.from({ length: beatsPerCycle }).map((_, i) => (
                                <TouchableOpacity 
                                    key={i} 
                                    style={s.dropdownItem}
                                    onPress={() => { setStartBeat(i + 1); setOpenedDropdown(null); }}
                                >
                                    <Text style={[s.dropdownItemText, startBeat === i + 1 && { color: theme.primary, fontWeight: '700' }]}>{i + 1}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}
              </View>

              {/* Beats/Cycle Dropdown */}
              <View style={[s.configField, { zIndex: 3000 }]}>
                <Text style={s.configLabel}>Beats/Cycle</Text>
                <TouchableOpacity 
                    style={[s.configSelect, openedDropdown === 'beatsPerCycle' && s.dropdownActive]}
                    onPress={() => setOpenedDropdown(openedDropdown === 'beatsPerCycle' ? null : 'beatsPerCycle')}
                >
                  <Text style={s.configValue}>{beatsPerCycle}</Text>
                  <Feather name={openedDropdown === 'beatsPerCycle' ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textSecondary} />
                </TouchableOpacity>
                {openedDropdown === 'beatsPerCycle' && (
                    <View style={s.dropdownListContainer}>
                        <ScrollView style={s.dropdownList} nestedScrollEnabled>
                            {[4, 6, 7, 8, 9, 10, 11, 12, 14, 16].map(val => (
                                <TouchableOpacity 
                                    key={val} 
                                    style={s.dropdownItem}
                                    onPress={() => { setBeatsPerCycle(val); setOpenedDropdown(null); }}
                                >
                                    <Text style={[s.dropdownItemText, beatsPerCycle === val && { color: theme.primary, fontWeight: '700' }]}>{val}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}
              </View>
            </View>

            {/* Hub Buttons Row - Screen 1 */}
            <View style={s.hubRow}>
              {[
                { tab: 'swar', label: 'Swar', icon: 'grid' },
                { tab: 'lyrics', label: 'Lyrics', icon: 'file-text' },
                { tab: 'bol', label: 'Tabla', icon: 'circle' },
              ].map(item => (
                <TouchableOpacity 
                  key={item.tab} 
                  style={s.hubButton}
                  onPress={() => { setActiveTab(item.tab as any); setIsMenuView(false); }}
                >
                  <View style={s.hubIconCircle}>
                    <Feather name={item.icon as any} size={22} color={theme.primary} />
                  </View>
                  <Text style={s.hubLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          <NotationSymbolModal 
            isOpen={isSymbolModalOpen} 
            onClose={() => setIsSymbolModalOpen(false)} 
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea}>
      <KeyboardAvoidingView 
        style={s.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Saved Message Toast */}
        {showSavedMessage && (
          <View style={s.savedToast}>
            <Text style={s.savedToastText}>Saved</Text>
          </View>
        )}

        {/* Preview Table - Flexible and Scrollable */}
        <View style={s.previewAreaContainer}>
          <View style={s.previewHeader}>
            <Text style={s.previewTitle}>Preview</Text>
            <View style={s.previewAction}>
                <Text style={s.previewActionText}>Dotted note separators</Text>
                <View style={s.togglePlaceholder} />
            </View>
          </View>
          <NotationGrid 
            swarText={swarText} 
            activeBeatIndex={currentBeatIndex} 
            taalName="Teental"
          />
        </View>

        {/* Master Keyboard Card - Bottom Anchored */}
        <View style={s.keyboardArea}>
          {/* Tab Header Inside Card */}
          <View style={s.tabHeader}>
            <TouchableOpacity onPress={() => setIsMenuView(true)} style={s.backBtn}>
              <Feather name="chevron-left" size={28} color={theme.text} />
              <Text style={s.tabTitle}>{activeTab === 'swar' ? 'Swar' : getTabTitle(activeTab)}</Text>
            </TouchableOpacity>
            
            <View style={s.tabActions}>
              <TouchableOpacity onPress={handleClearCurrent} style={s.actionBtn}>
                <Feather name="refresh-cw" size={16} color="#7d848c" />
                <Text style={[s.actionLabel, { color: '#7d848c' }]}>Clear</Text>
              </TouchableOpacity>
              
              {activeTab === 'swar' && (
                <TouchableOpacity 
                  onPress={() => setShowSwarEffects(!showSwarEffects)} 
                  style={[
                    s.actionBtn, 
                    showSwarEffects && { backgroundColor: '#e3f2fd', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }
                  ]}
                >
                  <Feather name="music" size={16} color="#3498db" />
                  <Text style={[s.actionLabel, { color: '#3498db' }]}>Effects</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Dynamic Content Based on Tab */}
          <View style={s.keyboardContent}>
            {activeTab === 'swar' && <SwarKeyboard currentBeatIndex={currentBeatIndex} />}
            
            {['bol', 'pakhawajBol', 'mridangamBol'].includes(activeTab) && (
              <BolKeyboard instrument={activeTab === 'bol' ? 'tabla' : activeTab === 'pakhawajBol' ? 'pakhawaj' : 'mridangam'} />
            )}

            {activeTab === 'stroke' && (
              <View style={s.textInputArea}>
                <View style={s.beatBadge}>
                  <Text style={s.beatText}>Beat {currentBeatIndex}</Text>
                </View>
                <View style={s.pillGrid}>
                  {getStrokePresets([]).map(pill => (
                    <TouchableOpacity 
                      key={pill.label}
                      style={s.genericPill}
                      onPress={() => {
                        const text = strokeText;
                        const pos = cursorPositions.stroke;
                        const next = text.slice(0, pos) + pill.value + text.slice(pos);
                        setStrokeText(next);
                        setCursorPosition('stroke', pos + pill.value.length);
                      }}
                    >
                      <Text style={s.genericPillText}>{pill.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {activeTab === 'lyrics' && (
              <View style={s.textInputArea}>
                <View style={s.beatBadge}>
                  <Text style={s.beatText}>Beat {currentBeatIndex}</Text>
                </View>
                <TextInput
                  style={s.lyricsInput}
                  value={lyricsText}
                  onChangeText={(t) => {
                    setLyricsText(t);
                    setCursorPosition('lyrics', t.length);
                  }}
                  placeholder="Type lyrics here..."
                  placeholderTextColor={theme.textSecondary}
                  multiline
                />
              </View>
            )}

            {activeTab === 'finger' && (
              <View style={s.textInputArea}>
                <View style={s.beatBadge}>
                  <Text style={s.beatText}>Beat {currentBeatIndex}</Text>
                </View>
                <View style={s.pillGrid}>
                  {['1', '2', '3'].map(pill => (
                    <TouchableOpacity 
                      key={pill}
                      style={s.genericPill}
                      onPress={() => {
                        const text = fingerText;
                        const pos = cursorPositions.finger;
                        const next = text.slice(0, pos) + pill + ' ' + text.slice(pos);
                        setFingerText(next);
                        setCursorPosition('finger', pos + pill.length + 1);
                      }}
                    >
                      <Text style={s.genericPillText}>{pill}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Global Footer (Backspace, Nav, etc.) */}
          <NotationFooter onJumpBeat={jumpBeat} />
        </View>

        {/* Symbols Modal */}
        <NotationSymbolModal 
          isOpen={isSymbolModalOpen} 
          onClose={() => setIsSymbolModalOpen(false)} 
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
  },
  bottomSelectionCard: {
    backgroundColor: isDark ? '#1a1a1a' : '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  configRowHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  symbolsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  symbolsText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.primary,
    textDecorationLine: 'underline',
  },
  hubRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  hubButton: {
    flex: 1,
    backgroundColor: isDark ? '#2a2a2a' : '#f3f4f6',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  hubIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
  },
  hubLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
  },
  configSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 0, 
    zIndex: 2000, 
  },
  configField: {
    flex: 1,
    position: 'relative', 
  },
  configLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textSecondary,
    marginBottom: 4,
  },
  configSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDark ? '#1a1a1a' : '#fff',
    borderWidth: 1.5,
    borderColor: isDark ? '#333' : '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  dropdownActive: {
    borderColor: theme.primary,
  },
  configValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  dropdownListContainer: {
    position: 'absolute',
    bottom: '100%', 
    left: 0,
    right: 0,
    backgroundColor: isDark ? '#1a1a1a' : '#fff',
    borderWidth: 1.5,
    borderColor: isDark ? '#333' : '#e0e0e0',
    borderRadius: 12,
    marginBottom: 4,
    maxHeight: 200,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    zIndex: 5000,
  },
  dropdownList: {
    paddingVertical: 5,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: isDark ? '#2a2a2a' : '#f0f0f0',
  },
  dropdownItemText: {
    fontSize: 14,
    color: theme.text,
  },
  tabHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  tabTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
  },
  tabActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  previewAreaContainer: {
    flex: 1, 
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: isDark ? '#000' : '#f8f9fa',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.text,
  },
  previewAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewActionText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  togglePlaceholder: {
    width: 32,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.border,
  },
  keyboardArea: {
    padding: 8,
    paddingBottom: Platform.OS === 'ios' ? 12 : 6,
    backgroundColor: theme.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    elevation: 8,
    gap: 4, 
  },
  keyboardContent: {
    minHeight: 140,
    justifyContent: 'flex-start',
  },
  textInputArea: {
    flex: 1,
    gap: 16,
  },
  beatBadge: {
    alignSelf: 'center',
    backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 12,
  },
  beatText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
  },
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  genericPill: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: isDark ? '#2a2a2a' : '#e0e0e0',
  },
  genericPillText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  lyricsInput: {
    backgroundColor: isDark ? '#0a0a0a' : '#f9fafb',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: theme.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  savedToast: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    zIndex: 100,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  savedToastText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
