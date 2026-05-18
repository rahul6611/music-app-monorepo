import { db, auth } from './firebaseConfig';
import { useUploadStore } from '@music-app/store';
import { 
  collection, addDoc, serverTimestamp, deleteDoc, doc, query, orderBy, 
  getDocs, limit, startAfter, QueryDocumentSnapshot, DocumentData,
  updateDoc, arrayUnion, arrayRemove, increment, onSnapshot, where, getDoc, collectionGroup
} from 'firebase/firestore';
import * as FileSystem from 'expo-file-system/legacy';
import { AudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
const PENDING_UPLOAD_KEY = "pendingUpload";

export type MediaType = 'video' | 'audio' | 'image' | 'pdf' | 'youtube' | 'facebook' | 'instagram' | 'tiktok';

export interface UploadProgress {
  id: string;
  name: string;
  progress: number;
  status: 'uploading' | 'completed' | 'failed' | 'recovering' | 'processing';
  chunkInfo?: string;
  error?: string;
}

export interface VideoChapter {
  id: string;
  title: string;
  timestamp: number;
}

export interface MediaMetadata {
  id: string;
  uri: string;
  fileName: string;
  mediaType: MediaType;
  timestamp: number;
  fileSize?: number;
  chapters?: VideoChapter[];
}

export interface FeedResponse {
  items: any[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
}

// ============= Reliability / Recovery Functions =============

export const savePendingUpload = async (metadata: MediaMetadata): Promise<void> => {
  try {
    await AsyncStorage.setItem(PENDING_UPLOAD_KEY, JSON.stringify(metadata));
    console.log(`💾 Saved pending upload to AsyncStorage: ${metadata.fileName}`);
  } catch (error) {
    console.error('❌ Failed to save pending upload:', error);
  }
};

export const clearPendingUpload = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(PENDING_UPLOAD_KEY);
  } catch (error) {
    console.error('❌ Failed to clear pending upload:', error);
  }
};

export const checkPendingRecovery = async (): Promise<MediaMetadata | null> => {
  try {
    const metadataStr = await AsyncStorage.getItem(PENDING_UPLOAD_KEY);
    if (metadataStr) {
      const metadata: MediaMetadata = JSON.parse(metadataStr);
      // Check if file still exists
      const fileInfo = await FileSystem.getInfoAsync(metadata.uri);
      if (fileInfo.exists && fileInfo.size > 0) {
        console.log(`🔄 Found pending recovery: ${metadata.fileName} (${formatFileSize(fileInfo.size)})`);
        return metadata;
      } else {
        await clearPendingUpload();
      }
    }
    return null;
  } catch (error) {
    console.error('Error checking pending recovery:', error);
    return null;
  }
};

/**
 * Call this as soon as recording starts to ensure we track the file.
 */
export const registerOngoingRecording = async (uri: string, mediaType: MediaType): Promise<void> => {
  const fileName = uri.split('/').pop() || `${mediaType}_ongoing`;
  await savePendingUpload({
    id: `ongoing_${Date.now()}`,
    uri,
    fileName,
    mediaType,
    timestamp: Date.now(),
  });
};

// ============= Cloudinary Upload Functions =============

/**
 * Standard upload for smaller files (~10MB or less recommended)
 */
export const uploadToCloudinary = async (
  uri: string,
  mediaType: MediaType,
  onProgress: (percent: number) => void
): Promise<{ secure_url: string; public_id: string; type: string }> => {
  const resourceType = mediaType === 'video' || mediaType === 'audio' ? 'video' : 'image';
  const apiUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

  const formData = new FormData();
  const fileName = uri.split('/').pop() || `upload.${mediaType === 'video' ? 'mp4' : 'jpg'}`;
  
  // @ts-ignore
  formData.append('file', {
    uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
    name: fileName,
    type: getMimeTypeFromUri(uri, mediaType),
  });
  
  formData.append('upload_preset', UPLOAD_PRESET || '');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', apiUrl);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percentComplete = Math.round((e.loaded / e.total) * 100);
        onProgress(percentComplete);
      }
    });

    xhr.onload = () => {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        resolve({
          secure_url: response.secure_url,
          public_id: response.public_id,
          type: resourceType
        });
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(formData);
  });
};

/**
 * Chunked upload for large files.
 */
export const uploadToCloudinaryChunked = async (
  uri: string,
  mediaType: MediaType,
  onProgress: (percent: number) => void
): Promise<{ secure_url: string; public_id: string; type: string }> => {
  const resourceType = mediaType === 'video' || mediaType === 'audio' ? 'video' : 'image';
  const apiUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;
  const uploadId = `upload_${Date.now()}`;
  
  const fileInfo = await FileSystem.getInfoAsync(uri);
  if (!fileInfo.exists) throw new Error('File not found');
  
  const fileSize = fileInfo.size;
  const CHUNK_SIZE = 5 * 1024 * 1024; 
  
  let start = 0;
  let lastResponse: any = null;

  while (start < fileSize) {
    const end = Math.min(start + CHUNK_SIZE, fileSize);
    const length = end - start;
    
    const chunkBase64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      position: start,
      length: length,
    });

    const formData = new FormData();
    formData.append('file', `data:${getMimeTypeFromUri(uri, mediaType)};base64,${chunkBase64}`);
    formData.append('upload_preset', UPLOAD_PRESET || '');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'X-Unique-Upload-Id': uploadId,
        'Content-Range': `bytes ${start}-${end - 1}/${fileSize}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Chunked upload failed at ${start} bytes: ${errorText}`);
    }

    lastResponse = await response.json();
    start = end;
    
    const progress = Math.round((start / fileSize) * 100);
    onProgress(progress);
  }

  return {
    secure_url: lastResponse.secure_url,
    public_id: lastResponse.public_id,
    type: resourceType
  };
};

// ============= Firebase Functions =============

export const saveToFirebase = async (
  cloudinaryResponse: { secure_url: string; public_id: string },
  fileName: string,
  fileSize: number,
  type: string,
  chapters: VideoChapter[] = []
): Promise<string> => {
  try {
    const docData = {
      url: cloudinaryResponse.secure_url,
      type: type,
      fileName: fileName,
      fileSize: fileSize,
      cloudinaryPublicId: cloudinaryResponse.public_id,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser?.uid || 'anonymous',
      likes: [],
      likesCount: 0,
      commentsCount: 0,
      chapters: chapters
    };

    const docRef = await addDoc(collection(db, "media"), docData);
    console.log('✅ Firebase save successful, doc ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Failed to save to Firebase:', error);
    throw error;
  }
};

export const saveSocialToFirebase = async (
  url: string,
  type: string,
  title?: string,
): Promise<string> => {
  try {
    const docData = {
      url: url,
      type: type,
      title: title || 'Social Video',
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser?.uid || 'anonymous',
      likes: [],
      likesCount: 0,
      commentsCount: 0,
      chapters: []
    };

    const docRef = await addDoc(collection(db, "media"), docData);
    console.log('✅ Social link save successful, doc ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Failed to save social link to Firebase:', error);
    throw error;
  }
};

export const updateChapters = async (
  postId: string, 
  chapters: VideoChapter[], 
  options?: { collectionName?: string; parentId?: string }
): Promise<void> => {
  try {
    let postRef;
    if (options?.collectionName && options?.parentId) {
      postRef = doc(db, options.collectionName, options.parentId, 'uploads', postId);
    } else {
      postRef = doc(db, "media", postId);
    }
    await updateDoc(postRef, { chapters });
    console.log('✅ Chapters updated successfully for:', postRef.path);
  } catch (error) {
    console.error('❌ Failed to update chapters:', error);
    throw error;
  }
};

export const getMediaFeed = async (lastDoc: any = null, pageSize: number = 5): Promise<FeedResponse> => {
  try {
    let q;
    if (lastDoc) {
      q = query(
        collection(db, "media"), 
        orderBy("createdAt", "desc"), 
        startAfter(lastDoc), 
        limit(pageSize)
      );
    } else {
      q = query(
        collection(db, "media"), 
        orderBy("createdAt", "desc"), 
        limit(pageSize)
      );
    }
    
    const querySnapshot = await getDocs(q);
    const items = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    const newLastDoc = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null;
    
    return { items, lastDoc: newLastDoc };
  } catch (error) {
    console.error('❌ Failed to fetch media feed:', error);
    return { items: [], lastDoc: null };
  }
};

export const toggleLike = async (postId: string, userId: string, isLiked: boolean): Promise<void> => {
  try {
    const postRef = doc(db, "media", postId);
    await updateDoc(postRef, {
      likes: isLiked ? arrayRemove(userId) : arrayUnion(userId),
      likesCount: increment(isLiked ? -1 : 1)
    });
  } catch (error) {
    console.error('❌ Failed to toggle like:', error);
    throw error;
  }
};

export const addComment = async (postId: string, userId: string, userName: string, text: string): Promise<any> => {
  try {
    const commentData = {
      userId,
      userName,
      text,
      createdAt: serverTimestamp(),
    };
    
    const commentRef = await addDoc(collection(db, "media", postId, "comments"), commentData);
    
    const postRef = doc(db, "media", postId);
    await updateDoc(postRef, {
      commentsCount: increment(1)
    });
    
    return { id: commentRef.id, ...commentData };
  } catch (error) {
    console.error('❌ Failed to add comment:', error);
    throw error;
  }
};

export const subscribeToComments = (postId: string, callback: (comments: any[]) => void) => {
  const q = query(
    collection(db, "media", postId, "comments"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snapshot) => {
    const comments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(comments);
  });
};

// ============= Recording & Processing =============

export const processCapturedMedia = async (
  uri: string,
  mediaType: MediaType,
  onProgress: (progress: UploadProgress) => void,
  onComplete: (url: string) => void,
  onError: (error: string) => void
): Promise<void> => {
  const { addUpload, updateUpload } = useUploadStore.getState();
  const fileName = uri.split('/').pop() || `${mediaType}_${Date.now()}`;
  const uploadId = `upload_${Date.now()}`;

  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    const fileSize = fileInfo.exists ? fileInfo.size : 0;
    
    addUpload({
      id: uploadId,
      name: fileName,
      progress: 0,
      status: 'uploading',
      chunkInfo: '☁️ Starting upload...',
    });

    onProgress({
      id: uploadId,
      name: fileName,
      progress: 0,
      status: 'uploading',
      chunkInfo: '☁️ Starting upload...',
    });

    await savePendingUpload({
      id: uploadId,
      uri,
      fileName,
      mediaType,
      timestamp: Date.now(),
      fileSize,
    });

    const isLargeFile = fileSize > 10 * 1024 * 1024; // > 10MB
    const uploadFn = isLargeFile ? uploadToCloudinaryChunked : uploadToCloudinary;

    const cloudinaryResponse = await uploadFn(uri, mediaType, (percent) => {
      updateUpload(uploadId, { progress: percent, chunkInfo: `☁️ Uploading: ${percent}%` });
      onProgress({
        id: uploadId,
        name: fileName,
        progress: percent,
        status: 'uploading',
        chunkInfo: `☁️ Uploading: ${percent}%`,
      });
    });

    updateUpload(uploadId, { status: 'processing', chunkInfo: '💾 Saving to database...', progress: 99 });
    
    // Save to global media feed
    await saveToFirebase(cloudinaryResponse, fileName, fileSize, mediaType);
    
    await clearPendingUpload();

    updateUpload(uploadId, { status: 'completed', progress: 100, chunkInfo: '✅ Completed!' });
    
    onProgress({
      id: uploadId,
      name: fileName,
      progress: 100,
      status: 'completed',
      chunkInfo: '✅ Completed!',
    });

    onComplete(cloudinaryResponse.secure_url);
  } catch (error: any) {
    console.error('❌ Upload failed:', error);
    updateUpload(uploadId, { status: 'failed', error: error.message || 'Upload failed' });
    onError(error.message || 'Upload failed');
  }
};

// ============= Helpers =============

export const pickMedia = async (mediaType: MediaType): Promise<string | null> => {
  try {
    let result;
    const options: ImagePicker.ImagePickerOptions = {
      allowsEditing: true,
      quality: 1,
    };

    if (mediaType === 'image') {
      result = await ImagePicker.launchImageLibraryAsync({ ...options, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    } else if (mediaType === 'video') {
      result = await ImagePicker.launchImageLibraryAsync({ ...options, mediaTypes: ImagePicker.MediaTypeOptions.Videos });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({ ...options, mediaTypes: ImagePicker.MediaTypeOptions.All });
    }

    if (!result.canceled && result.assets && result.assets.length > 0) {
      return result.assets[0].uri;
    }
    return null;
  } catch (error) {
    console.error('Error picking media:', error);
    return null;
  }
};

const getMimeTypeFromUri = (uri: string, mediaType: MediaType): string => {
  const extension = uri.split('.').pop()?.toLowerCase();
  if (mediaType === 'image') return `image/${extension === 'png' ? 'png' : 'jpeg'}`;
  if (mediaType === 'audio') return `audio/${extension || 'm4a'}`;
  if (mediaType === 'video') return `video/${extension || 'mp4'}`;
  if (mediaType === 'pdf') return 'application/pdf';
  return 'application/octet-stream';
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

export const getMediaTypeFromUri = (uri: string): MediaType => {
  const ext = uri.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'heic'].includes(ext!)) return 'image';
  if (['mp4', 'mov', 'm4v', 'webm'].includes(ext!)) return 'video';
  if (['mp3', 'wav', 'm4a', 'aac', 'caf'].includes(ext!)) return 'audio';
  if (['pdf'].includes(ext!)) return 'pdf';
  return 'image';
};
