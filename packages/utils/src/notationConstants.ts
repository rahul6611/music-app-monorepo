// ─── Swar Note Tokens ───
export type SwarOctaveMode = 'normal' | 'lower' | 'higher' | 'doubleLower' | 'doubleHigher';

export const getSwarTokenListForMode = (mode: SwarOctaveMode): string[] => {
  if (mode === 'doubleLower') {
    return ['..S', '..r', '..R', '..g', '..G', '..M', '..M\u2019', '..P', '..d', '..D', '..n', '..N', '.S'];
  }
  if (mode === 'lower') {
    return ['.S', '.r', '.R', '.g', '.G', '.M', '.M\u2019', '.P', '.d', '.D', '.n', '.N', 'S'];
  }
  if (mode === 'higher') {
    return ['S.', 'r.', 'R.', 'g.', 'G.', 'M.', 'M\u2019.', 'P.', 'd.', 'D.', 'n.', 'N.', 'S..'];
  }
  if (mode === 'doubleHigher') {
    return ['S..', 'r..', 'R..', 'g..', 'G..', 'M..', 'M’..', 'P..', 'd..', 'D..', 'n..', 'N..', 'S...'];
  }
  // normal
  return ['S', 'r', 'R', 'g', 'G', 'M', 'M\u2019', 'P', 'd', 'D', 'n', 'N', 'S.'];
};

export const getSwarTokensForLayout = (mode: SwarOctaveMode) => {
  const t = getSwarTokenListForMode(mode);
  return {
    firstS: t[0], r: t[1], R: t[2], g: t[3], G: t[4],
    M: t[5], Mp: t[6], P: t[7], d: t[8], D: t[9],
    n: t[10], N: t[11], lastS: t[12],
  };
};

export const parseSwarToken = (token: string): { 
  baseNote: string; 
  octaveType: 'lower' | 'higher' | 'double-lower' | 'double-higher' | 'triple-lower' | 'triple-higher' | 'normal'
} => {
  if (token.startsWith('...')) return { baseNote: token.substring(3), octaveType: 'triple-lower' };
  if (token.startsWith('..')) return { baseNote: token.substring(2), octaveType: 'double-lower' };
  if (token.startsWith('.')) return { baseNote: token.substring(1), octaveType: 'lower' };
  if (token.endsWith('...')) return { baseNote: token.slice(0, -3), octaveType: 'triple-higher' };
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
  description?: string;
  isDivider?: boolean;
  isDefaultHidden?: boolean;
}

export const TABLA_BOL_GROUPS: BolGroup[] = [
  { id: 'ghe_group', section: 'left', mainBol: { en: 'Ghe', hi: 'घे' }, additionalBols: [{ en: 'Ghi', hi: 'घि' }, { en: 'Ga', hi: 'ग' }], description: 'Open/closed, index/middle hitting edge' },
  { id: 'ke_group', section: 'left', mainBol: { en: 'Kat', hi: 'कत्' }, additionalBols: [{ en: 'Ki', hi: 'कि' }, { en: 'Ke', hi: 'के' }, { en: 'GG', hi: 'ग्ग्' }, { en: 'Ka', hi: 'क' }, { en: 'Ta', hi: 'त' }], description: 'Closed, drop all fingers on syahi' },
  { id: 'naa_group', section: 'right', mainBol: { en: 'Naa', hi: 'ना' }, additionalBols: [{ en: 'Taa', hi: 'ता' }, { en: 'Kaa', hi: 'का' }], description: 'Closed, index finger on chaati' },
  { id: 'ti_group', section: 'right', mainBol: { en: 'Ti', hi: 'ति' }, additionalBols: [{ en: 'Tin', hi: 'तिं' }] },
  { id: 'tu_group', section: 'right', mainBol: { en: 'Tu', hi: 'तु' }, additionalBols: [{ en: 'Tun', hi: 'तुं' }] },
  { id: 'kii_group', section: 'right', mainBol: { en: 'Kii', hi: 'की' }, additionalBols: [{ en: 'Te', hi: 'ते' }], description: 'Closed, last 3 fingers' },
  { id: 'ta_group', section: 'right', mainBol: { en: 'Ṭa', hi: 'ट' }, additionalBols: [{ en: 'Ṭi', hi: 'टि' }, { en: 'Ṭe', hi: 'टे' }, { en: 'Re', hi: 'रे' }] },
  { id: 'din_group', section: 'right', mainBol: { en: 'Din', hi: 'दिन्' } },
  { id: 'dhaa_group', section: 'both', mainBol: { en: 'Dhaa', hi: 'धा' }, additionalBols: [{ en: 'Dhin', hi: 'धिं' }, { en: 'Dhir-dhir', hi: 'धिर-धिर' }], description: 'Simultaneous' },
  { id: 'kii_ti_ta_ka_phrase', section: 'phrases', mainBol: { en: 'Kii-ṭi-ta-ka', hi: 'कीटितक' }, additionalBols: [{ en: 'Kii-ṭa ta-ki ṭa ta-kaa', hi: 'कीट तकि ट तका' }] },
];

export const PAKHAVAJ_BOL_GROUPS: BolGroup[] = [
  { id: 'dha_group', section: 'left', mainBol: { en: 'Dha', hi: 'ध' }, additionalBols: [{ en: 'Ga', hi: 'ग' }, { en: 'Ge', hi: 'गे' }, { en: 'Ghe', hi: 'घे' }, { en: 'Thuu', hi: 'थू' }, { en: 'Thun', hi: 'थून' }, { en: 'Dhuu', hi: 'धू' }] },
  { id: 'ta_group', section: 'left', mainBol: { en: 'Ta', hi: 'त' }, additionalBols: [{ en: 'Kat', hi: 'कत्' }] },
  { id: 'taa_group', section: 'right', mainBol: { en: 'Taa', hi: 'ता' }, additionalBols: [{ en: 'Kaa', hi: 'का' }, { en: 'Ka', hi: 'क' }] },
  { id: 'di_group', section: 'right', mainBol: { en: 'Di', hi: 'दी' }, additionalBols: [{ en: 'Din', hi: 'दिं' }, { en: 'Ma', hi: 'म' }] },
  { id: 'na_group', section: 'right', mainBol: { en: 'Na', hi: 'न' }, additionalBols: [{ en: 'Ang', hi: 'गूँ' }] },
  { id: 'naa_group', section: 'right', mainBol: { en: 'Naa', hi: 'ना' } },
  { id: 'ki_group', section: 'right', mainBol: { en: 'Ki', hi: 'कि' }, additionalBols: [{ en: 'Ti', hi: 'ति' }, { en: 'Tit', hi: 'तित्' }] },
  { id: 'ta_sub_group', section: 'right', mainBol: { en: 'Ṭa', hi: 'ट' }, additionalBols: [{ en: 'Ṭi', hi: 'टि' }, { en: 'Ṭe', hi: 'टे' }] },
  { id: 'tun_group', section: 'right', mainBol: { en: 'Tun', hi: 'तुं' }, additionalBols: [{ en: 'Laa', hi: 'ला' }] },
  { id: 'dhaa_group', section: 'both', mainBol: { en: 'Dhaa', hi: 'धा' }, additionalBols: [{ en: 'Dhi', hi: 'धि' }] },
  { id: 'phrases_1', section: 'phrases', mainBol: { en: 'Ki-ṭa', hi: 'कि-ट' }, additionalBols: [{ en: 'Ta-ka', hi: 'त-क' }, { en: 'Dhi-ṭa', hi: 'धि-ट' }, { en: 'Dha-di-ga-na', hi: 'ध-दि-ग-न' }, { en: 'Ki-ṭi-ta-ka', hi: 'कि-टि-त-क' }] },
  { id: 'phrases_2', section: 'phrases', mainBol: { en: 'Dhit-taa', hi: 'धित्-ता' }, additionalBols: [{ en: 'Dhi-ki-ṭa', hi: 'धि-कि-ट' }, { en: 'Dhuu-ma', hi: 'धू-म' }, { en: 'Dhi-la-ang', hi: 'धि-ल-आंग' }] },
];

export const MRIDANGAM_BOL_GROUPS: BolGroup[] = [
  { id: 'left_group', section: 'left', mainBol: { en: 'Thom', hi: 'थोम' } },
  { id: 'right_group', section: 'right', mainBol: { en: 'Nam', hi: 'नम्' } },
  { id: 'both_group', section: 'both', mainBol: { en: 'Tha', hi: 'था' }, additionalBols: [{ en: 'Dhi', hi: 'धी' }] },
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
