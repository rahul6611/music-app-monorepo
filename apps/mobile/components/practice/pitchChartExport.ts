import {
  buildPianoRangeForSamples,
  frequencyToAxisRatio,
  isVocalFrequency,
  PITCH_CHART_CENTER_MIDI,
} from '@music-app/utils';
import type { GraphPitchSample } from './PitchGraph';
import { TIME_SLOT_MS } from './PitchGraph';

const SLOT_WIDTH = 52;
const AXIS_LEFT = 56;
const AXIS_BOTTOM = 34;
const CHART_PADDING_Y = 14;
const PIANO_SEMITONES_BELOW = 5;
const PIANO_SEMITONES_ABOVE = 10;
const MIN_PX_PER_NOTE = 22;
const MIN_CHART_PLOT_HEIGHT = 366;

function shouldShowYLabel(index: number, total: number): boolean {
  if (total <= 13) return true;
  if (total <= 20) return index % 2 === 0;
  return index % 3 === 0;
}

function computePlotHeight(noteCount: number): number {
  return Math.max(MIN_CHART_PLOT_HEIGHT, noteCount * MIN_PX_PER_NOTE);
}

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value == null || value === '') return '';
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadTextFile(content: string, filename: string, mimeType: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = URL.createObjectURL(new Blob([content], { type: mimeType }));
  link.click();
  URL.revokeObjectURL(link.href);
}

function formatCsvFrequency(hz: number | null): string {
  if (hz == null || hz <= 0) return '';
  return hz.toFixed(1);
}

function formatCsvConfidence(clarity: number): string {
  return String(Math.round(clarity * 100));
}

export function buildPitchCsvFilename(
  sessionDurationMs: number,
  samples: GraphPitchSample[] = [],
): string {
  const durationMs =
    sessionDurationMs > 0
      ? sessionDurationMs
      : samples[samples.length - 1]?.elapsedMs ?? 0;
  const durationSec = Math.max(0, Math.round(durationMs / 1000));
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `pitch-samples-${durationSec}s-${stamp}.csv`;
}

export function exportPitchSamplesCsv(
  samples: GraphPitchSample[],
  sessionDurationMs: number,
): void {
  if (typeof document === 'undefined') return;

  const header = 'Time (ms),Time (s),Frequency (Hz),Note,Cents,Confidence (%)';
  const rows = samples.map((sample) => {
    const timeMs = Math.max(0, Math.round(sample.elapsedMs));
    const timeSec = (timeMs / 1000).toFixed(2);
    return [
      timeMs,
      timeSec,
      formatCsvFrequency(sample.frequencyHz),
      sample.note ?? '',
      sample.cents != null ? Math.round(sample.cents) : '',
      formatCsvConfidence(sample.clarity),
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  const csvBody = [header, ...rows].join('\r\n');
  downloadTextFile(
    `\uFEFF${csvBody}`,
    buildPitchCsvFilename(sessionDurationMs, samples),
    'text/csv;charset=utf-8',
  );
}

export function exportPitchChartPng(
  samples: GraphPitchSample[],
  sessionDurationMs: number,
  filename = 'pitch-chart.png',
): void {
  if (typeof document === 'undefined') return;

  const sampleHz = samples
    .map((s) => s.frequencyHz)
    .filter((hz): hz is number => hz != null && hz > 0 && isVocalFrequency(hz));

  const pianoKeys = buildPianoRangeForSamples(
    sampleHz,
    PITCH_CHART_CENTER_MIDI,
    PIANO_SEMITONES_BELOW,
    PIANO_SEMITONES_ABOVE,
    2,
  );

  const minHz = pianoKeys[0].frequencyHz;
  const maxHz = pianoKeys[pianoKeys.length - 1].frequencyHz;
  const chartHeight = computePlotHeight(pianoKeys.length);
  const usableHeight = chartHeight - CHART_PADDING_Y * 2;
  const totalHeight = chartHeight + AXIS_BOTTOM;

  const timelineMs = Math.max(TIME_SLOT_MS * 4, sessionDurationMs + TIME_SLOT_MS);
  const timeSlots = Math.ceil(timelineMs / TIME_SLOT_MS) + 1;
  const contentWidth = timeSlots * SLOT_WIDTH + 16;
  const totalWidth = AXIS_LEFT + contentWidth;

  const msToX = (ms: number) => (ms / TIME_SLOT_MS) * SLOT_WIDTH;
  const freqToY = (freq: number) => {
    const ratio = frequencyToAxisRatio(freq, minHz, maxHz);
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
    const y = freqToY(key.frequencyHz);
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
  for (let ms = 0; ms <= timelineMs; ms += TIME_SLOT_MS) {
    const x = AXIS_LEFT + msToX(ms);
    ctx.fillText(`${ms}ms`, x + SLOT_WIDTH / 2, chartHeight + 22);
    ctx.strokeStyle = '#2E2A3F';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, chartHeight);
    ctx.stroke();
  }

  const valid = samples.filter(
    (s) => s.frequencyHz != null && s.frequencyHz > 0 && isVocalFrequency(s.frequencyHz),
  );
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  valid.forEach((s, i) => {
    const x = AXIS_LEFT + msToX(s.elapsedMs);
    const y = freqToY(s.frequencyHz!);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  if (valid.length > 0) ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  for (const s of valid) {
    const x = AXIS_LEFT + msToX(s.elapsedMs);
    const y = freqToY(s.frequencyHz!);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
