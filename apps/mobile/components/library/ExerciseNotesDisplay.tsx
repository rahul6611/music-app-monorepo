import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@music-app/store';

interface ExerciseNotesDisplayProps {
  notes: any[];
}

const ExerciseNotesDisplay: React.FC<ExerciseNotesDisplayProps> = ({ notes }) => {
  const theme = useTheme();
  const isDark = theme.background === '#000000';

  if (!notes || notes.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1a1a1a' : '#f0f2f5', borderColor: theme.border }]}>
      <View style={styles.grid}>
        {notes.map((note, idx) => (
          <View key={idx} style={[styles.cell, { borderColor: theme.border }]}>
            <Text style={[styles.noteText, { color: theme.text }]}>
              {note || '-'}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    marginTop: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  cell: {
    minWidth: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  noteText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

export default ExerciseNotesDisplay;
