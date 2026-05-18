import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '@music-app/store';
import { useNotationStore, NotationTab } from '@music-app/store';
import { TABLA_BOL_GROUPS, PAKHAVAJ_BOL_GROUPS, MRIDANGAM_BOL_GROUPS, BolGroup } from '@music-app/utils';

interface BolKeyboardProps {
  instrument: 'tabla' | 'pakhawaj' | 'mridangam';
}

export default function BolKeyboard({ instrument }: BolKeyboardProps) {
  const theme = useTheme();
  const { 
    bolLanguage, setBolLanguage,
    bolText, setBolText, pakhawajBolText, setPakhawajBolText,
    mridangamBolText, setMridangamBolText,
    cursorPositions, setCursorPosition,
  } = useNotationStore();
  
  const isDark = theme.background === '#000000';
  const s = createStyles(theme, isDark);

  const tabKey: NotationTab = instrument === 'pakhawaj' ? 'pakhawajBol' : instrument === 'mridangam' ? 'mridangamBol' : 'bol';

  const getText = () => {
    if (instrument === 'pakhawaj') return pakhawajBolText;
    if (instrument === 'mridangam') return mridangamBolText;
    return bolText;
  };

  const setText = (v: string) => {
    if (instrument === 'pakhawaj') setPakhawajBolText(v);
    else if (instrument === 'mridangam') setMridangamBolText(v);
    else setBolText(v);
  };

  const insertBol = (value: string) => {
    const text = getText();
    const pos = cursorPositions[tabKey];
    const next = text.slice(0, pos) + value + ' ' + text.slice(pos);
    const newPos = pos + value.length + 1;
    setText(next);
    setCursorPosition(tabKey, newPos);
  };

  const groups: BolGroup[] = instrument === 'pakhawaj' 
    ? PAKHAVAJ_BOL_GROUPS 
    : instrument === 'mridangam' 
      ? MRIDANGAM_BOL_GROUPS 
      : TABLA_BOL_GROUPS;

  const sections: Record<string, BolGroup[]> = {};
  groups.forEach(g => {
    if (!g.isDivider) {
      const key = g.section;
      if (!sections[key]) sections[key] = [];
      sections[key].push(g);
    }
  });

  const sectionOrder = ['left', 'right', 'both', 'phrases'];
  const sectionLabels: Record<string, string> = {
    left: 'Left', right: 'Right', both: 'Both', phrases: 'Phrases'
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.beatBadge}>
          <Text style={s.beatText}>Beat 1</Text>
        </View>
        <View style={s.langToggle}>
          <TouchableOpacity 
            style={[s.langBtn, bolLanguage === 'en' && s.langBtnActive]}
            onPress={() => setBolLanguage('en')}
          >
            <Text style={[s.langBtnText, bolLanguage === 'en' && s.langBtnTextActive]}>EN</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[s.langBtn, bolLanguage === 'hi' && s.langBtnActive]}
            onPress={() => setBolLanguage('hi')}
          >
            <Text style={[s.langBtnText, bolLanguage === 'hi' && s.langBtnTextActive]}>HI</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={s.scrollArea}>
        {sectionOrder.map(sectionKey => {
          const items = sections[sectionKey];
          if (!items || items.length === 0) return null;

          return (
            <View key={sectionKey} style={s.section}>
              <Text style={s.sectionLabel}>{sectionLabels[sectionKey]}</Text>
              <View style={s.pillGrid}>
                {items.map(item => {
                  const label = item.mainBol[bolLanguage] || item.mainBol.en;
                  return (
                    <TouchableOpacity 
                      key={item.id} 
                      style={s.bolPill}
                      onPress={() => insertBol(label)}
                    >
                      <Text style={s.bolPillText}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  beatBadge: {
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
  langToggle: {
    flexDirection: 'row',
    backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0',
    borderRadius: 16,
    padding: 2,
  },
  langBtn: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
  },
  langBtnActive: {
    backgroundColor: isDark ? '#2d2d2d' : '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  langBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  langBtnTextActive: {
    color: theme.text,
  },
  scrollArea: {
    flex: 1,
  },
  section: {
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  bolPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDark ? '#2a2a2a' : '#e0e0e0',
  },
  bolPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
});
