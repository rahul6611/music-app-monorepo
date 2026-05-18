import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Modal, ActivityIndicator, TextInput, Image } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useTheme } from '@music-app/store';
import { MediaType, pickMedia, recordMedia, processCapturedMedia, UploadProgress, saveSocialToFirebase } from '@music-app/firebase';
import { AudioRecorder, AudioModule, useAudioRecorder, RecordingPresets } from 'expo-audio';
import { useCameraStore } from '@music-app/store';
import { parseSocialVideo, getSocialTypeLabel, SocialVideoType } from '@music-app/utils';

export type MediaCreatorResult = {
  type: string;
  url: string;
  title?: string;
  fileSize?: number;
  fileName?: string;
  socialType?: SocialVideoType;
  socialId?: string;
};

interface MediaPostCreatorProps {
  onComplete?: () => void;
  onSuccess?: (result: MediaCreatorResult) => void;
  hideTitle?: boolean;
  showSocialLinks?: boolean;
}

export default function MediaPostCreator({ 
  onComplete, 
  onSuccess, 
  hideTitle = false,
  showSocialLinks = false
}: MediaPostCreatorProps) {
  const theme = useTheme();
  const [selectedType, setSelectedType] = useState<MediaType | 'social'>('video');
  const [title, setTitle] = useState('');
  const [socialUrl, setSocialUrl] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const cameraStore = useCameraStore();

  const mediaTypes: { label: string; value: MediaType | 'social'; icon: any }[] = [
    { label: 'Video', value: 'video', icon: 'videocam' },
    { label: 'Audio', value: 'audio', icon: 'mic' },
    { label: 'Image', value: 'image', icon: 'image' },
    { label: 'PDF', value: 'pdf', icon: 'document-text' },
  ];

  if (showSocialLinks) {
    mediaTypes.unshift({ label: 'Social Link', value: 'social', icon: 'link' });
  }

  const handleAction = async () => {
    if (selectedType === 'social') {
      const parsed = parseSocialVideo(socialUrl);
      if (!parsed) {
        Alert.alert('Invalid Link', 'Please enter a valid YouTube, Facebook, Instagram, or TikTok URL');
        return;
      }
      setIsSaving(true);
      try {
        await saveSocialToFirebase(socialUrl, parsed.type, title);
        if (onSuccess) {
          onSuccess({
            type: parsed.type,
            url: socialUrl,
            title: title,
            socialType: parsed.type,
            socialId: parsed.id
          });
        }
        if (onComplete) onComplete();
      } catch (err) {
        Alert.alert('Error', 'Failed to save social link');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    const uri = await pickMedia(selectedType as MediaType);
    if (uri) {
      if (onComplete) onComplete();
      await uploadMedia(uri);
    }
  };

  const uploadMedia = async (uri: string) => {
    try {
      await processCapturedMedia(
        uri,
        selectedType as MediaType,
        (progress) => {},
        (url) => {
          if (onSuccess) {
            onSuccess({
              type: selectedType,
              url: url,
              title: title,
              fileName: uri.split('/').pop()
            });
          }
        },
        (error) => {
          Alert.alert('Upload Failed', error);
        }
      );
    } catch (err) {
      console.error(err);
    }
  };

  const startTimer = () => {
    setRecordingDuration(0);
    timerRef.current = setInterval(() => {
      setRecordingDuration((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startAudioRecord = async () => {
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (permission.status !== 'granted') return;

      await AudioModule.setAudioModeAsync({ 
        allowsRecording: true, 
        playsInSilentMode: true,
        interruptionMode: 'doNotMix',
      });

      await recorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
      await recorder.record();
      
      setIsRecording(true);
      startTimer();
    } catch (err: any) {
      console.error('Failed to start recording', err);
    }
  };

  const stopAudioRecord = async () => {
    try {
      setIsRecording(false);
      stopTimer();
      await recorder.stop();
      const uri = recorder.uri;
      if (uri) {
        if (onComplete) onComplete();
        await uploadMedia(uri);
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {!hideTitle && (
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>TITLE (OPTIONAL)</Text>
          <TextInput 
            style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Name your media..."
            placeholderTextColor={theme.textSecondary}
          />
        </View>
      )}

      <View style={styles.typeSelector}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {mediaTypes.map((type) => (
            <TouchableOpacity
              key={type.value}
              onPress={() => setSelectedType(type.value)}
              style={[
                styles.typeItem,
                selectedType === type.value && { backgroundColor: theme.primary, borderColor: theme.primary },
                { borderColor: theme.border }
              ]}
            >
              <Ionicons 
                name={type.icon} 
                size={18} 
                color={selectedType === type.value ? '#FFF' : theme.textSecondary} 
              />
              <Text style={[
                styles.typeLabel, 
                { color: selectedType === type.value ? '#FFF' : theme.textSecondary }
              ]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {selectedType === 'social' ? (
        <View style={styles.socialContainer}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>SOCIAL MEDIA LINK</Text>
            <View style={styles.inputWrapper}>
              <TextInput 
                style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, paddingRight: 40 }]}
                value={socialUrl}
                onChangeText={setSocialUrl}
                placeholder="Paste YouTube, Instagram, Facebook or TikTok link..."
                placeholderTextColor={theme.textSecondary}
              />
              {socialUrl.trim().length > 0 && (
                <View style={styles.validationIcon}>
                  {parseSocialVideo(socialUrl) ? (
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  ) : (
                    <Ionicons name="close-circle" size={20} color="#EF4444" />
                  )}
                </View>
              )}
            </View>
          </View>

          {parseSocialVideo(socialUrl) && (
            <View style={[styles.previewContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
              {parseSocialVideo(socialUrl)?.thumbnailUrl ? (
                <Image 
                  source={{ uri: parseSocialVideo(socialUrl)?.thumbnailUrl }} 
                  style={styles.previewImage} 
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.previewPlaceholder}>
                  <Ionicons name="logo-social" size={32} color={theme.primary} />
                  <Text style={[styles.previewText, { color: theme.textSecondary }]}>
                    {getSocialTypeLabel(parseSocialVideo(socialUrl)!.type)} Link Detected
                  </Text>
                </View>
              )}
            </View>
          )}
          <TouchableOpacity 
            style={[styles.submitBtn, { backgroundColor: theme.primary }, (!socialUrl.trim() || !parseSocialVideo(socialUrl) || isSaving) && { opacity: 0.5 }]}
            onPress={handleAction}
            disabled={!socialUrl.trim() || !parseSocialVideo(socialUrl) || isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitBtnText}>Add Social Video</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actionRow}>
          {(selectedType === 'audio' || selectedType === 'video' || selectedType === 'image') && (
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: isRecording ? theme.danger : theme.primarySoft }]}
              onPress={() => {
                if (selectedType === 'audio') {
                  isRecording ? stopAudioRecord() : startAudioRecord();
                } else if (selectedType === 'video') {
                  if (onComplete) onComplete();
                  cameraStore.openCamera('video');
                } else if (selectedType === 'image') {
                  if (onComplete) onComplete();
                  cameraStore.openCamera('image');
                }
              }}
            >
              <Ionicons 
                name={isRecording ? "stop-circle" : (selectedType === 'audio' ? "mic" : (selectedType === 'video' ? "videocam" : "camera"))} 
                size={24} 
                color={isRecording ? "#FFF" : theme.primary} 
              />
              <Text style={[styles.actionText, { color: isRecording ? "#FFF" : theme.primary }]}>
                {isRecording ? `Stop (${formatTime(recordingDuration)})` : (selectedType === 'audio' ? 'Record' : (selectedType === 'video' ? 'Capture' : 'Photo'))}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.primarySoft }]}
            onPress={handleAction}
          >
            <Ionicons name="cloud-upload" size={24} color={theme.primary} />
            <Text style={[styles.actionText, { color: theme.primary }]}>
              Upload {selectedType === 'pdf' ? 'File' : ''}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  inputGroup: {
    marginBottom: 16,
    gap: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: '600',
  },
  typeSelector: {
    marginBottom: 16,
  },
  typeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    marginRight: 8,
  },
  typeLabel: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 6,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '800',
  },
  socialContainer: {
    gap: 12,
  },
  submitBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  validationIcon: {
    position: 'absolute',
    right: 12,
  },
  previewContainer: {
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  previewText: {
    fontSize: 12,
    fontWeight: '600',
  }
});
