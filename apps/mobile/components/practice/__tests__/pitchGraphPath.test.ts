import { buildSmoothPitchPath, smoothPitchBezierSegments, splitPitchRuns } from '../pitchGraphPath';

describe('pitchGraphPath', () => {
  it('builds an SVG path from chart points', () => {
    const path = buildSmoothPitchPath([
      { x: 0, y: 100 },
      { x: 8, y: 90 },
      { x: 16, y: 80 },
    ]);
    expect(path.startsWith('M 0 100')).toBe(true);
    expect(path).toContain('C');
  });

  it('returns empty path for no points', () => {
    expect(buildSmoothPitchPath([])).toBe('');
  });

  it('splits pitched runs with gaps during silence', () => {
    const runs = splitPitchRuns([
      { elapsedMs: 0, frequencyHz: 440 },
      { elapsedMs: 250, frequencyHz: 442 },
      { elapsedMs: 500, frequencyHz: null },
      { elapsedMs: 750, frequencyHz: null },
      { elapsedMs: 1000, frequencyHz: 330 },
    ]);

    expect(runs).toHaveLength(2);
    expect(runs[0]).toHaveLength(2);
    expect(runs[1]).toHaveLength(1);
  });

  it('does not connect across a silent sample in the timeline', () => {
    const runs = splitPitchRuns([
      { elapsedMs: 0, frequencyHz: 261.63 },
      { elapsedMs: 250, frequencyHz: null, clarity: 0.1 } as any,
      { elapsedMs: 500, frequencyHz: 293.66 },
    ]);

    expect(runs).toHaveLength(2);
  });

  it('splits runs when pitched samples are separated by a time gap', () => {
    const runs = splitPitchRuns([
      { elapsedMs: 0, frequencyHz: 261.63 },
      { elapsedMs: 1000, frequencyHz: 293.66 },
    ]);

    expect(runs).toHaveLength(2);
  });
});
