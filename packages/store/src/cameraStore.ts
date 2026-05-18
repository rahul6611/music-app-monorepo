import { create } from 'zustand';

interface CameraState {
  isActive: boolean;
  isMinimized: boolean;
  isRecording: boolean;
  mode: 'video' | 'image';
  capturedUri: string | null;
  openCamera: (mode: 'video' | 'image') => void;
  closeCamera: () => void;
  setMinimized: (minimized: boolean) => void;
  setRecording: (recording: boolean) => void;
  setCapturedUri: (uri: string | null) => void;
}

export const useCameraStore = create<CameraState>((set) => ({
  isActive: false,
  isMinimized: false,
  isRecording: false,
  mode: 'video',
  capturedUri: null,
  openCamera: (mode) => set({ isActive: true, mode, isMinimized: false }),
  closeCamera: () => set({ isActive: false, isRecording: false, isMinimized: false }),
  setMinimized: (isMinimized) => set({ isMinimized }),
  setRecording: (isRecording) => set({ isRecording }),
  setCapturedUri: (capturedUri) => set({ capturedUri }),
}));
