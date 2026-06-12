import {
  buildPitchPlaybackSchedule,
  parsePitchCsv,
  summarizePitchCsvRows,
} from '../pitchCsv';

const SAMPLE_CSV = `Time (ms),Time (s),Frequency (Hz),Note,Cents,Confidence (%)
0,0.00,261.6,C4,0,85
250,0.25,293.7,D4,5,82
500,0.50,,,,
750,0.75,329.6,E4,-3,80
1000,1.00,392.0,G4,0,78`;

describe('pitchCsv', () => {
  it('parses exported pitch CSV using time ms and frequency hz', () => {
    const rows = parsePitchCsv(SAMPLE_CSV);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual({ elapsedMs: 0, frequencyHz: 261.6 });
    expect(rows[1].frequencyHz).toBeCloseTo(293.7, 1);
    expect(rows[2].frequencyHz).toBeNull();
    expect(rows[3].frequencyHz).toBeCloseTo(329.6, 1);
  });

  it('builds playback segments until the next timestamp', () => {
    const rows = parsePitchCsv(SAMPLE_CSV);
    const schedule = buildPitchPlaybackSchedule(rows);
    expect(schedule).toHaveLength(4);
    expect(schedule[0]).toEqual({ startMs: 0, endMs: 250, frequencyHz: 261.6 });
    expect(schedule[1]).toEqual({ startMs: 250, endMs: 750, frequencyHz: 293.7 });
    expect(schedule[2]).toEqual({ startMs: 750, endMs: 1000, frequencyHz: 329.6 });
    expect(schedule[3]).toEqual({ startMs: 1000, endMs: 1250, frequencyHz: 392 });
  });

  it('summarizes row counts and duration', () => {
    const rows = parsePitchCsv(SAMPLE_CSV);
    expect(summarizePitchCsvRows(rows)).toEqual({
      rowCount: 5,
      pitchedCount: 4,
      durationMs: 1000,
    });
  });

  it('throws when required columns are missing', () => {
    expect(() => parsePitchCsv('note,clarity\nC4,90')).toThrow(/Time \(ms\)/);
  });
});
