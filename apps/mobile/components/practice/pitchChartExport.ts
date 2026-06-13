import {
  buildPitchChartPianoKeys,
  buildPitchCsvFilename,
  frequencyToChartAxisRatio,
  midiToChartAxisRatio,
  PITCH_CHART_CENTER_MIDI,
  PITCH_CHART_MAX_MIDI,
  PITCH_CHART_MIN_MIDI,
  serializePitchSamplesCsv,
} from '@music-app/utils';
import type { GraphPitchSample } from './PitchGraph';
import {
  buildChartLayout,
  buildGridLabels,
  resolveTimelineMs,
} from './pitchChartLayout';
import { splitPitchRuns, strokeSmoothPitchCurve } from './pitchGraphPath';

const AXIS_LEFT = 56;
const AXIS_BOTTOM = 34;
const CHART_PADDING_Y = 14;
const MIN_PX_PER_NOTE = 10;
const MIN_CHART_PLOT_HEIGHT = 520;
const PNG_CHART_VIEWPORT_WIDTH = 800;

function shouldShowYLabel(index: number, total: number): boolean {
  if (total <= 13) return true;
  if (total <= 20) return index % 2 === 0;
  return index % 3 === 0;
}

function computePlotHeight(noteCount: number): number {
  return Math.max(MIN_CHART_PLOT_HEIGHT, noteCount * MIN_PX_PER_NOTE);
}

function downloadTextFile(content: string, filename: string, mimeType: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = URL.createObjectURL(new Blob([content], { type: mimeType }));
  link.click();
  URL.revokeObjectURL(link.href);
}

export { buildPitchCsvFilename };

export function exportPitchSamplesCsv(
  samples: GraphPitchSample[],
  sessionDurationMs: number,
): void {
  if (typeof document === 'undefined') return;

  downloadTextFile(
    serializePitchSamplesCsv(samples),
    buildPitchCsvFilename(sessionDurationMs, samples),
    'text/csv;charset=utf-8',
  );
}

export function exportPitchChartPng(
  samples: GraphPitchSample[],
  sessionDurationMs: number,
  filename = 'pitch-chart.png',
  xAxisSeconds = false,
): void {
  if (typeof document === 'undefined') return;

  const pianoKeys = buildPitchChartPianoKeys();
  const chartHeight = computePlotHeight(pianoKeys.length);
  const usableHeight = chartHeight - CHART_PADDING_Y * 2;
  const totalHeight = chartHeight + AXIS_BOTTOM;

  const timelineMs = resolveTimelineMs({
    xAxisSeconds,
    mode: 'review',
    currentTimeMs: 0,
    sessionDurationMs,
  });

  const layout = buildChartLayout({
    xAxisSeconds,
    timelineMs,
    chartViewportWidth: PNG_CHART_VIEWPORT_WIDTH,
  });

  const contentWidth = layout.contentWidth;
  const totalWidth = AXIS_LEFT + contentWidth;
  const timeLabels = buildGridLabels(timelineMs, layout);

  const msToX = (ms: number) => layout.msToX(ms);
  const midiToY = (midi: number) => {
    const ratio = midiToChartAxisRatio(midi, PITCH_CHART_MIN_MIDI, PITCH_CHART_MAX_MIDI);
    return CHART_PADDING_Y + (1 - ratio) * usableHeight;
  };
  const freqToY = (freq: number) => {
    const ratio = frequencyToChartAxisRatio(freq, PITCH_CHART_MIN_MIDI, PITCH_CHART_MAX_MIDI);
    return CHART_PADDING_Y + (1 - ratio) * usableHeight;
  };

  const canvas = document.createElement('canvas');
  canvas.width = totalWidth * 2;
  canvas.height = totalHeight * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(2, 2);
  ctx.fillStyle = '#1E1B29';
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  ctx.fillStyle = '#13111C';
  ctx.fillRect(0, 0, AXIS_LEFT, chartHeight);
  ctx.fillRect(AXIS_LEFT, chartHeight, contentWidth, AXIS_BOTTOM);

  ctx.strokeStyle = '#2E2A3F';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(AXIS_LEFT, 0);
  ctx.lineTo(AXIS_LEFT, chartHeight);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, chartHeight);
  ctx.lineTo(totalWidth, chartHeight);
  ctx.stroke();

  const reversedKeys = [...pianoKeys].reverse();
  let lastLabelY = -Infinity;

  for (let i = 0; i < reversedKeys.length; i++) {
    const key = reversedKeys[i];
    const y = midiToY(key.midi);
    const isCenter = key.midi === PITCH_CHART_CENTER_MIDI;

    ctx.strokeStyle = isCenter ? '#4C4860' : '#2E2A3F';
    ctx.lineWidth = isCenter ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(AXIS_LEFT, y);
    ctx.lineTo(totalWidth, y);
    ctx.stroke();

    const showLabel = shouldShowYLabel(i, reversedKeys.length) && y - lastLabelY >= 14;
    if (!showLabel) continue;

    ctx.fillStyle = isCenter ? '#A78BFA' : '#D1C4E9';
    ctx.font = isCenter ? 'bold 13px system-ui, sans-serif' : '12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(key.name, AXIS_LEFT - 8, y);
    lastLabelY = y;
  }

  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = '#D1C4E9';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  for (const t of timeLabels) {
    const x = AXIS_LEFT + t.gridLeft;
    ctx.fillText(t.label, x, chartHeight + 22);
    ctx.strokeStyle = '#2E2A3F';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, chartHeight);
    ctx.stroke();
  }

  const pitchRuns = splitPitchRuns(samples, timelineMs);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const run of pitchRuns) {
    const points = run.map((s) => ({
      x: AXIS_LEFT + msToX(s.elapsedMs),
      y: freqToY(s.frequencyHz!),
    }));
    strokeSmoothPitchCurve(ctx, points);
  }

  ctx.fillStyle = '#FFFFFF';
  for (const run of pitchRuns) {
    for (const s of run) {
      const x = AXIS_LEFT + msToX(s.elapsedMs);
      const y = freqToY(s.frequencyHz!);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
