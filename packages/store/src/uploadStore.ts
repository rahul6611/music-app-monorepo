import { create } from 'zustand';

export interface UploadState {
  id: string;
  name: string;
  progress: number;
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';
  error?: string;
  chunkInfo?: string;
}

interface UploadStore {
  uploads: Record<string, UploadState>;
  addUpload: (upload: UploadState) => void;
  updateUpload: (id: string, updates: Partial<UploadState>) => void;
  removeUpload: (id: string) => void;
  clearCompleted: () => void;
}

export const useUploadStore = create<UploadStore>((set) => ({
  uploads: {},
  addUpload: (upload) => set((state) => ({
    uploads: { ...state.uploads, [upload.id]: upload }
  })),
  updateUpload: (id, updates) => set((state) => ({
    uploads: {
      ...state.uploads,
      [id]: state.uploads[id] ? { ...state.uploads[id], ...updates } : undefined as any
    }
  })),
  removeUpload: (id) => set((state) => {
    const { [id]: _, ...rest } = state.uploads;
    return { uploads: rest };
  }),
  clearCompleted: () => set((state) => {
    const remaining = Object.fromEntries(
      Object.entries(state.uploads).filter(([_, v]) => v.status !== 'completed')
    );
    return { uploads: remaining };
  }),
}));
