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
  if (rms < 0.01) return { frequencyHz: null, clarity: 0 };

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
  let bestCorr = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (correlations[lag] > bestCorr) {
      bestCorr = correlations[lag];
      bestLag = lag;
    }
  }

  if (bestLag <= 0) {
    return { frequencyHz: null, clarity: 0 };
  }

  const clarity = Math.max(0, Math.min(1, bestCorr / (rms * rms + 1e-6)));
  if (clarity < 0.75) {
    return { frequencyHz: null, clarity };
  }

  return { frequencyHz: sampleRate / bestLag, clarity };
}

export function frequencyToNote(frequencyHz: number, a4 = 440): { note: string; cents: number } {
  const semitonesFromA4 = 12 * Math.log2(frequencyHz / a4);
  const rounded = Math.round(semitonesFromA4);
  const cents = Math.round((semitonesFromA4 - rounded) * 100);
  const noteIndex = ((rounded % 12) + 12 + 9) % 12;
  const octave = 4 + Math.floor((rounded + 9) / 12);
  return { note: `${NOTE_NAMES[noteIndex]}${octave}`, cents };
}

export function buildPitchSample(
  frequencyHz: number | null,
  clarity: number,
  timestamp = Date.now(),
  a4 = 440,
): PitchSample {
  if (frequencyHz == null || clarity < 0.85) {
    return { timestamp, frequencyHz: null, clarity, note: null, cents: null };
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
