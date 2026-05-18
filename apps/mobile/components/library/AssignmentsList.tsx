import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@music-app/store';

interface AssignmentsListProps {
  assignments: any[];
}

export default function AssignmentsList({ assignments }: AssignmentsListProps) {
  const theme = useTheme();

  if (assignments.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="calendar-outline" size={64} color={theme.textSecondary} style={{ opacity: 0.3 }} />
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No assignments yet</Text>
      </View>
    );
  }

  const grouped = assignments.reduce((acc: any, curr: any) => {
    const date = curr.classDate || 'Upcoming';
    if (!acc[date]) acc[date] = [];
    acc[date].push(curr);
    return acc;
  }, {});

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {Object.entries(grouped).map(([date, items]: [string, any]) => (
        <View key={date} style={styles.section}>
          <View style={styles.dateHeader}>
            <Ionicons name="calendar" size={18} color={theme.primary} />
            <Text style={[styles.dateText, { color: theme.text }]}>{date}</Text>
          </View>
          
          {items.map((ca: any) => (
            <View key={ca.id} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.timeText, { color: theme.textSecondary }]}>{ca.classTime || 'New Plan'}</Text>
              </View>
              
              {ca.assignments.map((as: any, idx: number) => (
                <TouchableOpacity key={idx} style={[styles.assignmentItem, { backgroundColor: theme.primarySoft }]}>
                  <View style={styles.assignmentMain}>
                    <View style={[styles.typeBadge, { backgroundColor: theme.primary }]}>
                      <Text style={styles.typeText}>{as.type}</Text>
                    </View>
                    <Text style={[styles.title, { color: theme.text }]}>{as.title}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.primary} />
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  section: {
    marginBottom: 24,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dateText: {
    fontSize: 18,
    fontWeight: '800',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    marginBottom: 12,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  assignmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  assignmentMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
});
