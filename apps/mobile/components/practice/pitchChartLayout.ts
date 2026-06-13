import { PITCH_SAMPLE_INTERVAL_MS } from '@music-app/utils';

export const TIME_SLOT_MS = PITCH_SAMPLE_INTERVAL_MS;
export const SLOT_WIDTH_MS = 52;
export const MS_PER_SECOND = 1000;
export const SECONDS_MODE_SPAN = 12;
export const SECONDS_MODE_MIN_MS = SECONDS_MODE_SPAN * MS_PER_SECOND;
export const IDLE_TIMELINE_MS = 3000;

export type ChartLayout = {
  contentWidth: number;
  msToX: (ms: number) => number;
  labelWidth: number;
  gridStepMs: number;
  formatGridLabel: (ms: number) => string;
  formatAxisLabel: (ms: number) => string;
};

export function resolveTimelineMs(options: {
  xAxisSeconds: boolean;
  mode: 'live' | 'review' | 'idle';
  currentTimeMs: number;
  sessionDurationMs: number;
}): number {
  const { xAxisSeconds, mode, currentTimeMs, sessionDurationMs } = options;

  if (xAxisSeconds) {
    if (mode === 'idle') return SECONDS_MODE_MIN_MS;
    if (mode === 'live') {
      return Math.max(SECONDS_MODE_MIN_MS, currentTimeMs + TIME_SLOT_MS * 2);
    }
    return Math.max(SECONDS_MODE_MIN_MS, sessionDurationMs + TIME_SLOT_MS);
  }

  if (mode === 'idle') return IDLE_TIMELINE_MS;
  if (mode === 'live') {
    return Math.max(TIME_SLOT_MS * 4, currentTimeMs + TIME_SLOT_MS * 2);
  }
  return Math.max(TIME_SLOT_MS * 4, sessionDurationMs + TIME_SLOT_MS);
}

export function buildChartLayout(options: {
  xAxisSeconds: boolean;
  timelineMs: number;
  chartViewportWidth: number;
}): ChartLayout {
  const { xAxisSeconds, timelineMs, chartViewportWidth } = options;

  if (xAxisSeconds) {
    const pixelsPerSecond = chartViewportWidth / SECONDS_MODE_SPAN;
    const msToX = (ms: number) => (ms / MS_PER_SECOND) * pixelsPerSecond;
    const contentWidth = Math.max(msToX(timelineMs), chartViewportWidth);

    return {
      contentWidth,
      msToX,
      labelWidth: pixelsPerSecond,
      gridStepMs: MS_PER_SECOND,
      formatGridLabel: (ms) => `${ms / MS_PER_SECOND}s`,
      formatAxisLabel: (ms) => `${ms / MS_PER_SECOND}s`,
    };
  }

  const timeSlots = Math.ceil(timelineMs / TIME_SLOT_MS) + 1;
  const naturalWidth = timeSlots * SLOT_WIDTH_MS;
  const contentWidth = Math.max(naturalWidth, chartViewportWidth);
  const slotWidth = contentWidth / timeSlots;
  const msToX = (ms: number) => (ms / TIME_SLOT_MS) * slotWidth;

  return {
    contentWidth,
    msToX,
    labelWidth: slotWidth,
    gridStepMs: TIME_SLOT_MS,
    formatGridLabel: (ms) => `${ms}ms`,
    formatAxisLabel: (ms) => `${ms}ms`,
  };
}

export function buildGridLabels(
  timelineMs: number,
  layout: ChartLayout,
): { key: string; gridLeft: number; left: number; label: string; width: number }[] {
  const labels: { key: string; gridLeft: number; left: number; label: string; width: number }[] = [];

  for (let ms = 0; ms <= timelineMs; ms += layout.gridStepMs) {
    const gridLeft = layout.msToX(ms);
    labels.push({
      key: `t-${ms}`,
      gridLeft,
      left: Math.max(0, gridLeft - layout.labelWidth / 2),
      label: layout.formatGridLabel(ms),
      width: layout.labelWidth,
    });
  }

  return labels;
}
