import {
  buildPitchSample,
  compareToTargetFrequency,
  detectPitchHz,
  formatNoteLabel,
  frequencyToNote,
  isVocalFrequency,
  normalizeToTargetOctave,
  scorePitchCloseness,
  scorePitchMatch,
  aggregatePitchWindow,
  updateStablePitchReadout,
  westernNoteToSwara,
} from '../pitchAnalysis';

function sineWave(frequencyHz: number, sampleRate: number, durationSec = 0.5): Float32Array {
  const length = Math.floor(sampleRate * durationSec);
  const buffer = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    buffer[i] = Math.sin((2 * Math.PI * frequencyHz * i) / sampleRate);
  }
  return buffer;
}

describe('pitchAnalysis', () => {
  it('detects known test frequencies within tolerance', () => {
    const sampleRate = 44100;
    for (const targetHz of [240, 270, 300, 329.63, 440]) {
      const buffer = sineWave(targetHz, sampleRate);
      const result = detectPitchHz(buffer, sampleRate);
      expect(result.frequencyHz).not.toBeNull();
      expect(result.frequencyHz!).toBeGreaterThan(targetHz - 15);
      expect(result.frequencyHz!).toBeLessThan(targetHz + 15);
    }
  });

  it('scores perfect matches above 90%', () => {
    const target = 293.66;
    const result = compareToTargetFrequency(target, target);
    expect(result.closenessPercent).toBeGreaterThanOrEqual(90);
  });

  it('scores wrong notes much lower than perfect matches', () => {
    const target = 293.66;
    const perfect = compareToTargetFrequency(target, target).closenessPercent;
    const wrong = compareToTargetFrequency(261.63, target).closenessPercent;
    expect(wrong).toBeLessThan(perfect);
    expect(wrong).toBeLessThan(50);
  });

  it('picks the nearest octave when normalizing pitch', () => {
    expect(normalizeToTargetOctave(161.6, 293.66)).toBeCloseTo(323.2, 0);
    expect(normalizeToTargetOctave(130.81, 261.63)).toBeCloseTo(261.62, 1);
  });

  it('maps western notes to swara labels', () => {
    expect(westernNoteToSwara('D4')).toBe('R');
    expect(westernNoteToSwara('C4')).toBe('S');
  });

  it('detects a sine wave near the target frequency', () => {
    const sampleRate = 44100;
    const buffer = sineWave(440, sampleRate);
    const result = detectPitchHz(buffer, sampleRate);
    expect(result.frequencyHz).not.toBeNull();
    expect(result.frequencyHz!).toBeGreaterThan(430);
    expect(result.frequencyHz!).toBeLessThan(450);
  });

  it('maps frequency to note', () => {
    expect(frequencyToNote(440).note).toBe('A4');
  });

  it('keeps raw frequency when clarity is low but drops note mapping', () => {
    const sample = buildPitchSample(440, 0.5);
    expect(sample.frequencyHz).toBe(440);
    expect(sample.note).toBeNull();
  });

  it('scores closeness against an expected target frequency', () => {
    const target = 277.18; // C#4
    const slightlyFlat = compareToTargetFrequency(target - 12, target);
    expect(slightlyFlat.actualFrequencyHz).toBeCloseTo(target - 12, 0);
    expect(slightlyFlat.closenessPercent).toBeGreaterThan(0);
    expect(slightlyFlat.closenessPercent).toBeLessThan(100);

    const perfect = compareToTargetFrequency(target, target);
    expect(perfect.closenessPercent).toBe(100);
    expect(perfect.frequencyDeltaHz).toBe(0);
  });

  it('normalizes detected pitch into the target octave', () => {
    expect(normalizeToTargetOctave(130.81, 261.63)).toBeCloseTo(261.62, 1);
  });

  it('averages closeness across a performance', () => {
    const targets = [
      { timestamp: 1000, frequencyHz: 440 },
      { timestamp: 1100, frequencyHz: 440 },
    ];
    const perf = [
      buildPitchSample(442, 0.95, 1000),
      buildPitchSample(438, 0.95, 1100),
    ];
    expect(scorePitchCloseness(targets, perf)).toBeGreaterThan(50);
  });

  it('formats note labels without octave', () => {
    expect(formatNoteLabel('C#4')).toBe('C#');
    expect(formatNoteLabel('A5')).toBe('A');
  });

  it('holds the last stable pitch when samples drop out', () => {
    const good = buildPitchSample(277, 0.9);
    const stable = updateStablePitchReadout(null, good);
    expect(stable?.noteLabel).toBe('C#');
    expect(stable?.frequencyHz).toBe(277);

    const dropout = buildPitchSample(null, 0.2);
    const held = updateStablePitchReadout(stable, dropout);
    expect(held).toEqual(stable);
  });

  it('rejects frequencies outside the vocal range', () => {
    expect(isVocalFrequency(440)).toBe(true);
    expect(isVocalFrequency(50)).toBe(false);
    expect(isVocalFrequency(2000)).toBe(false);
  });

  it('aggregates a 250ms window to the median confident reading', () => {
    const readings = [
      { frequencyHz: 290, clarity: 0.8 },
      { frequencyHz: 294, clarity: 0.85 },
      { frequencyHz: 580, clarity: 0.7 },
      { frequencyHz: 292, clarity: 0.82 },
    ];
    const { frequencyHz } = aggregatePitchWindow(readings);
    expect(frequencyHz).toBeGreaterThan(288);
    expect(frequencyHz).toBeLessThan(296);
  });

  it('jumps stable readout when the note changes', () => {
    const good = buildPitchSample(277, 0.9);
    const stable = updateStablePitchReadout(null, good);
    const nextNote = buildPitchSample(330, 0.9);
    const jumped = updateStablePitchReadout(stable, nextNote);
    expect(jumped?.frequencyHz).toBe(330);
  });

  it('scores matching pitch sequences', () => {
    const ref = [
      buildPitchSample(440, 0.95, 1000),
      buildPitchSample(440, 0.95, 1100),
    ];
    const perf = [
      buildPitchSample(442, 0.95, 1000),
      buildPitchSample(438, 0.95, 1100),
    ];
    expect(scorePitchMatch(ref, perf)).toBeGreaterThan(0);
  });
});
