// ─── Swar Note Tokens ───
export const getSwarTokenListForMode = (mode: 'normal' | 'lower' | 'higher' | 'doubleLower'): string[] => {
  if (mode === 'doubleLower') {
    return ['..S', '..r', '..R', '..g', '..G', '..M', '..M\u2019', '..P', '..d', '..D', '..n', '..N', '.S'];
  }
  if (mode === 'lower') {
    return ['..S', '.r', '.R', '.g', '.G', '.M', '.M\u2019', '.P', '.d', '.D', '.n', '.N', 'S'];
  }
  if (mode === 'higher') {
    return ['S.', 'r.', 'R.', 'g.', 'G.', 'M.', 'M\u2019.', 'P.', 'd.', 'D.', 'n.', 'N.', 'S..'];
  }
  // normal
  return ['S', 'r', 'R', 'g', 'G', 'M', 'M\u2019', 'P', 'd', 'D', 'n', 'N', 'S.'];
};

export const getSwarTokensForLayout = (mode: 'normal' | 'lower' | 'higher' | 'doubleLower') => {
  const t = getSwarTokenListForMode(mode);
  return {
    firstS: t[0], r: t[1], R: t[2], g: t[3], G: t[4],
    M: t[5], Mp: t[6], P: t[7], d: t[8], D: t[9],
    n: t[10], N: t[11], lastS: t[12],
  };
};

export const parseSwarToken = (token: string): { 
  baseNote: string; 
  octaveType: 'lower' | 'higher' | 'double-lower' | 'double-higher' | 'normal' 
} => {
  if (token.startsWith('..')) return { baseNote: token.substring(2), octaveType: 'double-lower' };
  if (token.startsWith('.')) return { baseNote: token.substring(1), octaveType: 'lower' };
  if (token.endsWith('..')) return { baseNote: token.slice(0, -2), octaveType: 'double-higher' };
  if (token.endsWith('.')) return { baseNote: token.replace(/\.+$/, ''), octaveType: 'higher' };
  return { baseNote: token, octaveType: 'normal' };
};

// ─── Tabla Bol Groups ───
export interface BolGroup {
  id: string;
  section: 'left' | 'right' | 'both' | 'phrases';
  mainBol: { en: string; hi: string };
  additionalBols?: { en: string; hi: string }[];
  isDivider?: boolean;
  isDefaultHidden?: boolean;
}

export const TABLA_BOL_GROUPS: BolGroup[] = [
  // Left hand
  { id: 'ghe', section: 'left', mainBol: { en: 'Ghe', hi: 'घे' } },
  { id: 'ke', section: 'left', mainBol: { en: 'Ke', hi: 'के' } },
  { id: 'kat', section: 'left', mainBol: { en: 'Kat', hi: 'कट' } },
  { id: 'ga', section: 'left', mainBol: { en: 'Ga', hi: 'ग' } },
  // Right hand
  { id: 'na', section: 'right', mainBol: { en: 'Na', hi: 'ना' } },
  { id: 'ta', section: 'right', mainBol: { en: 'Ta', hi: 'ता' } },
  { id: 'tin', section: 'right', mainBol: { en: 'Tin', hi: 'तिन' } },
  { id: 'tun', section: 'right', mainBol: { en: 'Tun', hi: 'तुन' } },
  { id: 'ti', section: 'right', mainBol: { en: 'Ti', hi: 'ति' } },
  { id: 'te', section: 'right', mainBol: { en: 'Te', hi: 'ते' } },
  { id: 'tite', section: 'right', mainBol: { en: 'TiTe', hi: 'तिटे' } },
  { id: 'tire', section: 'right', mainBol: { en: 'TiRe', hi: 'तिरे' } },
  { id: 're', section: 'right', mainBol: { en: 'Re', hi: 'रे' } },
  { id: 'din', section: 'right', mainBol: { en: 'Din', hi: 'दिन' } },
  // Both hands
  { id: 'dha', section: 'both', mainBol: { en: 'Dha', hi: 'धा' } },
  { id: 'dhin', section: 'both', mainBol: { en: 'Dhin', hi: 'धिन' } },
  // Phrases
  { id: 'dha_dhin', section: 'phrases', mainBol: { en: 'Dha Dhin', hi: 'धा धिन' } },
  { id: 'ti_re_ki_ta', section: 'phrases', mainBol: { en: 'Ti Re Ki Ta', hi: 'ति रे कि ता' } },
  { id: 'dha_ti_dha', section: 'phrases', mainBol: { en: 'Dha Ti Dha', hi: 'धा ति धा' } },
];

export const PAKHAVAJ_BOL_GROUPS: BolGroup[] = [
  { id: 'taa', section: 'right', mainBol: { en: 'Taa', hi: 'ता' } },
  { id: 'naa', section: 'right', mainBol: { en: 'Naa', hi: 'ना' } },
  { id: 'ki', section: 'right', mainBol: { en: 'Ki', hi: 'कि' } },
  { id: 'ta', section: 'right', mainBol: { en: 'Ta', hi: 'ता' } },
  { id: 'kit', section: 'right', mainBol: { en: 'KiT', hi: 'किट' } },
  { id: 'ka', section: 'right', mainBol: { en: 'Ka', hi: 'क' } },
  { id: 'dha', section: 'left', mainBol: { en: 'Dha', hi: 'धा' } },
  { id: 'ga', section: 'left', mainBol: { en: 'Ga', hi: 'ग' } },
  { id: 'dhaa', section: 'both', mainBol: { en: 'Dhaa', hi: 'धा' } },
  { id: 'din', section: 'both', mainBol: { en: 'Din', hi: 'दिन' } },
];

export const MRIDANGAM_BOL_GROUPS: BolGroup[] = [
  { id: 'tha', section: 'both', mainBol: { en: 'Tha', hi: 'था' } },
  { id: 'dhi', section: 'both', mainBol: { en: 'Dhi', hi: 'धि' } },
  { id: 'thom', section: 'both', mainBol: { en: 'Thom', hi: 'थोम' } },
  { id: 'nam', section: 'both', mainBol: { en: 'Nam', hi: 'नम' } },
  { id: 'ta', section: 'both', mainBol: { en: 'Ta', hi: 'ता' } },
  { id: 'ri', section: 'both', mainBol: { en: 'Ri', hi: 'रि' } },
  { id: 'ki', section: 'both', mainBol: { en: 'Ki', hi: 'कि' } },
];

// ─── Stroke Presets ───
export const getStrokePresets = (instruments: string[]): { label: string; value: string }[] => {
  const lower = instruments.map(s => s.toLowerCase());
  
  if (lower.includes('santoor')) {
    return [
      { label: 'L', value: 'L ' },
      { label: 'R', value: 'R ' },
    ];
  }
  if (lower.some(s => ['sitar', 'sarod', 'rudra veena'].includes(s))) {
    return [
      { label: 'Da', value: 'Da ' },
      { label: 'Ra', value: 'Ra ' },
      { label: 'Diri', value: 'Diri ' },
    ];
  }
  if (lower.includes('flute')) {
    return [{ label: 'Tu', value: 'Tu ' }];
  }
  return [
    { label: 'Da', value: 'Da ' },
    { label: 'Ra', value: 'Ra ' },
    { label: 'Dir', value: 'Dir ' },
  ];
};

// ─── Line Type Options ───
export const DEFAULT_LINE_TYPES = [
  'A', 'Aala', 'Aalap', 'Antar', 'Antara', 'Abhog', 
  'Composition', 'Gat', 'Jhala', 'Jod', 'Sanchari', 'Sthayi', 'Taan', 'Toda',
];

export const SONG_LINE_TYPES = [
  'Antara', 'Bridge', 'Chorus', 'Intro', 'Outro', 'Sthayi', 'Verse',
];
