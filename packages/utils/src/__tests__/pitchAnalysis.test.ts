import { buildPitchSample, detectPitchHz, frequencyToNote, scorePitchMatch } from '../pitchAnalysis';

function sineWave(frequencyHz: number, sampleRate: number, durationSec = 0.2): Float32Array {
  const length = Math.floor(sampleRate * durationSec);
  const buffer = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    buffer[i] = Math.sin((2 * Math.PI * frequencyHz * i) / sampleRate);
  }
  return buffer;
}

describe('pitchAnalysis', () => {
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

  it('builds pitch samples with null when clarity is low', () => {
    const sample = buildPitchSample(440, 0.5);
    expect(sample.note).toBeNull();
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
