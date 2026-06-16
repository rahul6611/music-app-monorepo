import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getYouTubeToken,
  loginWithYouTube,
  uploadVideoToYouTube,
} from '../../utils/oauthShareActions';

interface YouTubeUploadModalProps {
  visible: boolean;
  onClose: () => void;
  post: any;
  theme: any;
}

export default function YouTubeUploadModal({
  visible,
  onClose,
  post,
  theme,
}: YouTubeUploadModalProps) {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'unlisted' | 'private'>('public');
  const [busyUploading, setBusyUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  useEffect(() => {
    if (visible && post) {
      setTitle(post.title || post.fileName?.split('.')?.[0] || 'Musiki Performance');
      setDescription(`${post.notes || ''}\n\nWatch full performances on Musiki!`);
      checkAuthentication();
    } else {
      setUploadStatus('');
    }
  }, [visible, post]);

  const checkAuthentication = async () => {
    setLoading(true);
    try {
      const token = await getYouTubeToken();
      if (!token) {
        await loginWithYouTube();
      }
    } catch (error: any) {
      console.error(error);
      Alert.alert('YouTube Integration Error', error.message || 'Google Authentication failed.');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter a title for your YouTube video.');
      return;
    }

    setBusyUploading(true);
    setUploadStatus('Preparing video file...');
    try {
      let token = await getYouTubeToken();
      if (!token) {
        token = await loginWithYouTube();
      }

      await uploadVideoToYouTube({
        accessToken: token,
        title: title.trim(),
        description: description.trim(),
        privacy,
        post,
        onProgress: (percent) => {
          if (percent === 0) {
            setUploadStatus('Downloading video file to cache...');
          } else {
            setUploadStatus(`Uploading video: ${percent}%`);
          }
        },
      });

      Alert.alert('Success', 'Your video has been successfully uploaded to YouTube!');
      onClose();
    } catch (error: any) {
      console.error(error);
      Alert.alert('YouTube Upload Failed', error.message || 'Something went wrong during the upload.');
    } finally {
      setBusyUploading(false);
      setUploadStatus('');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable style={styles.background} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Upload to YouTube</Text>
            <TouchableOpacity onPress={onClose} disabled={busyUploading}>
              <Ionicons name="close-circle" size={26} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                Connecting YouTube Channel...
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              {busyUploading ? (
                <View style={styles.centerContainer}>
                  <ActivityIndicator size="large" color={theme.primary} />
                  <Text style={[styles.statusText, { color: theme.text }]}>{uploadStatus || 'Uploading...'}</Text>
                  <Text style={[styles.subStatusText, { color: theme.textSecondary }]}>
                    Please keep the app open during the process.
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Video Title</Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: theme.inputBackground,
                        color: theme.inputText,
                        borderColor: theme.border,
                      },
                    ]}
                    placeholder="Enter video title..."
                    placeholderTextColor={theme.textSecondary}
                    value={title}
                    onChangeText={setTitle}
                    maxLength={100}
                  />

                  <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 12 }]}>
                    Description
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: theme.inputBackground,
                        color: theme.inputText,
                        borderColor: theme.border,
                        minHeight: 100,
                      },
                    ]}
                    placeholder="Enter video description..."
                    placeholderTextColor={theme.textSecondary}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={4}
                  />

                  <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 12 }]}>
                    Privacy Status
                  </Text>
                  <View style={styles.privacyRow}>
                    {(['public', 'unlisted', 'private'] as const).map((status) => {
                      const isSelected = privacy === status;
                      return (
                        <TouchableOpacity
                          key={status}
                          style={[
                            styles.privacyButton,
                            isSelected && { backgroundColor: theme.primary },
                            { borderColor: theme.border },
                          ]}
                          onPress={() => setPrivacy(status)}
                        >
                          <Text
                            style={[
                              styles.privacyText,
                              { color: isSelected ? '#FFF' : theme.text },
                            ]}
                          >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.uploadButton,
                      { backgroundColor: theme.primary },
                      !title.trim() && { opacity: 0.5 },
                    ]}
                    onPress={handleUpload}
                    disabled={!title.trim()}
                  >
                    <Text style={styles.uploadButtonText}>Publish to YouTube</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  centerContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  statusText: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  subStatusText: {
    marginTop: 6,
    fontSize: 12,
    textAlign: 'center',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    minHeight: 48,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  privacyRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  privacyButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  privacyText: {
    fontSize: 12,
    fontWeight: '700',
  },
  uploadButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  uploadButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
