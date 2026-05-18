import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@music-app/store';
import { useNotationStore, NotationTab } from '@music-app/store';

interface NotationFooterProps {
  onJumpBeat: (direction: 'prev' | 'next') => void;
}

export default function NotationFooter({ onJumpBeat }: NotationFooterProps) {
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
    const s = bolLanguage === 'hi' ? 'ऽ ' : 'S ';
    insertAtCursor(s);
  };

  const handleInsertDash = () => {
    insertAtCursor('- ');
  };

  const handleInsertSpace = () => {
    insertAtCursor(' ');
  };

  return (
    <View style={s.footer}>
      <TouchableOpacity style={s.largePill} onPress={() => onJumpBeat('prev')}>
        <Feather name="chevron-left" size={24} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity style={s.smallPill} onPress={handleInsertSpace}>
        <Text style={s.smallPillText}>Spc</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.smallPill} onPress={handleBackspace}>
        <Feather name="delete" size={20} color={theme.text} />
      </TouchableOpacity>

      <TouchableOpacity style={s.smallPill} onPress={handleInsertS}>
        <Text style={s.smallPillText}>S</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.smallPill} onPress={handleInsertDash}>
        <Text style={s.smallPillText}>—</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.largePill} onPress={() => onJumpBeat('next')}>
        <Feather name="chevron-right" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  footer: {
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
  smallPill: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: isDark ? '#2a2a2a' : '#e0e0e0',
  },
  smallPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
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
