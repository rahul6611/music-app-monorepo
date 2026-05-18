import { create } from 'zustand';

export type NotationTab = 'swar' | 'stroke' | 'lyrics' | 'bol' | 'pakhawajBol' | 'mridangamBol' | 'finger' | 'layakari';
export type SwarOctaveMode = 'normal' | 'lower' | 'higher' | 'doubleLower';

interface NotationInputState {
  // Active tab
  activeTab: NotationTab;
  setActiveTab: (tab: NotationTab) => void;
  
  // Menu vs Tab view
  isMenuView: boolean;
  setIsMenuView: (v: boolean) => void;

  // Beat/Cycle config
  beatsPerCycle: number;
  setBeatsPerCycle: (n: number) => void;
  startBeat: number;
  setStartBeat: (n: number) => void;
  selectedLineType: string;
  setSelectedLineType: (s: string) => void;

  // Swar octave
  swarOctaveMode: SwarOctaveMode;
  setSwarOctaveMode: (mode: SwarOctaveMode) => void;
  showSwarEffects: boolean;
  setShowSwarEffects: (v: boolean) => void;

  // Text inputs for each tab
  swarText: string;
  setSwarText: (s: string) => void;
  strokeText: string;
  setStrokeText: (s: string) => void;
  lyricsText: string;
  setLyricsText: (s: string) => void;
  bolText: string;
  setBolText: (s: string) => void;
  pakhawajBolText: string;
  setPakhawajBolText: (s: string) => void;
  mridangamBolText: string;
  setMridangamBolText: (s: string) => void;
  fingerText: string;
  setFingerText: (s: string) => void;
  layakariText: string;
  setLayakariText: (s: string) => void;

  // Bol language toggle
  bolLanguage: 'en' | 'hi';
  setBolLanguage: (lang: 'en' | 'hi') => void;

  // Cursor positions for each tab
  cursorPositions: Record<NotationTab, number>;
  setCursorPosition: (tab: NotationTab, pos: number) => void;

  // Saving state
  saving: boolean;
  setSaving: (v: boolean) => void;
  showSavedMessage: boolean;
  setShowSavedMessage: (v: boolean) => void;

  // Clear all inputs
  clearAll: () => void;
  
  // Get text for active tab
  getActiveText: () => string;
  // Set text for active tab
  setActiveText: (text: string) => void;
}

export const useNotationStore = create<NotationInputState>()((set, get) => ({
  activeTab: 'swar',
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  isMenuView: true,
  setIsMenuView: (v) => set({ isMenuView: v }),

  beatsPerCycle: 16,
  setBeatsPerCycle: (n) => set({ beatsPerCycle: n }),
  startBeat: 1,
  setStartBeat: (n) => set({ startBeat: n }),
  selectedLineType: 'Sthayi',
  setSelectedLineType: (s) => set({ selectedLineType: s }),

  swarOctaveMode: 'normal',
  setSwarOctaveMode: (mode) => set({ swarOctaveMode: mode }),
  showSwarEffects: false,
  setShowSwarEffects: (v) => set({ showSwarEffects: v }),

  swarText: '',
  setSwarText: (s) => set({ swarText: s }),
  strokeText: '',
  setStrokeText: (s) => set({ strokeText: s }),
  lyricsText: '',
  setLyricsText: (s) => set({ lyricsText: s }),
  bolText: '',
  setBolText: (s) => set({ bolText: s }),
  pakhawajBolText: '',
  setPakhawajBolText: (s) => set({ pakhawajBolText: s }),
  mridangamBolText: '',
  setMridangamBolText: (s) => set({ mridangamBolText: s }),
  fingerText: '',
  setFingerText: (s) => set({ fingerText: s }),
  layakariText: '',
  setLayakariText: (s) => set({ layakariText: s }),

  bolLanguage: 'en',
  setBolLanguage: (lang) => set({ bolLanguage: lang }),

  cursorPositions: {
    swar: 0, stroke: 0, lyrics: 0, bol: 0,
    pakhawajBol: 0, mridangamBol: 0,
    finger: 0, layakari: 0,
  },
  setCursorPosition: (tab, pos) => set((state) => ({
    cursorPositions: { ...state.cursorPositions, [tab]: pos }
  })),

  saving: false,
  setSaving: (v) => set({ saving: v }),
  showSavedMessage: false,
  setShowSavedMessage: (v) => set({ showSavedMessage: v }),

  clearAll: () => set({
    swarText: '', strokeText: '', lyricsText: '', bolText: '',
    pakhawajBolText: '', mridangamBolText: '', fingerText: '', layakariText: '',
    cursorPositions: {
      swar: 0, stroke: 0, lyrics: 0, bol: 0,
      pakhawajBol: 0, mridangamBol: 0, finger: 0, layakari: 0,
    },
  }),

  getActiveText: () => {
    const state = get();
    const map: Record<NotationTab, string> = {
      swar: state.swarText, stroke: state.strokeText, lyrics: state.lyricsText,
      bol: state.bolText, pakhawajBol: state.pakhawajBolText,
      mridangamBol: state.mridangamBolText, finger: state.fingerText,
      layakari: state.layakariText,
    };
    return map[state.activeTab];
  },

  setActiveText: (text) => {
    const state = get();
    const setters: Record<NotationTab, (s: string) => void> = {
      swar: (s) => set({ swarText: s }),
      stroke: (s) => set({ strokeText: s }),
      lyrics: (s) => set({ lyricsText: s }),
      bol: (s) => set({ bolText: s }),
      pakhawajBol: (s) => set({ pakhawajBolText: s }),
      mridangamBol: (s) => set({ mridangamBolText: s }),
      finger: (s) => set({ fingerText: s }),
      layakari: (s) => set({ layakariText: s }),
    };
    setters[state.activeTab](text);
  },
}));
