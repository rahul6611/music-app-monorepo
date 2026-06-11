/** Piano key frequencies (12-TET, A4 = 440 Hz). See Wikipedia: Piano key frequencies. */

export type PianoKey = {
  name: string;
  label: string;
  frequencyHz: number;
  midi: number;
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** MIDI note number → Hz (A4 / MIDI 69 = 440 Hz). */
export function pianoFrequencyHz(midiNote: number, a4 = 440): number {
  return 2 ** ((midiNote - 69) / 12) * a4;
}

/** Hz → nearest MIDI note number. */
export function frequencyToMidi(frequencyHz: number, a4 = 440): number {
  return Math.round(12 * Math.log2(frequencyHz / a4) + 69);
}

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const note = NOTE_NAMES[((midi % 12) + 12) % 12];
  return `${note}${octave}`;
}

/** Build a chromatic range centered on a MIDI note (inclusive). */
export function buildPianoRange(
  centerMidi: number,
  semitonesBelow: number,
  semitonesAbove: number,
  a4 = 440,
): PianoKey[] {
  const keys: PianoKey[] = [];
  for (let midi = centerMidi - semitonesBelow; midi <= centerMidi + semitonesAbove; midi++) {
    const name = midiToNoteName(midi);
    keys.push({
      name,
      label: name.replace(/\d+$/, ''),
      frequencyHz: pianoFrequencyHz(midi, a4),
      midi,
    });
  }
  return keys;
}

/** Map Hz to 0–1 on a log-frequency axis between min and max Hz. */
export function frequencyToAxisRatio(frequencyHz: number, minHz: number, maxHz: number): number {
  const clamped = Math.max(minHz, Math.min(maxHz, frequencyHz));
  const logMin = Math.log2(minHz);
  const logMax = Math.log2(maxHz);
  return (Math.log2(clamped) - logMin) / (logMax - logMin);
}

/** A3 = MIDI 57 = 220 Hz */
export const PITCH_CHART_CENTER_MIDI = 57;

/** C3–C6 covers typical Bhupali practice without wild outlier expansion. */
export const PITCH_CHART_MIN_MIDI = 48;
export const PITCH_CHART_MAX_MIDI = 84;

/** Expand piano range to fit sample pitches with padding; never shrinks below default span. */
export function buildPianoRangeForSamples(
  sampleHz: number[],
  centerMidi = PITCH_CHART_CENTER_MIDI,
  semitonesBelow = 5,
  semitonesAbove = 10,
  paddingSemitones = 2,
  minSpanSemitones = 12,
  a4 = 440,
  minMidiCap = PITCH_CHART_MIN_MIDI,
  maxMidiCap = PITCH_CHART_MAX_MIDI,
): PianoKey[] {
  const defaultMin = centerMidi - semitonesBelow;
  const defaultMax = centerMidi + semitonesAbove;
  let minMidi = defaultMin;
  let maxMidi = defaultMax;

  for (const hz of sampleHz) {
    if (!hz || hz <= 0) continue;
    const midi = frequencyToMidi(hz, a4);
    if (midi < minMidiCap - 4 || midi > maxMidiCap + 4) continue;
    minMidi = Math.min(minMidi, midi - paddingSemitones);
    maxMidi = Math.max(maxMidi, midi + paddingSemitones);
  }

  minMidi = Math.max(minMidi, minMidiCap);
  maxMidi = Math.min(maxMidi, maxMidiCap);

  const span = maxMidi - minMidi;
  if (span < minSpanSemitones) {
    const mid = Math.round((minMidi + maxMidi) / 2);
    minMidi = mid - Math.floor(minSpanSemitones / 2);
    maxMidi = mid + Math.ceil(minSpanSemitones / 2);
  }

  const keys: PianoKey[] = [];
  for (let midi = minMidi; midi <= maxMidi; midi++) {
    const name = midiToNoteName(midi);
    keys.push({
      name,
      label: name.replace(/\d+$/, ''),
      frequencyHz: pianoFrequencyHz(midi, a4),
      midi,
    });
  }
  return keys;
}

export function buildPianoRangeBetweenMidi(minMidi: number, maxMidi: number, a4 = 440): PianoKey[] {
  const keys: PianoKey[] = [];
  for (let midi = minMidi; midi <= maxMidi; midi++) {
    const name = midiToNoteName(midi);
    keys.push({
      name,
      label: name.replace(/\d+$/, ''),
      frequencyHz: pianoFrequencyHz(midi, a4),
      midi,
    });
  }
  return keys;
}
