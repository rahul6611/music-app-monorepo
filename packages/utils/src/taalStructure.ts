/** Taal markers from Web Beta src/utils/taalStructure.ts. */
export type TaalMarker = 'X' | 'O' | string;
export interface TaalStructure { taali: number[]; khaali: number[] }

const STRUCTURES: Record<string, TaalStructure> = {
  ektaal: { taali: [1, 5, 9, 11], khaali: [3, 7] },
  chautaal: { taali: [1, 5, 9, 11], khaali: [3, 7] },
  teentaal: { taali: [1, 5, 13], khaali: [9] },
  rupak: { taali: [4, 6], khaali: [1] },
  jhaptal: { taali: [1, 3, 8], khaali: [6] },
  dhamar: { taali: [1, 6, 11], khaali: [8] },
  deepchandi: { taali: [1, 4, 11], khaali: [8] },
  tilwada: { taali: [1, 5, 13], khaali: [9] },
  kaharwa: { taali: [1], khaali: [5] },
  dadra: { taali: [1], khaali: [4] },
  mattataal: { taali: [1, 3, 7], khaali: [5] },
  sultal: { taali: [1, 5, 7], khaali: [3, 9] },
  shultal: { taali: [1, 5, 7], khaali: [3, 9] },
};
export function getTaalStructure(name: string): TaalStructure | null {
  const key = name.toLowerCase().split(/[—–\-(]/)[0].replace(/\s/g, '');
  const aliases: Record<string, string> = {
    ektal: 'ektaal', chautal: 'chautaal', teental: 'teentaal', jhaptaal: 'jhaptal',
    keherwa: 'kaharwa', kaherwa: 'kaharwa', keherva: 'kaharwa',
  };
  return STRUCTURES[aliases[key] || key] || null;
}
export function getBeatMarker(beat: number, taalName = 'Teental'): TaalMarker | null {
  if (beat <= 0) return null;
  if (beat === 1) return 'X';
  const structure = getTaalStructure(taalName);
  if (structure?.taali.includes(beat)) return 'X';
  if (structure?.khaali.includes(beat)) return 'O';
  return null;
}

/** Explicit composition divisions override named defaults, e.g. (2+2+3). */
export function getBeatGroupStarts(taalName: string, beatsPerCycle: number): number[] {
  const grouping = taalName.match(/\d+\s*(?:\+\s*\d+)+/)?.[0];
  if (grouping) {
    const groups = grouping.split('+').map(Number);
    if (groups.every(n => n > 0) && groups.reduce((sum, n) => sum + n, 0) === beatsPerCycle) {
      let beat = 1;
      return groups.map(size => { const start = beat; beat += size; return start; });
    }
  }
  const structure = getTaalStructure(taalName);
  return Array.from(new Set([1, ...(structure?.taali || []), ...(structure?.khaali || [])]))
    .filter(beat => beat <= beatsPerCycle).sort((a, b) => a - b);
}
export function getBeatColor(beat: number, taalName = 'Teental', beatsPerCycle = 16): string {
  const cycleBeat = ((beat - 1) % beatsPerCycle) + 1;
  const group = getBeatGroupStarts(taalName, beatsPerCycle).filter(start => start <= cycleBeat).length - 1;
  return ['#9FA8DA', '#80CBC4'][Math.max(0, group) % 2];
}
