import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@music-app/store';
import { ParsedPhraseCell, PhraseRow } from '@music-app/utils';

interface NotationTableProps {
  parsedData: ParsedPhraseCell[];
  beatsPerCycle: number;
  lineLabel: string;
}

export default function NotationTable({ parsedData, beatsPerCycle, lineLabel }: NotationTableProps) {
  const theme = useTheme();
  const isDark = theme.background === '#000000';
  const s = createStyles(theme, isDark);

  const renderHeaders = () => {
    const headers = [];
    for (let i = 1; i <= beatsPerCycle; i++) {
        let symbol = '';
        if (beatsPerCycle === 16) {
            if (i === 1) symbol = 'X';
            else if (i === 5) symbol = '2';
            else if (i === 9) symbol = '0';
            else if (i === 13) symbol = '3';
        } else if (beatsPerCycle === 8) {
            if (i === 1) symbol = 'X';
            else if (i === 5) symbol = '0';
        }

      headers.push(
        <View key={i} style={s.headerCell}>
          <Text style={s.headerText}>{i}</Text>
          {symbol ? <Text style={s.symbolText}>{symbol}</Text> : null}
        </View>
      );
    }
    return headers;
  };

  const renderContent = (data: (string | PhraseRow)[]) => {
    return data.map((item, idx) => {
      if (typeof item === 'string') {
        return <Text key={idx} style={s.noteText}>{item}</Text>;
      } else {
        return (
          <View key={idx} style={[s.phraseContainer, item.type.startsWith('/') && s.slashContainer]}>
            {renderContent(item.content)}
          </View>
        );
      }
    });
  };

  const beatMap: Record<number, ParsedPhraseCell[]> = {};
  parsedData.forEach(cell => {
    if (!beatMap[cell.beatIndex]) beatMap[cell.beatIndex] = [];
    beatMap[cell.beatIndex].push(cell);
  });

  const renderBeats = () => {
    const beats = [];
    for (let i = 1; i <= beatsPerCycle; i++) {
      const cells = beatMap[i] || [];
      beats.push(
        <View key={i} style={s.cell}>
          {cells.map((cell, idx) => (
            <View key={idx} style={s.cellData}>
              {renderContent(cell.data)}
            </View>
          ))}
        </View>
      );
    }
    return beats;
  };

  return (
    <View style={s.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={s.table}>
          <View style={s.row}>
            <View style={[s.headerCell, s.labelCell]}>
               <View style={s.gridIcon} />
            </View>
            {renderHeaders()}
          </View>

          <View style={s.row}>
            <View style={[s.cell, s.labelCell]}>
              <Text style={s.lineLabelText}>{lineLabel}</Text>
            </View>
            {renderBeats()}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: {
    backgroundColor: isDark ? '#111' : '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
    marginVertical: 10,
  },
  table: {
    flexDirection: 'column',
  },
  row: {
    flexDirection: 'row',
  },
  headerCell: {
    width: 60,
    height: 50,
    backgroundColor: isDark ? '#1a1b2e' : '#c2c5e8',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelCell: {
    width: 80,
    backgroundColor: isDark ? '#0a0a0a' : '#f9fafb',
  },
  headerText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
  },
  symbolText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.text,
    position: 'absolute',
    bottom: 2,
  },
  cell: {
    width: 60,
    minHeight: 50,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  cellData: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  noteText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  lineLabelText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.primary,
  },
  gridIcon: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: theme.textSecondary,
    borderStyle: 'dashed',
  },
  phraseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.text,
  },
  slashContainer: {
    borderBottomWidth: 2,
  }
});
