import {
  buildPitchChartPianoKeys,
  frequencyToChartAxisRatio,
  frequencyToMidi,
  frequencyToMidiFloat,
  midiToChartAxisRatio,
  midiToNoteName,
  pianoFrequencyHz,
  PITCH_CHART_MAX_MIDI,
  PITCH_CHART_MIN_MIDI,
} from '../pianoFrequencies';

describe('pianoFrequencies', () => {
  it('uses n = 69 + 12 × log₂(f/440) for frequency → MIDI', () => {
    expect(frequencyToMidiFloat(440)).toBeCloseTo(69, 10);
    expect(frequencyToMidiFloat(261.63)).toBeCloseTo(60, 2);
    expect(frequencyToMidiFloat(440)).toBe(69 + 12 * Math.log2(440 / 440));
    expect(frequencyToMidi(440)).toBe(69);
    expect(midiToNoteName(60)).toBe('C4');
    expect(midiToNoteName(69)).toBe('A4');
  });

  it('names C2 and C6 at chart bounds', () => {
    expect(midiToNoteName(PITCH_CHART_MIN_MIDI)).toBe('C2');
    expect(midiToNoteName(PITCH_CHART_MAX_MIDI)).toBe('C6');
  });

  it('maps A4 (440 Hz) to MIDI 69', () => {
    expect(frequencyToMidi(440)).toBe(69);
    expect(midiToNoteName(69)).toBe('A4');
    expect(pianoFrequencyHz(69)).toBeCloseTo(440, 5);
  });

  it('places A4 on the A4 grid line (not a neighboring note)', () => {
    const keys = buildPitchChartPianoKeys();
    const a4 = keys.find((k) => k.name === 'A4');
    expect(a4).toBeDefined();

    const gridRatio = midiToChartAxisRatio(a4!.midi, PITCH_CHART_MIN_MIDI, PITCH_CHART_MAX_MIDI);
    const pitchRatio = frequencyToChartAxisRatio(440, PITCH_CHART_MIN_MIDI, PITCH_CHART_MAX_MIDI);
    expect(pitchRatio).toBeCloseTo(gridRatio, 10);
  });

  it('keeps Bhupali reference notes on their labeled grid lines', () => {
    const refs: Array<[number, string]> = [
      [261.63, 'C4'],
      [293.66, 'D4'],
      [329.63, 'E4'],
      [392.0, 'G4'],
      [440.0, 'A4'],
      [523.25, 'C5'],
    ];

    const keys = buildPitchChartPianoKeys();

    for (const [hz, name] of refs) {
      const key = keys.find((k) => k.name === name);
      expect(key).toBeDefined();
      const gridRatio = midiToChartAxisRatio(key!.midi, PITCH_CHART_MIN_MIDI, PITCH_CHART_MAX_MIDI);
      const pitchRatio = frequencyToChartAxisRatio(hz, PITCH_CHART_MIN_MIDI, PITCH_CHART_MAX_MIDI);
      expect(pitchRatio).toBeCloseTo(gridRatio, 4);
      expect(frequencyToMidiFloat(hz)).toBeCloseTo(key!.midi, 1);
    }
  });
});
