import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Image, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, useNotationStore } from '@music-app/store';

const avagrahaImg = require('../../assets/notation/avagraha symbol.webp');

interface NotationFooterProps {
  onJumpBeat: (direction: 'prev' | 'next') => void;
}

export default function NotationFooter({ onJumpBeat }: NotationFooterProps) {
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const { 
    activeTab, getActiveText, setActiveText,
    cursorPositions, setCursorPosition, bolLanguage,
  } = useNotationStore();
  const isDark = theme.background === '#000000';
  const s = createStyles(theme, isDark);

  const insertAtCursor = (value: string) => {
    const text = getActiveText();
    const pos = cursorPositions[activeTab];
    const next = text.slice(0, pos) + value + text.slice(pos);
    const newPos = pos + value.length;
    setActiveText(next);
    setCursorPosition(activeTab, newPos);
  };

  const handleBackspace = () => {
    const text = getActiveText();
    const pos = cursorPositions[activeTab];
    if (pos <= 0) return;

    let deleteFrom = pos - 1;
    const isBolTab = ['bol', 'pakhawajBol', 'mridangamBol'].includes(activeTab);
    
    if ((activeTab === 'swar' || isBolTab) && text[pos - 1] === ' ' && pos > 1) {
      let i = pos - 2;
      while (i >= 0 && text[i] !== ' ' && text[i] !== ',') i--;
      deleteFrom = i + 1;
    }

    const next = text.slice(0, deleteFrom) + text.slice(pos);
    setActiveText(next);
    setCursorPosition(activeTab, deleteFrom);
  };

  const handleInsertS = () => {
    const s = activeTab === 'lyrics' ? 'ऽ' : bolLanguage === 'hi' && ['bol', 'pakhawajBol', 'mridangamBol'].includes(activeTab) ? 'ऽ ' : 'S ';
    insertAtCursor(s);
  };

  const handleInsertDash = () => {
    insertAtCursor('- ');
  };

  const handleInsertSpace = () => {
    insertAtCursor(' ');
  };

  // The screen owns both intra-beat and inter-beat navigation.
  const handleNavigate = onJumpBeat;

  return (
    <View style={s.footer}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Previous notation position" style={[s.largePill, width >= 700 && s.largePillWide]} onPress={() => handleNavigate('prev')}>
        <Feather name="chevron-left" size={24} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Insert space"
        style={[s.smallPill, s.spacePill]} onPress={handleInsertSpace}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={s.smallPillText}>Spc</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.smallPill} onPress={handleBackspace}>
        <Feather name="delete" size={20} color="#111" />
      </TouchableOpacity>

      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Avagraha" style={[s.smallPill, s.avagrahaPill]} onPress={handleInsertS}>
        <Image source={avagrahaImg} style={s.avagrahaIcon} />
      </TouchableOpacity>

      <TouchableOpacity style={s.smallPill} onPress={handleInsertDash}>
        <Text style={s.symbolText}>-</Text>
      </TouchableOpacity>

      {['bol', 'pakhawajBol', 'mridangamBol'].includes(activeTab) && <TouchableOpacity style={s.smallPill} onPress={() => insertAtCursor('/')}><Text style={s.symbolText}>/</Text></TouchableOpacity>}

      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Next notation position" style={[s.largePill, width >= 700 && s.largePillWide]} onPress={() => handleNavigate('next')}>
        <Feather name="chevron-right" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  footer: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderTopWidth: 1,
    borderTopColor: isDark ? '#1a1a1a' : '#e5e7eb',
    paddingBottom: Platform.OS === 'ios' ? 8 : 4,
  },
  largePill: {
    width: 52,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  largePillWide: { width: undefined, flex: 1.7, maxWidth: 180 },
  smallPill: {
    flex: 1,
    height: 44,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  smallPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  // Five controls share this row on percussion keyboards. Keep enough inline
  // room for all three letters without increasing the overall footer width.
  spacePill: { minWidth: 34, paddingHorizontal: 3 },
  symbolText: { fontSize: 23, fontWeight: '700', color: '#111' },
  avagrahaPill: { paddingHorizontal: 4, overflow: 'visible' },
  // Same asset and scale as Web Beta; the image includes transparent padding.
  avagrahaIcon: { width: 34, height: 34, resizeMode: 'contain', transform: [{ scale: 1.75 }] },
  sPillText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  subLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7d848c',
    marginTop: -2,
    textAlign: 'center',
  },
});
