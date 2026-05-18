import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@music-app/store';

interface LibraryCardProps {
  title: string;
  description?: string;
  image?: string;
  badge?: string;
  count?: number;
  onPress: () => void;
  isSystem?: boolean;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

export default function LibraryCard({ 
  title, 
  description, 
  image, 
  badge, 
  count, 
  onPress,
  isSystem
}: LibraryCardProps) {
  const theme = useTheme();
  const isDark = theme.background === '#000000';
  const isWeb = Platform.OS === 'web';

  return (
    <TouchableOpacity 
      style={[
        styles.card, 
        { 
          backgroundColor: theme.card,
          borderColor: theme.border,
        },
        isWeb && { width: undefined }
      ]}
      className={isWeb ? "w-full sm:w-[48%] md:w-[48%] lg:w-[31%] xl:w-[23%]" : ""}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.imageContainer}>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} />
        ) : (
          <View style={[styles.placeholder, { backgroundColor: isDark ? '#1A1A1A' : '#F3F4F6' }]}>
            <Ionicons name="musical-note" size={32} color={theme.textSecondary} style={{ opacity: 0.3 }} />
          </View>
        )}
        
        {isSystem && (
          <View style={[styles.systemBadge, { backgroundColor: theme.primary }]}>
            <Text style={styles.systemBadgeText}>SYSTEM</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          {title}
        </Text>
        
        {description && (
          <Text style={[styles.description, { color: theme.textSecondary }]} numberOfLines={1}>
            {description}
          </Text>
        )}

        {(count !== undefined || badge) && (
          <View style={styles.footer}>
            {count !== undefined && (
              <Text style={[styles.count, { color: theme.primary }]}>
                {count} {count === 1 ? 'Item' : 'Items'}
              </Text>
            )}
            {badge && (
              <View style={[styles.badge, { backgroundColor: theme.primarySoft }]}>
                <Text style={[styles.badgeText, { color: theme.primary }]}>{badge}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  imageContainer: {
    width: '100%',
    height: 120,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  systemBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  systemBadgeText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  content: {
    padding: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  count: {
    fontSize: 10,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
