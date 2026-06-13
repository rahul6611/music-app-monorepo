import { isVocalFrequency, PITCH_SAMPLE_INTERVAL_MS } from '@music-app/utils';

export type ChartPoint = { x: number; y: number };

export type TimedPitchSample = {
  elapsedMs: number;
  frequencyHz: number | null;
};

export const PITCH_RUN_GAP_MS = PITCH_SAMPLE_INTERVAL_MS + 125;

export function isChartPitchedSample(sample: { frequencyHz: number | null }): boolean {
  return (
    sample.frequencyHz != null &&
    sample.frequencyHz > 0 &&
    isVocalFrequency(sample.frequencyHz)
  );
}

export function splitPitchRuns<T extends TimedPitchSample>(
  samples: T[],
  maxElapsedMs?: number,
): T[][] {
  const ordered = [...samples]
    .filter((s) => maxElapsedMs == null || s.elapsedMs <= maxElapsedMs)
    .sort((a, b) => a.elapsedMs - b.elapsedMs);

  const runs: T[][] = [];
  let current: T[] = [];

  for (const sample of ordered) {
    if (isChartPitchedSample(sample)) {
      const last = current[current.length - 1];
      if (last && sample.elapsedMs - last.elapsedMs > PITCH_RUN_GAP_MS) {
        runs.push(current);
        current = [];
      }
      current.push(sample);
      continue;
    }

    if (current.length > 0) {
      runs.push(current);
      current = [];
    }
  }

  if (current.length > 0) runs.push(current);
  return runs;
}

/** Catmull-Rom spline converted to cubic-bezier SVG path segments (Riyaz-style smooth curve). */
export function buildSmoothPitchPath(points: ChartPoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;

  for (const segment of smoothPitchBezierSegments(points)) {
    d += ` C ${segment.cp1x} ${segment.cp1y}, ${segment.cp2x} ${segment.cp2y}, ${segment.x} ${segment.y}`;
  }

  return d;
}

type SmoothBezierSegment = {
  cp1x: number;
  cp1y: number;
  cp2x: number;
  cp2y: number;
  x: number;
  y: number;
};

export function smoothPitchBezierSegments(points: ChartPoint[]): SmoothBezierSegment[] {
  if (points.length < 2) return [];

  const segments: SmoothBezierSegment[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    segments.push({
      cp1x: p1.x + (p2.x - p0.x) / 6,
      cp1y: p1.y + (p2.y - p0.y) / 6,
      cp2x: p2.x - (p3.x - p1.x) / 6,
      cp2y: p2.y - (p3.y - p1.y) / 6,
      x: p2.x,
      y: p2.y,
    });
  }

  return segments;
}

type CurveStrokeContext = {
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  bezierCurveTo: (
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ) => void;
  stroke: () => void;
};

export function strokeSmoothPitchCurve(ctx: CurveStrokeContext, points: ChartPoint[]): void {
  if (points.length === 0) return;
  if (points.length === 1) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.stroke();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (const segment of smoothPitchBezierSegments(points)) {
    ctx.bezierCurveTo(
      segment.cp1x,
      segment.cp1y,
      segment.cp2x,
      segment.cp2y,
      segment.x,
      segment.y,
    );
  }

  ctx.stroke();
}

export function buildSmoothPitchPaths(
  runs: TimedPitchSample[],
  toPoint: (sample: TimedPitchSample) => ChartPoint,
  maxElapsedMs?: number,
): string[] {
  return splitPitchRuns(runs, maxElapsedMs)
    .map((run) => buildSmoothPitchPath(run.map(toPoint)))
    .filter((path) => path.length > 0);
}
