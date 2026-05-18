/**
 * Utility to automatically generate musical patterns from a set of swars/notes.
 */

export interface PatternRowWithSection {
  row: string[];
  section: 'arohan' | 'avarohan';
}

const arohan: { [key: number]: string } = {
  1: '.S', 2: '.r', 3: '.R', 4: '.g', 5: '.G', 6: '.M', 7: '.M\u2019',
  8: '.P', 9: '.d', 10: '.D', 11: '.n', 12: '.N', 13: 'S', 14: 'r',
  15: 'R', 16: 'g', 17: 'G', 18: 'M', 19: 'M\u2019', 20: 'P', 21: 'd',
  22: 'D', 23: 'n', 24: 'N', 25: 'S.', 26: 'r.', 27: 'R.', 28: 'g.',
  29: 'G.', 30: 'M.', 31: 'M\u2019.', 32: 'P.', 33: 'd.', 34: 'D.',
  35: 'n.', 36: 'N.', 37: 'S..'
};

const avrohan: { [key: number]: string } = {
  1: 'S..', 2: 'N.', 3: 'n.', 4: 'D.', 5: 'd.', 6: 'P.', 7: 'M\u2019.',
  8: 'M.', 9: 'G.', 10: 'g.', 11: 'R.', 12: 'r.', 13: 'S.', 14: 'N',
  15: 'n', 16: 'D', 17: 'd', 18: 'P', 19: 'M\u2019', 20: 'M', 21: 'G',
  22: 'g', 23: 'R', 24: 'r', 25: 'S', 26: '.N', 27: '.n', 28: '.D',
  29: '.d', 30: '.P', 31: '.M\u2019', 32: '.M', 33: '.G', 34: '.g',
  35: '.R', 36: '.r', 37: '.S'
};

const getNumberFromSwar = (swar: string): number => {
  let clean = swar.trim();

  for (const [key, val] of Object.entries(arohan)) {
    if (val === clean) return parseInt(key);
  }

  if (clean.endsWith("'")) {
    let alternated = clean;
    if (clean.endsWith("''")) {
      alternated = clean.slice(0, -2) + "..";
    } else {
      alternated = clean.slice(0, -1) + ".";
    }

    for (const [key, val] of Object.entries(arohan)) {
      if (val === alternated) return parseInt(key);
    }
  }
  return 0;
};

export const generateAutoPatterns = (
  swaras: string[], 
  beats: number
): PatternRowWithSection[] => {
  const clean = swaras.map(s => s.trim()).filter(s => s.length > 0);
  if (!clean.length) return [];
  const hyphenPositions = clean
    .map((s, i) => (s === '-' ? i : -1))
    .filter(i => i !== -1);
  const swarsOnly = clean.filter(s => s !== '-');

  const inputNumbers = swarsOnly.map(getNumberFromSwar).filter(n => n > 0);
  if (!inputNumbers.length) return [];

  const minNote = Math.min(...inputNumbers);
  const maxNote = Math.max(...inputNumbers);
  const isFullOctave = (maxNote - minNote) >= 7;

  const baseNote = inputNumbers[0];
  const offsets = inputNumbers.map(n => n - baseNote);
  
  const MAP_LIMIT = 37;

  const arohanRows: PatternRowWithSection[] = [];
  const avarohanRows: PatternRowWithSection[] = [];

  const buildRow = (numbers: number[], map: any) => {
    const swars = numbers.map(n => map[n] || String(n));
    const row: string[] = [];
    let swarIndex = 0;
    for (let i = 0; i < clean.length; i++) {
      if (hyphenPositions.includes(i)) {
        row.push('-');
      } else {
        row.push(swars[swarIndex++] || '');
      }
    }

    return row;
  };
  const tonics = [1, 13, 25, 37];
  const lastNoteInput = inputNumbers[inputNumbers.length - 1];
  const baseTonic = [...tonics].reverse().find(t => t <= lastNoteInput) || tonics[0];
  const targetTonic = baseTonic + 12;

  // For Arohan
  let start = baseNote; 
  while (start <= MAP_LIMIT) {
    const fullSequence = offsets.map(o => start + o);
    const lastNote = fullSequence[fullSequence.length - 1];

    if (fullSequence.some(n => n < 1 || n > MAP_LIMIT)) break;

    for (let i = 0; i < fullSequence.length; i += beats) {
      const chunk = fullSequence.slice(i, i + beats);
      arohanRows.push({
        row: buildRow(chunk, arohan),
        section: 'arohan'
      });
    }

    if (isFullOctave) break;
    if (lastNote >= targetTonic) break;
    start++;
  }

  // For Avrohan 
  start = baseNote;
  while (start <= MAP_LIMIT) {
    const fullSequence = offsets.map(o => start + o);
    const lastNote = fullSequence[fullSequence.length - 1];

    if (fullSequence.some(n => n < 1 || n > MAP_LIMIT)) break;

    for (let i = 0; i < fullSequence.length; i += beats) {
      const chunk = fullSequence.slice(i, i + beats);
      avarohanRows.push({
        row: buildRow(chunk, avrohan),
        section: 'avarohan'
      });
    }

    if (isFullOctave) break;
    if (lastNote >= targetTonic) break;
    start++;
  }

  return [...arohanRows, ...avarohanRows];
};
