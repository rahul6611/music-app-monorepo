import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUploadStore } from '@music-app/store';
import { useTheme } from '@music-app/store';

const { width } = Dimensions.get('window');

export default function GlobalUploadProgress() {
  const theme = useTheme();
  const uploads = useUploadStore((state) => state.uploads);
  const clearCompleted = useUploadStore((state) => state.clearCompleted);
  const removeUpload = useUploadStore((state) => state.removeUpload);
  
  const uploadList = Object.values(uploads);
  const activeUploads = uploadList.filter(u => u.status !== 'completed' && u.status !== 'failed');
  const completedUploads = uploadList.filter(u => u.status === 'completed' || u.status === 'failed');

  const [expanded, setExpanded] = useState(false);
  const translateY = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    if (uploadList.length > 0) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: 200,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [uploadList.length]);

  if (uploadList.length === 0) return null;

  const mainUpload = activeUploads.length > 0 ? activeUploads[0] : completedUploads[0];

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          backgroundColor: theme.card, 
          borderColor: theme.border,
          transform: [{ translateY }]
        }
      ]}
    >
      <TouchableOpacity 
        activeOpacity={0.8}
        onPress={() => setExpanded(!expanded)}
        style={styles.header}
      >
        <View style={styles.statusInfo}>
          <View style={[styles.iconContainer, { backgroundColor: theme.primarySoft }]}>
            {mainUpload.status === 'uploading' ? (
              <Ionicons name="cloud-upload" size={18} color={theme.primary} />
            ) : mainUpload.status === 'processing' ? (
              <Ionicons name="sync" size={18} color={theme.primary} />
            ) : mainUpload.status === 'completed' ? (
              <Ionicons name="checkmark-circle" size={18} color={theme.success || '#10b981'} />
            ) : (
              <Ionicons name="alert-circle" size={18} color={theme.danger} />
            )}
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
              {activeUploads.length > 1 
                ? `Uploading ${activeUploads.length} items...` 
                : mainUpload.name}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {mainUpload.chunkInfo || mainUpload.status}
            </Text>
          </View>
        </View>
        
        <View style={styles.actions}>
          {activeUploads.length === 0 && (
            <TouchableOpacity onPress={clearCompleted} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
          <Ionicons 
            name={expanded ? "chevron-down" : "chevron-up"} 
            size={20} 
            color={theme.textSecondary} 
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.expandedContent}>
          {uploadList.map((upload) => (
            <View key={upload.id} style={styles.uploadItem}>
              <View style={styles.itemHeader}>
                <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>{upload.name}</Text>
                <Text style={[styles.itemPercent, { color: theme.primary }]}>{upload.progress}%</Text>
              </View>
              <View style={[styles.progressBarBg, { backgroundColor: theme.primarySoft }]}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { 
                      backgroundColor: upload.status === 'failed' ? theme.danger : theme.primary, 
                      width: `${upload.progress}%` 
                    }
                  ]} 
                />
              </View>
            </View>
          ))}
        </View>
      )}

      {mainUpload.status !== 'completed' && mainUpload.status !== 'failed' && !expanded && (
        <View style={[styles.miniProgressBar, { backgroundColor: theme.primarySoft }]}>
          <View 
            style={[
              styles.miniProgressBarFill, 
              { backgroundColor: theme.primary, width: `${mainUpload.progress}%` }
            ]} 
          />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 90 : 70,
    width: width - 32,
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 9999,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 11,
    opacity: 0.7,
    marginTop: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closeBtn: {
    padding: 4,
  },
  miniProgressBar: {
    height: 3,
    width: '100%',
  },
  miniProgressBarFill: {
    height: '100%',
  },
  expandedContent: {
    padding: 12,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  uploadItem: {
    marginVertical: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  itemName: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    marginRight: 10,
  },
  itemPercent: {
    fontSize: 12,
    fontWeight: '800',
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
});
