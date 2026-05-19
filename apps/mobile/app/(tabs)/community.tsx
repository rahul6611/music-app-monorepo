import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@music-app/store';
import React, { useState } from 'react';
import MediaPostCreator from '../../components/community/MediaPostCreator';
import MediaFeed from '../../components/community/MediaFeed';
import { useMediaRecovery } from '../../hooks/useMediaRecovery';
import { useCameraStore } from '@music-app/store';
import { processCapturedMedia, UploadProgress } from '@music-app/firebase';
import { Alert } from 'react-native';

export default function Community() {
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const isWebDesktop = Platform.OS === 'web' && windowWidth >= 768;
  const styles = createStyles(theme, isWebDesktop);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const cameraStore = useCameraStore();

  React.useEffect(() => {
    if (cameraStore.isActive) {
      setIsSheetVisible(false);
    }
  }, [cameraStore.isActive]);
  
  useMediaRecovery();

  const handlePostComplete = () => {
    setRefreshTrigger(prev => prev + 1);
    setIsSheetVisible(false);
  };

  const uploadMedia = async (uri: string) => {
    try {
      await processCapturedMedia(
        uri,
        cameraStore.mode,
        (progress) => {
          console.log(`Upload progress: ${progress.progress}%`);
        },
        (url) => {
          Alert.alert('Success', `Camera recording uploaded successfully!`);
          handlePostComplete();
        },
        (error) => {
          Alert.alert('Upload Failed', error);
        }
      );
    } catch (err) {
      console.error(err);
    }
  };

  React.useEffect(() => {
    if (cameraStore.capturedUri) {
      const uri = cameraStore.capturedUri;
      cameraStore.setCapturedUri(null);
      uploadMedia(uri);
    }
  }, [cameraStore.capturedUri]);

  return (
    <SafeAreaView style={[
      styles.container,
      isWebDesktop && {
        width: '100%',
        marginTop: 24,
        borderRadius: 24,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: theme.border,
        overflow: 'hidden',
        backgroundColor: theme.card,
      }
    ]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Community</Text>
        <TouchableOpacity 
          style={[styles.addButton, { backgroundColor: theme.primary }]}
          onPress={() => setIsSheetVisible(true)}
        >
          <Ionicons name="add" size={24} color="#FFF" />
          <Text style={styles.addButtonText}>Post</Text>
        </TouchableOpacity>
      </View>
      <MediaFeed refreshTrigger={refreshTrigger} />
      <Modal
        visible={isSheetVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsSheetVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <TouchableOpacity 
            style={styles.sheetOverlay} 
            activeOpacity={1} 
            onPress={() => setIsSheetVisible(false)}
          >
            <View style={[styles.sheetContent, { backgroundColor: theme.background }]}>
              <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>New Post</Text>
                <TouchableOpacity onPress={() => setIsSheetVisible(false)}>
                  <Ionicons name="close-circle" size={28} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
              <MediaPostCreator 
                onComplete={handlePostComplete} 
                showSocialLinks={true}
              />
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: any, isWebDesktop?: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: theme.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  addButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  feedPlaceholder: {
    marginTop: 40,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  placeholderText: {
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.7,
  },
  feedHeader: {
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 15,
  },
  feedTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: isWebDesktop ? 'center' : 'flex-end',
    alignItems: isWebDesktop ? 'center' : 'stretch',
  },
  sheetContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    width: '100%',
    ...(isWebDesktop ? {
      maxWidth: 600,
      borderRadius: 24,
      paddingHorizontal: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
    } : {}),
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 20,
    ...(isWebDesktop ? { display: 'none' } : {}),
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: isWebDesktop ? 20 : 0,
    marginBottom: 10,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
});
