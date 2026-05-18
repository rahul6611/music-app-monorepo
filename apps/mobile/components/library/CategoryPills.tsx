import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { useTheme } from '@music-app/store';

interface CategoryPillsProps {
  categories: any[];
  activeId: string;
  onSelect: (id: string) => void;
}

export default function CategoryPills({ categories, activeId, onSelect }: CategoryPillsProps) {
  const theme = useTheme();
  
  return (
    <View style={styles.container}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {categories.map((cat) => {
          const isActive = cat.id === activeId;
          return (
            <TouchableOpacity
              key={cat.id}
              onPress={() => onSelect(cat.id)}
              style={[
                styles.pill,
                isActive ? { backgroundColor: theme.primary } : { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }
              ]}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.label,
                isActive ? { color: '#FFF', fontWeight: '800' } : { color: theme.textSecondary, fontWeight: '600' }
              ]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    fontSize: 14,
  },
});
