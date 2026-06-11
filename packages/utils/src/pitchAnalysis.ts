export type PitchSample = {
  timestamp: number;
  frequencyHz: number | null;
  clarity: number;
  note: string | null;
  cents: number | null;
};

export type PitchSession = {
  id: string;
  startedAt: number;
  endedAt: number;
  sampleRate: number;
  samples: PitchSample[];
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** Typical singing practice range — used to reject bad detections from chart scaling. */
export const VOCAL_MIN_HZ = 80;
export const VOCAL_MAX_HZ = 1100;

export function isVocalFrequency(frequencyHz: number): boolean {
  return frequencyHz >= VOCAL_MIN_HZ && frequencyHz <= VOCAL_MAX_HZ;
}

/**
 * Reject single-frame octave spikes by comparing to a short median history.
 * Returns null when the reading is outside the vocal range.
 */
export function stabilizeDetectedFrequency(
  frequencyHz: number | null,
  clarity: number,
  recentHz: number[],
  options: { minClarity?: number; maxOutlierCents?: number } = {},
): { frequencyHz: number | null; recentHz: number[] } {
  const { minClarity = 0.5, maxOutlierCents = 140 } = options;
  const nextRecent = recentHz;

  if (frequencyHz == null || clarity < minClarity || !isVocalFrequency(frequencyHz)) {
    return { frequencyHz: null, recentHz: nextRecent };
  }

  if (nextRecent.length >= 4) {
    const sorted = [...nextRecent].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const centsOff = Math.abs(1200 * Math.log2(frequencyHz / median));
    if (centsOff > maxOutlierCents) {
      const updated = [...nextRecent, median];
      while (updated.length > 9) updated.shift();
      return { frequencyHz: median, recentHz: updated };
    }
  }

  nextRecent.push(frequencyHz);
  while (nextRecent.length > 9) nextRecent.shift();

  return { frequencyHz, recentHz: nextRecent };
}

/** Autocorrelation pitch detection. Returns Hz or null if no clear pitch. */
export function detectPitchHz(
  buffer: Float32Array,
  sampleRate: number,
  minHz = 65,
  maxHz = 1200,
): { frequencyHz: number | null; clarity: number } {
  const size = buffer.length;
  if (size < 2 || sampleRate <= 0) return { frequencyHz: null, clarity: 0 };

  let rms = 0;
  for (let i = 0; i < size; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / size);
  if (rms < 0.006) return { frequencyHz: null, clarity: 0 };

  const minLag = Math.floor(sampleRate / maxHz);
  const maxLag = Math.min(Math.floor(sampleRate / minHz), size - 1);
  if (minLag >= maxLag) return { frequencyHz: null, clarity: 0 };

  const correlations = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < size - lag; i++) {
      sum += buffer[i] * buffer[i + lag];
    }
    correlations[lag] = sum / (size - lag);
  }

  let bestLag = -1;
  let bestScore = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let score = correlations[lag];
    if (lag * 2 <= maxLag) score += correlations[lag * 2] * 0.5;
    if (lag * 3 <= maxLag) score += correlations[lag * 3] * 0.33;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  const bestCorr = bestLag > 0 ? correlations[bestLag] : 0;

  if (bestLag <= 0) {
    return { frequencyHz: null, clarity: 0 };
  }

  let resolvedLag = bestLag;
  if (bestLag > minLag && bestLag < maxLag) {
    const y1 = correlations[bestLag - 1];
    const y2 = correlations[bestLag];
    const y3 = correlations[bestLag + 1];
    const denom = 2 * y2 - y1 - y3;
    if (denom !== 0) {
      const delta = (y3 - y1) / (2 * denom);
      if (Number.isFinite(delta) && Math.abs(delta) < 1) {
        resolvedLag = bestLag + delta;
      }
    }
  }

  const clarity = Math.max(0, Math.min(1, bestCorr / (rms * rms + 1e-6)));
  if (clarity < 0.52) {
    return { frequencyHz: null, clarity };
  }

  const frequencyHz = sampleRate / resolvedLag;
  if (!isVocalFrequency(frequencyHz)) {
    return { frequencyHz: null, clarity };
  }

  return { frequencyHz, clarity };
}

export type StablePitchReadout = {
  frequencyHz: number;
  note: string | null;
  noteLabel: string | null;
};

/** Strip octave digits for display, e.g. C#4 → C#. */
export function formatNoteLabel(note: string): string {
  return note.replace(/\d+$/, '');
}

/**
 * Hold the last confident pitch reading so the UI does not flicker on brief dropouts.
 * New readings are lightly smoothed; null/weak samples keep the previous value.
 */
export function updateStablePitchReadout(
  previous: StablePitchReadout | null,
  sample: PitchSample | null,
  options: { smoothing?: number; minClarity?: number } = {},
): StablePitchReadout | null {
  const { smoothing = 0.35, minClarity = 0.58 } = options;
  if (!sample?.frequencyHz || sample.clarity < minClarity) {
    return previous;
  }

  const frequencyHz = previous
    ? previous.frequencyHz * (1 - smoothing) + sample.frequencyHz * smoothing
    : sample.frequencyHz;
  const note =
    sample.note ??
    previous?.note ??
    frequencyToNote(frequencyHz).note;
  const noteLabel = formatNoteLabel(note);

  return { frequencyHz, note, noteLabel };
}

export function frequencyToNote(frequencyHz: number, a4 = 440): { note: string; cents: number } {
  const semitonesFromA4 = 12 * Math.log2(frequencyHz / a4);
  const rounded = Math.round(semitonesFromA4);
  const cents = Math.round((semitonesFromA4 - rounded) * 100);
  const noteIndex = ((rounded % 12) + 12 + 9) % 12;
  const octave = 4 + Math.floor((rounded + 9) / 12);
  return { note: `${NOTE_NAMES[noteIndex]}${octave}`, cents };
}

/** Shift detected pitch into the octave closest to the target note. */
export function normalizeToTargetOctave(actualHz: number, targetHz: number): number {
  let bestHz = actualHz;
  let bestAbsCents = Infinity;

  for (let shift = -2; shift <= 2; shift++) {
    const candidate = actualHz * 2 ** shift;
    const absCents = Math.abs(1200 * Math.log2(candidate / targetHz));
    if (absCents < bestAbsCents) {
      bestAbsCents = absCents;
      bestHz = candidate;
    }
  }

  return bestHz;
}

/** Map Western note label to Bhupali swara for the practice scale (C4 = Sa). */
export function westernNoteToSwara(noteLabel: string): string | null {
  const base = formatNoteLabel(noteLabel).replace(/[^A-G#]/g, '');
  const SWARA: Record<string, string> = {
    C: 'S',
    D: 'R',
    E: 'G',
    'F#': 'P',
    'G#': 'D',
    'A#': 'Ṡ',
  };
  return SWARA[base] ?? null;
}

export type PitchDeviation = {
  actualFrequencyHz: number;
  targetFrequencyHz: number;
  frequencyDeltaHz: number;
  centsFromTarget: number;
  closenessPercent: number;
};

/**
 * Compare a detected frequency to an expected note frequency.
 * closenessPercent is 100 at perfect match and falls linearly to 0 at toleranceCents.
 */
export function compareToTargetFrequency(
  actualHz: number,
  targetHz: number,
  toleranceCents = 100,
): PitchDeviation {
  const normalizedHz = normalizeToTargetOctave(actualHz, targetHz);
  const centsFromTarget = 1200 * Math.log2(normalizedHz / targetHz);
  const absCents = Math.abs(centsFromTarget);
  const closenessPercent =
    toleranceCents <= 0
      ? absCents === 0
        ? 100
        : 0
      : Math.max(0, Math.round(100 * (1 - absCents / toleranceCents)));

  return {
    actualFrequencyHz: normalizedHz,
    targetFrequencyHz: targetHz,
    frequencyDeltaHz: Math.round((normalizedHz - targetHz) * 10) / 10,
    centsFromTarget: Math.round(centsFromTarget),
    closenessPercent,
  };
}

/** Average closeness % across performance samples aligned to reference targets. */
export function scorePitchCloseness(
  targets: { timestamp: number; frequencyHz: number }[],
  performance: PitchSample[],
  toleranceCents = 50,
): number {
  const perfPitched = performance.filter((s) => s.frequencyHz != null);
  if (targets.length === 0 || perfPitched.length === 0) return 0;

  let total = 0;
  let comparisons = 0;

  for (const perf of perfPitched) {
    const target = nearestTargetByTime(targets, perf.timestamp);
    if (!target || !perf.frequencyHz) continue;
    const { closenessPercent } = compareToTargetFrequency(
      perf.frequencyHz,
      target.frequencyHz,
      toleranceCents,
    );
    total += closenessPercent;
    comparisons++;
  }

  return comparisons === 0 ? 0 : Math.round(total / comparisons);
}

function nearestTargetByTime(
  targets: { timestamp: number; frequencyHz: number }[],
  timestamp: number,
): { timestamp: number; frequencyHz: number } | null {
  let best: { timestamp: number; frequencyHz: number } | null = null;
  let bestDelta = Infinity;
  for (const target of targets) {
    const delta = Math.abs(target.timestamp - timestamp);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = target;
    }
  }
  return bestDelta <= 250 ? best : null;
}

export function buildPitchSample(
  frequencyHz: number | null,
  clarity: number,
  timestamp = Date.now(),
  a4 = 440,
): PitchSample {
  if (frequencyHz == null) {
    return { timestamp, frequencyHz: null, clarity, note: null, cents: null };
  }
  if (clarity < 0.58) {
    return { timestamp, frequencyHz, clarity, note: null, cents: null };
  }
  const { note, cents } = frequencyToNote(frequencyHz, a4);
  return { timestamp, frequencyHz, clarity, note, cents };
}

/** Compare two pitch streams for Riyaz-style scoring (0–100). */
export function scorePitchMatch(
  reference: PitchSample[],
  performance: PitchSample[],
  toleranceCents = 50,
): number {
  const refPitched = reference.filter((s) => s.frequencyHz != null);
  const perfPitched = performance.filter((s) => s.frequencyHz != null);
  if (refPitched.length === 0 || perfPitched.length === 0) return 0;

  let matches = 0;
  let comparisons = 0;

  for (const perf of perfPitched) {
    const ref = nearestSampleByTime(refPitched, perf.timestamp);
    if (!ref?.frequencyHz || !perf.frequencyHz) continue;
    comparisons++;
    const perfCents = 1200 * Math.log2(perf.frequencyHz / ref.frequencyHz);
    if (Math.abs(perfCents) <= toleranceCents) matches++;
  }

  return comparisons === 0 ? 0 : Math.round((matches / comparisons) * 100);
}

function nearestSampleByTime(samples: PitchSample[], timestamp: number): PitchSample | null {
  let best: PitchSample | null = null;
  let bestDelta = Infinity;
  for (const sample of samples) {
    const delta = Math.abs(sample.timestamp - timestamp);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = sample;
    }
  }
  return bestDelta <= 250 ? best : null;
}
