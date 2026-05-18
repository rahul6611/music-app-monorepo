import { useState, useEffect } from 'react';
import { checkPendingRecovery, processCapturedMedia, clearPendingUpload, MediaMetadata, UploadProgress } from '@music-app/firebase';
import { Alert } from 'react-native';

export const useMediaRecovery = () => {
  const [pendingMedia, setPendingMedia] = useState<MediaMetadata | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  useEffect(() => {
    const init = async () => {
      const pending = await checkPendingRecovery();
      if (pending) {
        setPendingMedia(pending);
        Alert.alert(
          'Unfinished Upload Found',
          `We found a ${pending.mediaType} recording that wasn't uploaded. Would you like to recover it?`,
          [
            {
              text: 'Discard',
              style: 'destructive',
              onPress: async () => {
                await clearPendingUpload();
                setPendingMedia(null);
              }
            },
            {
              text: 'Recover Now',
              onPress: () => recoverMedia(pending)
            }
          ]
        );
      }
    };
    init();
  }, []);

  const recoverMedia = async (metadata: MediaMetadata) => {
    try {
      await processCapturedMedia(
        metadata.uri,
        metadata.mediaType,
        (progress) => setUploadProgress(progress),
        (url) => {
          Alert.alert('Success', 'Media recovered and uploaded successfully!');
          setPendingMedia(null);
        },
        (error) => {
          Alert.alert('Upload Failed', error);
        }
      );
    } catch (err) {
      console.error('Recovery failed:', err);
    }
  };

  return { pendingMedia, uploadProgress };
};
