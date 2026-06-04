import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@music-app/store';
import type { AssignmentItem, ClassAssignment } from '@music-app/types';

interface ClassContentPanelProps {
  assignment: ClassAssignment;
  onSelectItem?: (item: AssignmentItem) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  exercise: 'Patterns',
  taal: 'Tabla',
  raag: 'Raags',
  song: 'Songs',
};

const ClassContentPanel: React.FC<ClassContentPanelProps> = ({
  assignment,
  onSelectItem,
  collapsed = false,
  onToggleCollapse,
}) => {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const items = assignment.assignments || [];
  const grouped = items.reduce<Record<string, AssignmentItem[]>>((acc, item) => {
    const key = item.type === 'taal' ? 'exercise' : item.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const selected = items.find((i) => i.id === selectedId);

  if (collapsed && !isWide) {
    return (
      <TouchableOpacity
        style={[styles.collapsedTab, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={onToggleCollapse}
      >
        <MaterialIcons name="menu-book" size={20} color={theme.primary} />
        <Text style={[styles.collapsedLabel, { color: theme.text }]}>Content</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={[styles.panelHeader, { borderBottomColor: theme.border }]}>
        <View>
          <Text style={[styles.panelTitle, { color: theme.text }]}>Class Content</Text>
          <Text style={[styles.panelSubtitle, { color: theme.textSecondary }]}>
            {assignment.classDate}
            {assignment.classTime ? ` · ${assignment.classTime}` : ''}
          </Text>
        </View>
        {!isWide && onToggleCollapse && (
          <TouchableOpacity onPress={onToggleCollapse} hitSlop={12}>
            <MaterialIcons name="close" size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {Object.entries(grouped).map(([type, typeItems]) => (
          <View key={type} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              {TYPE_LABELS[type] || type}
            </Text>
            {typeItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.itemRow,
                  {
                    backgroundColor: selectedId === item.id ? theme.primarySoft : 'transparent',
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => {
                  setSelectedId(item.id);
                  onSelectItem?.(item);
                }}
              >
                <MaterialIcons
                  name={
                    item.type === 'raag'
                      ? 'music-note'
                      : item.type === 'song'
                        ? 'library-music'
                        : 'fitness-center'
                  }
                  size={18}
                  color={theme.primary}
                />
                <View style={styles.itemText}>
                  <Text style={[styles.itemTitle, { color: theme.text }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>
                    {item.repetitions ? `${item.repetitions} reps` : ''}
                    {item.bpm
                      ? `${item.repetitions ? ' · ' : ''}${Array.isArray(item.bpm) ? item.bpm.join('/') : item.bpm} BPM`
                      : ''}
                    {item.minutes ? ` · ${item.minutes} min` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {items.length === 0 && (
          <Text style={[styles.empty, { color: theme.textSecondary }]}>
            No exercises assigned for this class yet.
          </Text>
        )}
      </ScrollView>

      {selected && (
        <View style={[styles.detail, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
          <Text style={[styles.detailTitle, { color: theme.text }]}>{selected.title}</Text>
          {selected.repetitions != null && (
            <Text style={[styles.detailLine, { color: theme.textSecondary }]}>
              Repetitions: {selected.repetitions}
            </Text>
          )}
          {selected.bpm != null && (
            <Text style={[styles.detailLine, { color: theme.textSecondary }]}>
              BPM: {Array.isArray(selected.bpm) ? selected.bpm.join(' → ') : selected.bpm}
            </Text>
          )}
          {selected.accompanimentType && selected.accompanimentType !== 'none' && (
            <Text style={[styles.detailLine, { color: theme.textSecondary }]}>
              Accompaniment: {selected.accompanimentType}
            </Text>
          )}
          <Text style={[styles.detailHint, { color: theme.textSecondary }]}>
            Full notation opens from the Library — this panel keeps lesson material visible during the call.
          </Text>
        </View>
      )}

      {assignment.recordingUrl ? (
        <TouchableOpacity
          style={[styles.recordingBanner, { backgroundColor: theme.primarySoft }]}
          onPress={() => Linking.openURL(assignment.recordingUrl!)}
        >
          <MaterialIcons name="videocam" size={16} color={theme.primary} />
          <Text style={[styles.recordingText, { color: theme.primary }]} numberOfLines={1}>
            Watch previous class recording
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    borderLeftWidth: 1,
    flex: 1,
    minWidth: 280,
    maxWidth: 400,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  panelTitle: { fontWeight: '700' },
  panelSubtitle: { marginTop: 2 },
  list: { flex: 1 },
  listContent: { padding: 12, paddingBottom: 24 },
  section: { marginBottom: 16 },
  sectionTitle: { fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  itemText: { flex: 1 },
  itemTitle: { fontWeight: '600' },
  itemMeta: { marginTop: 2, fontSize: 12 },
  empty: { textAlign: 'center', padding: 24 },
  detail: {
    borderTopWidth: 1,
    padding: 16,
  },
  detailTitle: { fontWeight: '700', fontSize: 16, marginBottom: 8 },
  detailLine: { fontSize: 13, marginBottom: 4 },
  detailHint: { fontSize: 12, marginTop: 8, fontStyle: 'italic' },
  recordingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    margin: 12,
    borderRadius: 8,
  },
  recordingText: { flex: 1, fontWeight: '600' },
  collapsedTab: {
    position: 'absolute',
    right: 12,
    top: 12,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  collapsedLabel: { fontWeight: '600' },
});

export default ClassContentPanel;
