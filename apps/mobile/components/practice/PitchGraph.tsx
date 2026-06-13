import React, { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Text, ScrollView, Platform } from 'react-native';
import {
  buildPitchChartPianoKeys,
  frequencyToChartAxisRatio,
  midiToChartAxisRatio,
  PITCH_CHART_CENTER_MIDI,
  PITCH_CHART_MAX_MIDI,
  PITCH_CHART_MIN_MIDI,
  type PianoKey,
} from '@music-app/utils';
import { buildSmoothPitchPath, splitPitchRuns } from './pitchGraphPath';
import {
  buildChartLayout,
  buildGridLabels,
  resolveTimelineMs,
  TIME_SLOT_MS,
} from './pitchChartLayout';

export type MelodyNote = {
  note: string;
  start: number;
  end: number;
};

export type GraphPitchSample = {
  timestamp: number;
  elapsedMs: number;
  frequencyHz: number | null;
  clarity: number;
  note: string | null;
  cents: number | null;
};

export type PitchGraphMode = 'live' | 'review' | 'idle';

type PitchGraphProps = {
  samples: GraphPitchSample[];
  currentTimeMs: number;
  sessionDurationMs: number;
  targetMelody: MelodyNote[];
  mode: PitchGraphMode;
  resetKey?: number;
  height?: number;
  /** When true: 1s grid labels and 12s viewport scale. */
  xAxisSeconds?: boolean;
};

/** Bhupali scale (C4 tonic). */
export const NOTE_FREQS: Record<string, number> = {
  S: 261.63,
  R: 293.66,
  G: 329.63,
  P: 392.0,
  D: 440.0,
  Ṡ: 523.25,
};

export { TIME_SLOT_MS } from './pitchChartLayout';
const AXIS_LEFT = 52;
const AXIS_BOTTOM = 34;
const CHART_PADDING_Y = 14;
const PLAYHEAD_VIEWPORT_RATIO = 0.35;
const Y_LABEL_HALF_HEIGHT = 9;

function shouldShowYLabel(index: number, total: number): boolean {
  if (total <= 13) return true;
  if (total <= 20) return index % 2 === 0;
  return index % 3 === 0;
}

function PitchCurves({
  paths,
  width,
  height,
}: {
  paths: string[];
  width: number;
  height: number;
}) {
  if (Platform.OS !== 'web' || paths.length === 0) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width,
        height,
        zIndex: 8,
      }}
    >
      {createElement(
        'svg',
        {
          width,
          height,
        },
        paths.map((pathD, index) =>
          createElement('path', {
            key: `curve-${index}`,
            d: pathD,
            fill: 'none',
            stroke: 'rgba(255,255,255,0.85)',
            strokeWidth: 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          }),
        ),
      )}
    </View>
  );
}

export default function PitchGraph({
  samples,
  currentTimeMs,
  sessionDurationMs,
  targetMelody,
  mode,
  resetKey = 0,
  height = 400,
  xAxisSeconds = true,
}: PitchGraphProps) {
  const [viewportWidth, setViewportWidth] = useState(320);
  const scrollRef = useRef<ScrollView>(null);

  const pianoKeys = useMemo(() => buildPitchChartPianoKeys(), []);

  const chartHeight = height - AXIS_BOTTOM;
  const usableHeight = chartHeight - CHART_PADDING_Y * 2;

  const midiToY = (midi: number) => {
    const ratio = midiToChartAxisRatio(midi, PITCH_CHART_MIN_MIDI, PITCH_CHART_MAX_MIDI);
    return CHART_PADDING_Y + (1 - ratio) * usableHeight;
  };

  const freqToY = (freq: number) => {
    const ratio = frequencyToChartAxisRatio(
      freq,
      PITCH_CHART_MIN_MIDI,
      PITCH_CHART_MAX_MIDI,
    );
    return CHART_PADDING_Y + (1 - ratio) * usableHeight;
  };

  const timelineMs = useMemo(
    () =>
      resolveTimelineMs({
        xAxisSeconds,
        mode,
        currentTimeMs,
        sessionDurationMs,
      }),
    [mode, currentTimeMs, sessionDurationMs, xAxisSeconds],
  );

  const chartViewportWidth = Math.max(120, viewportWidth - AXIS_LEFT);

  const layout = useMemo(
    () =>
      buildChartLayout({
        xAxisSeconds,
        timelineMs,
        chartViewportWidth,
      }),
    [xAxisSeconds, timelineMs, chartViewportWidth],
  );

  const { contentWidth, msToX } = layout;

  const pitchRuns = useMemo(
    () => splitPitchRuns(samples, timelineMs),
    [samples, timelineMs],
  );

  const userPoints = useMemo(
    () =>
      pitchRuns.flatMap((run, runIdx) =>
        run.map((sample, idx) => ({
          key: `pt-${runIdx}-${sample.timestamp}-${idx}`,
          left: msToX(sample.elapsedMs),
          top: freqToY(sample.frequencyHz!),
        })),
      ),
    [pitchRuns, msToX, usableHeight],
  );

  const smoothPaths = useMemo(
    () =>
      pitchRuns
        .map((run) =>
          buildSmoothPitchPath(
            run.map((s) => ({
              x: msToX(s.elapsedMs),
              y: freqToY(s.frequencyHz!),
            })),
          ),
        )
        .filter((path) => path.length > 0),
    [pitchRuns, msToX, usableHeight],
  );

  const lineSegments = useMemo(() => {
    if (Platform.OS === 'web') return [];

    const segments: { key: string; left: number; top: number; width: number; angle: number }[] = [];

    for (const run of pitchRuns) {
      for (let i = 1; i < run.length; i++) {
        const prev = run[i - 1];
        const curr = run[i];
        const x1 = msToX(prev.elapsedMs);
        const y1 = freqToY(prev.frequencyHz!);
        const x2 = msToX(curr.elapsedMs);
        const y2 = freqToY(curr.frequencyHz!);
        const dx = x2 - x1;
        const dy = y2 - y1;
        const width = Math.sqrt(dx * dx + dy * dy);
        if (width < 1) continue;
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        segments.push({
          key: `seg-${prev.timestamp}-${curr.timestamp}`,
          left: (x1 + x2) / 2 - width / 2,
          top: (y1 + y2) / 2,
          width,
          angle,
        });
      }
    }

    return segments;
  }, [pitchRuns, msToX, usableHeight]);

  const playheadX = msToX(currentTimeMs);
  const isLive = mode === 'live';
  const canScroll = contentWidth > chartViewportWidth + 1;

  useEffect(() => {
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [resetKey, xAxisSeconds]);

  useEffect(() => {
    if (!isLive || viewportWidth <= 0) return;
    const targetScrollX = Math.max(0, playheadX - chartViewportWidth * PLAYHEAD_VIEWPORT_RATIO);
    scrollRef.current?.scrollTo({ x: targetScrollX, animated: false });
  }, [isLive, playheadX, chartViewportWidth, viewportWidth]);

  const timeLabels = useMemo(
    () => buildGridLabels(timelineMs, layout),
    [timelineMs, layout],
  );

  const reversedKeys = [...pianoKeys].reverse();

  const visibleYLabels = useMemo(() => {
    let lastY = -Infinity;
    const labels: { key: PianoKey; y: number }[] = [];
    reversedKeys.forEach((key, index) => {
      if (!shouldShowYLabel(index, reversedKeys.length)) return;
      const y = midiToY(key.midi);
      if (y - lastY < 14) return;
      lastY = y;
      labels.push({ key, y });
    });
    return labels;
  }, [reversedKeys, usableHeight]);

  return (
    <View
      style={[styles.wrapper, { height }]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0) setViewportWidth(w);
      }}
    >
      <View style={styles.bodyRow}>
        <View style={[styles.yAxis, { height: chartHeight }]}>
          {visibleYLabels.map(({ key, y }) => {
            const isCenter = key.midi === PITCH_CHART_CENTER_MIDI;
            return (
              <Text
                key={key.name}
                style={[
                  styles.yLabel,
                  { top: y - Y_LABEL_HALF_HEIGHT },
                  isCenter && styles.yLabelCenter,
                ]}
              >
                {key.name}
              </Text>
            );
          })}
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={mode === 'review' && canScroll}
          scrollEnabled={mode !== 'live' && canScroll}
          style={styles.chartColumn}
          contentContainerStyle={{ width: contentWidth, flexGrow: canScroll ? 0 : 1 }}
        >
          <View style={{ width: contentWidth, flex: 1 }}>
            <View style={[styles.chartArea, { width: contentWidth, height: chartHeight }]}>
              {pianoKeys.map((key) => {
                const y = midiToY(key.midi);
                const isCenter = key.midi === PITCH_CHART_CENTER_MIDI;
                return (
                  <View
                    key={`grid-${key.name}`}
                    style={[styles.horizGrid, { top: y }, isCenter && styles.horizGridCenter]}
                  />
                );
              })}

              {timeLabels.map((t) => (
                <View key={`vgrid-${t.key}`} style={[styles.vertGrid, { left: t.gridLeft }]} />
              ))}

              <PitchCurves paths={smoothPaths} width={contentWidth} height={chartHeight} />

              {lineSegments.map((seg) => (
                <View
                  key={seg.key}
                  style={[
                    styles.pitchLine,
                    {
                      left: seg.left,
                      top: seg.top,
                      width: seg.width,
                      transform: [{ rotate: `${seg.angle}deg` }],
                    },
                  ]}
                />
              ))}

              {userPoints.map((pt) => (
                <View
                  key={pt.key}
                  style={[styles.userPoint, { left: pt.left - 4, top: pt.top - 4 }]}
                />
              ))}

              {isLive ? (
                <View style={[styles.playhead, { left: playheadX }]}>
                  <View style={styles.playheadTip} />
                </View>
              ) : null}
            </View>

            <View style={[styles.xAxis, { width: contentWidth }]}>
              {timeLabels.map((t) => (
                <Text key={t.key} style={[styles.xLabel, { left: t.left, width: t.width }]}>
                  {t.label}
                </Text>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2E2A3F',
    backgroundColor: '#1E1B29',
  },
  bodyRow: {
    flexDirection: 'row',
    flex: 1,
  },
  yAxis: {
    width: AXIS_LEFT,
    borderRightWidth: 1,
    borderRightColor: '#2E2A3F',
    backgroundColor: '#13111C',
    position: 'relative',
  },
  yLabel: {
    position: 'absolute',
    left: 4,
    width: AXIS_LEFT - 8,
    color: '#D1C4E9',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    lineHeight: 18,
    includeFontPadding: false,
  },
  yLabelCenter: {
    color: '#A78BFA',
    fontWeight: '800',
    fontSize: 13,
  },
  chartColumn: {
    flex: 1,
    width: '100%',
  },
  chartArea: {
    position: 'relative',
    backgroundColor: '#1E1B29',
  },
  horizGrid: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#2E2A3F',
  },
  horizGridCenter: {
    backgroundColor: '#4C4860',
    height: 2,
  },
  vertGrid: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#2E2A3F',
  },
  xAxis: {
    height: AXIS_BOTTOM,
    position: 'relative',
    backgroundColor: '#13111C',
    borderTopWidth: 1,
    borderTopColor: '#2E2A3F',
  },
  xLabel: {
    position: 'absolute',
    top: 8,
    color: '#D1C4E9',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  pitchLine: {
    position: 'absolute',
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.85)',
    zIndex: 8,
  },
  userPoint: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A78BFA',
    zIndex: 10,
  },
  playhead: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#A78BFA',
    zIndex: 15,
  },
  playheadTip: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#A78BFA',
    position: 'absolute',
    top: 0,
    left: -3,
  },
});
