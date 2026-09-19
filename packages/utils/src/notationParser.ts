import {
  extractChhandInnerContent,
  extractChhandSpanFromSegment,
  isChhandIncompleteHeader,
  isChhandToken,
  isChikariToken,
  isMurkiToken,
  normalizeChikariToken,
} from './NotationStyleParse';

export interface NotationEntry {
  beat?: number; 
  absoluteBeat?: number; 
  lyric?: string;
  swar?: string;
  tabla?: string;
  sitar_stroke?: string;
  sarod_stroke?: string;
  santoor_stroke?: string;
  stroke?: string; 
  strokes?: string[]; 
  phraseId?: string;
  octave?: 'higher' | 'lower'; 
  lowerOctaveChars?: string[];
  higherOctaveChars?: string[];
  lowerOctavePositions?: number[];
  higherOctavePositions?: number[];
  meendStyle?: boolean; 
  murkiStyle?: boolean; 
  chandoTaalStyle?: boolean; 
  underscore?: boolean; 
  underscorePositions?: number[]; 
  groupBreakPositions?: number[]; 
  colspan?: number; 
  infoIcon?: string; 
  chikari?: boolean; 
  bold?: boolean; 
  boldPositions?: number[]; 
}

export interface NotationRow {
  index: number;
  phraseId: string;
  sectionLabel: string;
  entries: NotationEntry[];
}

export interface IndianClassicalNotation {
  notationId: string;
  notation: Record<string, NotationEntry>;
  sectionLabels?: Record<string, string>;
  notationRows?: NotationRow[];
}

const normalizeApostrophes = (input: string): string =>
  input.replace(/[\u2018\u2019\u02BC\u2032]/g, "'");

const SWAR_MODIFIER = "['’\u030D\u0304\u0305]?";

/** Split kan superscript text into individual swar letters (for /kn rendering). */
export function splitKanSuperscriptLetters(superscript: string): string[] {
  return superscript.match(new RegExp(`[A-Za-z]${SWAR_MODIFIER}`, 'g')) ?? [superscript];
}

export function splitSegmentIntoNotes(segment: string): string[] {
  const trimmed = normalizeApostrophes(segment.trim())
    // Normalize teevra Ma typed as combining overline into our internal marker
    .replace(/M[\u0304\u0305\u030D]/g, "M'")
    .replace(/m[\u0304\u0305\u030D]/g, "M'");
  if (!trimmed) return ['-'];

  if (isChhandToken(trimmed)) {
    return [trimmed];
  }

  if (isMurkiToken(trimmed)) {
    return [trimmed];
  }

  if (isChikariToken(trimmed)) {
    return [normalizeChikariToken(trimmed) ?? '/ck/'];
  }

  const notes: string[] = [];
  let i = 0;

  while (i < trimmed.length) {
    if (trimmed[i] === ' ' || trimmed[i] === '\t') {
      i++;
      continue;
    }

    if (trimmed[i] === '/' && i + 1 < trimmed.length && /[A-Za-z]/.test(trimmed[i + 1])) {
      let token = '/';
      i++;
      while (i < trimmed.length && /[A-Za-z]/.test(trimmed[i])) {
        token += trimmed[i];
        i++;
      }
      notes.push(token);
      continue;
    }

    if (trimmed[i] === '(') {
      let parenContent = '(';
      let parenDepth = 1;
      i++;

      while (i < trimmed.length && parenDepth > 0) {
        if (trimmed[i] === '(') parenDepth++;
        else if (trimmed[i] === ')') parenDepth--;
        parenContent += trimmed[i];
        i++;
      }

      if (parenContent.trim()) {
        notes.push(parenContent.trim());
      }
      continue;
    }

    if (trimmed[i] === '[') {
      let bracketContent = '[';
      let bracketDepth = 1;
      i++;

      while (i < trimmed.length && bracketDepth > 0) {
        if (trimmed[i] === '[') bracketDepth++;
        else if (trimmed[i] === ']') bracketDepth--;
        bracketContent += trimmed[i];
        i++;
      }

      if (bracketContent.trim()) {
        notes.push(bracketContent.trim());
      }
      continue;
    }

    if (trimmed[i] === '.' || trimmed[i] === '_' || trimmed[i] === ':') {
      let note = trimmed[i];
      i++;

      if (note === '.' && i < trimmed.length && trimmed[i] === '_') {
        note += trimmed[i];
        i++;
      }

      if (note === '.' && i < trimmed.length && trimmed[i] === '.') {
        note += trimmed[i];
        i++;
      }

      if (note === '_' && i < trimmed.length && trimmed[i] === '.') {
        note += trimmed[i];
        i++;
      }

      if (i < trimmed.length && /[A-Za-z]/.test(trimmed[i])) {
        note += trimmed[i];
        i++;

        while (i < trimmed.length && (trimmed[i] === '.' || trimmed[i] === '_')) {
          note += trimmed[i];
          i++;
        }
      }

      while (i < trimmed.length && trimmed[i] === "'") {
        note += trimmed[i];
        i++;
      }

      notes.push(note);
      continue;
    }

    if (/[A-Za-z]/.test(trimmed[i])) {
      let note = trimmed[i];
      i++;

      while (i < trimmed.length && (trimmed[i] === '.' || trimmed[i] === '_')) {
        note += trimmed[i];
        i++;
      }

      while (i < trimmed.length && trimmed[i] === "'") {
        note += trimmed[i];
        i++;
      }

      while (i < trimmed.length && trimmed[i] === '.') {
        note += trimmed[i];
        i++;
      }

      notes.push(note);
      continue;
    }

    // Handle hyphen (treated as separate note)
    if (trimmed[i] === '-') {
      notes.push('-');
      i++;
      continue;
    }

    // Any other character - treat as separate note
    notes.push(trimmed[i]);
    i++;
  }

  return notes.length > 0 ? notes : ['-'];
}

export function parseNote(note: string): { swar: string; underscore: boolean; bold: boolean; isValid: boolean; invalidReason?: string } {
  let swar = normalizeApostrophes(note.trim())
    .replace(/M[\u0304\u0305\u030D]/g, "M'")
    .replace(/m[\u0304\u0305\u030D]/g, "M'");

  let bold = false;
  if (swar.startsWith('*')) {
    bold = true;
    swar = swar.substring(1).trim();
  }

  let underscore = false;
  let isValid = true;
  let invalidReason: string | undefined = undefined;

  // Chhand token: /cn5 ... /
  if (isChhandToken(swar)) {
    return { swar, underscore: false, bold, isValid: true };
  }

  if (isMurkiToken(swar)) {
    return { swar, underscore: false, bold, isValid: true };
  }

  if (isChikariToken(swar)) {
    return { swar: normalizeChikariToken(swar) ?? '/ck/', underscore: false, bold, isValid: true };
  }

  if (swar.startsWith('/') && /^\/[A-Za-z]+$/.test(swar)) {
    return { swar, underscore: false, bold, isValid: true };
  }

  const lowercaseSwar = swar.match(/[srgmpdn]/);
  if (lowercaseSwar || swar.includes('_')) {
    underscore = true;
  }
  swar = swar.replace(/[srgmpdn]/g, (match) => match.toUpperCase()).replace(/_/g, '');

  if (swar.startsWith(':')) {
    swar = swar.replace(/^:\s*/, ':');
  }

  return { swar, underscore, bold, isValid, invalidReason };
}

export interface ParsedNotationResult {
  entries: NotationEntry[];
  newPhraseEntries?: NotationEntry[];
  newPhraseId?: string;
  additionalPhrases?: Array<{ entries: NotationEntry[]; phraseId: string }>;
}

export function parseNotation(
  notationText: string,
  phraseId: string,
  startBeat: number = 1,
  beatsPerCycle: number = 16
): ParsedNotationResult {
  const segments = notationText.split(',');
  const entries: NotationEntry[] = [];
  const newPhraseEntries: NotationEntry[] = [];

  const NOTE_SEPARATOR = '\u0001';

  let leadingEmptyCount = 0;
  for (let i = 0; i < segments.length; i++) {
    const trimmed = segments[i].trim();
    if (trimmed === '') {
      leadingEmptyCount++;
    } else {
      break;
    }
  }

  const maxEmptyBeforeStart = Math.max(0, startBeat - 1);
  const emptyBeatsToCreate = Math.min(leadingEmptyCount, maxEmptyBeforeStart);

  for (let i = 0; i < emptyBeatsToCreate; i++) {
    const beatNumber = i + 1;
    const beat = ((beatNumber - 1) % beatsPerCycle) + 1;

    entries.push({
      beat,
      absoluteBeat: beatNumber,
      swar: '',
      phraseId
    });
  }

  const remainingCommas = leadingEmptyCount - emptyBeatsToCreate;
  if (remainingCommas > 0) {
    for (let i = 0; i < remainingCommas; i++) {
      const beatNumber = startBeat + i;
      const beat = ((beatNumber - 1) % beatsPerCycle) + 1;

      entries.push({
        beat,
        absoluteBeat: beatNumber,
        swar: '',
        phraseId
      });
    }
  }

  let currentBeat = startBeat + remainingCommas;
  let shouldStartNewPhrase = false;
  let newPhraseId: string | undefined = undefined;
  let segmentIndexForNewPhrase = -1;

  interface PhraseGroup {
    entries: NotationEntry[];
    phraseId: string;
    startSegmentIndex: number;
    currentBeatInPhrase: number;
  }

  const phraseGroups: PhraseGroup[] = [];
  let currentPhraseGroup: PhraseGroup | null = null;

  const getNextPhraseId = (currentPhraseId: string): string => {
    const match = currentPhraseId.match(/^(.+?)(\d+)$/);
    if (match) {
      const baseName = match[1];
      const currentNum = parseInt(match[2], 10);
      const nextNum = currentNum >= 3 ? 1 : currentNum + 1;
      return `${baseName}${nextNum}`;
    }
    if (currentPhraseId === 'sthayi1') return 'sthayi2';
    if (currentPhraseId === 'sthayi2') return 'sthayi3';
    if (currentPhraseId === 'sthayi3') return 'sthayi1';
    if (currentPhraseId.startsWith('jhala')) {
      if (currentPhraseId === 'jhala1') return 'jhala2';
      if (currentPhraseId === 'jhala2') return 'jhala3';
      if (currentPhraseId === 'jhala3') return 'jhala1';
    }
    if (currentPhraseId.startsWith('ltaan')) {
      if (currentPhraseId === 'ltaan1') return 'ltaan2';
      if (currentPhraseId === 'ltaan2') return 'ltaan3';
      if (currentPhraseId === 'ltaan3') return 'ltaan1';
    }
    return 'sthayi1';
  };

  segments.forEach((segment, index) => {
    let trimmed = segment.trim();

    let colspanValue: number | undefined = undefined;
    let groupBreakPositions: number[] | undefined = undefined;
    let chhandNotes: string[] | null = null;
    const chhandSpan = extractChhandSpanFromSegment(trimmed);
    if (chhandSpan !== null) {
      colspanValue = chhandSpan;
    } else {
      const colspanMatch = trimmed.match(/\s*\/\s*(\d+)\s*$/);
      if (colspanMatch) {
        colspanValue = parseInt(colspanMatch[1], 10);
        trimmed = trimmed.replace(/\s*\/\s*\d+\s*$/, '').trim();
      }
    }

    if (index < leadingEmptyCount) {
      return;
    }

    if (chhandSpan !== null) {
      const rawInner = extractChhandInnerContent(trimmed);
      if (rawInner !== null) {
        const groups = rawInner
          .split(/\s*\/\s*/g)
          .map((g) => g.trim())
          .filter((g) => g.length > 0);

        if (groups.length > 0) {
          const combined: string[] = [];
          const breaks: number[] = [];

          groups.forEach((g, gi) => {
            const groupNotes = splitSegmentIntoNotes(g).filter((n) => n !== '');
            combined.push(...groupNotes);
            if (gi < groups.length - 1) {
              breaks.push(combined.length - 1);
            }
          });

          chhandNotes = combined.length > 0 ? combined : null;
          groupBreakPositions = breaks.length > 0 ? breaks : undefined;
          trimmed = combined.join(' ');
        } else {
          trimmed = '';
        }
      } else {
        if (isChhandIncompleteHeader(trimmed)) {
          trimmed = '';
        }
      }
    }

    const currentBeatInCycle = ((currentBeat - 1) % beatsPerCycle) + 1;

    if (!shouldStartNewPhrase && !currentPhraseGroup) {
      if (currentBeatInCycle === 1 && currentBeat > beatsPerCycle) {
        shouldStartNewPhrase = true;
        segmentIndexForNewPhrase = index;
        newPhraseId = getNextPhraseId(phraseId);
        currentPhraseGroup = {
          entries: [],
          phraseId: newPhraseId,
          startSegmentIndex: index,
          currentBeatInPhrase: 1
        };
      }
    } else if (currentPhraseGroup) {
      const currentPhraseEntryCount = currentPhraseGroup.entries.length;
      if (currentPhraseEntryCount >= beatsPerCycle) {
        phraseGroups.push(currentPhraseGroup);
        newPhraseId = getNextPhraseId(currentPhraseGroup.phraseId);
        segmentIndexForNewPhrase = index;
        currentPhraseGroup = {
          entries: [],
          phraseId: newPhraseId,
          startSegmentIndex: index,
          currentBeatInPhrase: 1
        };
      }
    }

    if (shouldStartNewPhrase || currentPhraseGroup) {
      if (!currentPhraseGroup && shouldStartNewPhrase) {
        currentPhraseGroup = {
          entries: newPhraseEntries,
          phraseId: newPhraseId!,
          startSegmentIndex: segmentIndexForNewPhrase,
          currentBeatInPhrase: index - segmentIndexForNewPhrase + 1
        };
      }

      if (!currentPhraseGroup) {
        return;
      }

      const phraseBeat = index - currentPhraseGroup.startSegmentIndex + 1;
      currentPhraseGroup.currentBeatInPhrase = phraseBeat;

      const beat = ((currentBeat - 1) % beatsPerCycle) + 1;

      if (trimmed === '') {
        const entry: NotationEntry = {
          beat: beat,
          absoluteBeat: currentBeat,
          swar: '',
          phraseId: currentPhraseGroup.phraseId
        };
        currentPhraseGroup.entries.push(entry);
        currentBeat++;
      } else if (trimmed === '-') {
        const entry: NotationEntry = {
          beat: beat,
          absoluteBeat: currentBeat,
          swar: '-',
          phraseId: currentPhraseGroup.phraseId
        };
        currentPhraseGroup.entries.push(entry);
        currentBeat++;
      } else {
        const notes = chhandNotes ?? splitSegmentIntoNotes(trimmed);

        if (notes.length === 0) {
          const entry: NotationEntry = {
            beat: beat,
            absoluteBeat: currentBeat,
            swar: '',
            phraseId: currentPhraseGroup.phraseId
          };
          currentPhraseGroup.entries.push(entry);
          currentBeat++;
        } else if (notes.length === 1) {
          const { swar, underscore, bold } = parseNote(notes[0]);

          const entry: NotationEntry = {
            beat: beat,
            absoluteBeat: currentBeat,
            swar: swar,
            phraseId: currentPhraseGroup.phraseId
          };

          if (underscore) entry.underscore = true;
          if (bold) entry.bold = true;
          if (swar === '/ck/') {
            entry.chikari = true;
            entry.swar = '';
          }

          if (groupBreakPositions && groupBreakPositions.length > 0) {
            entry.groupBreakPositions = groupBreakPositions;
          }

          if (colspanValue !== undefined && colspanValue > 1) {
            entry.colspan = colspanValue;
          }

          currentPhraseGroup.entries.push(entry);

          if (colspanValue !== undefined && colspanValue > 1) {
            for (let i = 1; i < colspanValue; i++) {
              const nextBeat = ((beat + i - 1) % beatsPerCycle) + 1;
              currentPhraseGroup.entries.push({
                beat: nextBeat,
                absoluteBeat: currentBeat + i,
                swar: '',
                phraseId: currentPhraseGroup.phraseId,
                colspan: 0
              });
            }
            currentBeat += colspanValue;
          } else {
            currentBeat++;
          }
        } else {
          const parsedNotes: string[] = [];
          const underscorePositions: number[] = [];
          const boldPositions: number[] = [];

          notes.forEach((note, index) => {
            const { swar, underscore, bold } = parseNote(note);
            parsedNotes.push(swar);
            if (underscore) underscorePositions.push(index);
            if (bold) boldPositions.push(index);
          });

          const entry: NotationEntry = {
            beat: beat,
            absoluteBeat: currentBeat,
            swar: parsedNotes.join(NOTE_SEPARATOR),
            phraseId: currentPhraseGroup.phraseId
          };

          if (underscorePositions.length > 0) {
            entry.underscore = true;
            entry.underscorePositions = underscorePositions;
          }

          if (boldPositions.length > 0) {
            entry.bold = true;
            entry.boldPositions = boldPositions;
          }

          if (groupBreakPositions && groupBreakPositions.length > 0) {
            entry.groupBreakPositions = groupBreakPositions;
          }

          if (colspanValue !== undefined && colspanValue > 1) {
            entry.colspan = colspanValue;
          }

          currentPhraseGroup.entries.push(entry);

          if (colspanValue !== undefined && colspanValue > 1) {
            for (let i = 1; i < colspanValue; i++) {
              const nextBeat = ((beat + i - 1) % beatsPerCycle) + 1;
              currentPhraseGroup.entries.push({
                beat: nextBeat,
                absoluteBeat: currentBeat + i,
                swar: '',
                phraseId: currentPhraseGroup.phraseId,
                colspan: 0
              });
            }
            currentBeat += colspanValue;
          } else {
            currentBeat++;
          }
        }
      }
    } else {
      if (trimmed === '') {
        const beat = ((currentBeat - 1) % beatsPerCycle) + 1;
        entries.push({
          beat: beat,
          absoluteBeat: currentBeat,
          swar: '',
          phraseId
        });
        currentBeat++;
      } else if (trimmed === '-') {
        const beat = ((currentBeat - 1) % beatsPerCycle) + 1;
        entries.push({
          beat: beat,
          absoluteBeat: currentBeat,
          swar: '-',
          phraseId
        });
        currentBeat++;
      } else {
        const notes = chhandNotes ?? splitSegmentIntoNotes(trimmed);

        if (notes.length === 0) {
          const beat = ((currentBeat - 1) % beatsPerCycle) + 1;
          entries.push({
            beat: beat,
            absoluteBeat: currentBeat,
            swar: '',
            phraseId
          });
          currentBeat++;
        } else if (notes.length === 1) {
          const { swar, underscore, bold } = parseNote(notes[0]);
          const beat = ((currentBeat - 1) % beatsPerCycle) + 1;
          const entry: NotationEntry = {
            beat: beat,
            absoluteBeat: currentBeat,
            swar: swar,
            phraseId
          };

          if (underscore) entry.underscore = true;
          if (bold) entry.bold = true;
          if (swar === '/ck/') {
            entry.chikari = true;
            entry.swar = '';
          }

          if (groupBreakPositions && groupBreakPositions.length > 0) {
            entry.groupBreakPositions = groupBreakPositions;
          }

          if (colspanValue !== undefined && colspanValue > 1) {
            entry.colspan = colspanValue;
          }

          entries.push(entry);

          if (colspanValue !== undefined && colspanValue > 1) {
            for (let i = 1; i < colspanValue; i++) {
              const nextBeat = ((beat + i - 1) % beatsPerCycle) + 1;
              entries.push({
                beat: nextBeat,
                absoluteBeat: currentBeat + i,
                swar: '',
                phraseId,
                colspan: 0
              });
            }
            currentBeat += colspanValue;
          } else {
            currentBeat++;
          }
        } else {
          const parsedNotes: string[] = [];
          const underscorePositions: number[] = [];
          const boldPositions: number[] = [];

          notes.forEach((note, index) => {
            const { swar, underscore, bold } = parseNote(note);
            parsedNotes.push(swar);
            if (underscore) underscorePositions.push(index);
            if (bold) boldPositions.push(index);
          });

          const beat = ((currentBeat - 1) % beatsPerCycle) + 1;
          const entry: NotationEntry = {
            beat: beat,
            absoluteBeat: currentBeat,
            swar: parsedNotes.join(NOTE_SEPARATOR),
            phraseId
          };

          if (underscorePositions.length > 0) {
            entry.underscore = true;
            entry.underscorePositions = underscorePositions;
          }

          if (boldPositions.length > 0) {
            entry.bold = true;
            entry.boldPositions = boldPositions;
          }

          if (groupBreakPositions && groupBreakPositions.length > 0) {
            entry.groupBreakPositions = groupBreakPositions;
          }

          if (colspanValue !== undefined && colspanValue > 1) {
            entry.colspan = colspanValue;
          }

          entries.push(entry);

          if (colspanValue !== undefined && colspanValue > 1) {
            for (let i = 1; i < colspanValue; i++) {
              const nextBeat = ((beat + i - 1) % beatsPerCycle) + 1;
              entries.push({
                beat: nextBeat,
                absoluteBeat: currentBeat + i,
                swar: '',
                phraseId,
                colspan: 0
              });
            }
            currentBeat += colspanValue;
          } else {
            currentBeat++;
          }
        }
      }
    }
  });

  const result: ParsedNotationResult = { entries };

  const allPhraseGroups: PhraseGroup[] = [...phraseGroups];
  const activeGroup = currentPhraseGroup as PhraseGroup | null;
  if (activeGroup !== null && activeGroup.entries.length > 0) {
    allPhraseGroups.push(activeGroup);
  }

  if (allPhraseGroups.length > 0) {
    const firstPhraseGroup = allPhraseGroups[0];
    result.newPhraseEntries = firstPhraseGroup.entries;
    result.newPhraseId = firstPhraseGroup.phraseId;

    if (allPhraseGroups.length > 1) {
      result.additionalPhrases = allPhraseGroups.slice(1).map((group: PhraseGroup) => ({
        entries: group.entries,
        phraseId: group.phraseId
      }));
    }
  } else if (shouldStartNewPhrase && newPhraseEntries.length > 0) {
    result.newPhraseEntries = newPhraseEntries;
    result.newPhraseId = newPhraseId;
  }

  return result;
}

export const LINE_TYPE_TO_PHRASE_ID: Record<string, string> = {
  'Sthayi': 'sthayi1',
  'Manjha': 'manjha',
  'Partial Sthayi': 'psthayi1',
  'Short Taan 1': 'taan1',
  'Short Taan 2': 'taan2',
  'Short Taan 3': 'taan3',
  'Antara Line 1': 'antara1',
  'Antara Line 2': 'antara2',
  'Long Taan': 'ltaan1',
  'Jhala': 'jhala1',
  'Chalan': 'chalan1',
  'Taan': 'taan1'
};

export function getLineTypeOptions(): string[] {
  return Object.keys(LINE_TYPE_TO_PHRASE_ID);
}

export function validateNotationInput(notationText: string): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const segments = notationText.split(',');

  segments.forEach((segment, segmentIndex) => {
    const trimmed = segment.trim();
    if (!trimmed || trimmed === '-') return;

    const notes = splitSegmentIntoNotes(trimmed);
    notes.forEach((note) => {
      const { isValid, invalidReason } = parseNote(note);
      if (!isValid && invalidReason) {
        warnings.push(`Segment ${segmentIndex + 1}: ${invalidReason}`);
      }
    });
  });

  return {
    isValid: warnings.length === 0,
    warnings
  };
}
