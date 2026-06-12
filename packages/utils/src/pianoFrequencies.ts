/** Piano key frequencies (12-TET, A4 = 440 Hz). See Wikipedia: Piano key frequencies. */

export type PianoKey = {
  name: string;
  label: string;
  frequencyHz: number;
  midi: number;
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** MIDI note number → Hz (A4 / MIDI 69 = 440 Hz). Inverse of frequencyToMidiFloat. */
export function pianoFrequencyHz(midiNote: number, a4 = 440): number {
  return 2 ** ((midiNote - 69) / 12) * a4;
}

/**
 * Frequency → MIDI note number (continuous).
 * Standard formula: n = 69 + 12 × log₂(f / 440)
 * (A4 = 440 Hz = MIDI 69)
 */
export function frequencyToMidiFloat(frequencyHz: number, a4 = 440): number {
  return 69 + 12 * Math.log2(frequencyHz / a4);
}

/** Hz → nearest integer MIDI note (rounds the formula above). */
export function frequencyToMidi(frequencyHz: number, a4 = 440): number {
  return Math.round(frequencyToMidiFloat(frequencyHz, a4));
}

/** 0 = bottom (minMidi), 1 = top (maxMidi) on a linear-in-MIDI chart axis. */
export function midiToChartAxisRatio(midi: number, minMidi: number, maxMidi: number): number {
  const clamped = Math.max(minMidi, Math.min(maxMidi, midi));
  return (clamped - minMidi) / (maxMidi - minMidi);
}

export function frequencyToChartAxisRatio(
  frequencyHz: number,
  minMidi: number,
  maxMidi: number,
  a4 = 440,
): number {
  return midiToChartAxisRatio(frequencyToMidiFloat(frequencyHz, a4), minMidi, maxMidi);
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

/** Full practice chart span: C2 (65 Hz) through C6 (1047 Hz). */
export const PITCH_CHART_MIN_MIDI = 36;
export const PITCH_CHART_MAX_MIDI = 84;

/** Chromatic keys for the fixed pitch chart Y axis. */
export function buildPitchChartPianoKeys(a4 = 440): PianoKey[] {
  return buildPianoRangeBetweenMidi(PITCH_CHART_MIN_MIDI, PITCH_CHART_MAX_MIDI, a4);
}

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
