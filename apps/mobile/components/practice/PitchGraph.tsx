import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Text, ScrollView } from 'react-native';
import {
  buildPitchChartPianoKeys,
  frequencyToChartAxisRatio,
  isVocalFrequency,
  midiToChartAxisRatio,
  PITCH_CHART_CENTER_MIDI,
  PITCH_CHART_MAX_MIDI,
  PITCH_CHART_MIN_MIDI,
  PITCH_SAMPLE_INTERVAL_MS,
  type PianoKey,
} from '@music-app/utils';

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

export const TIME_SLOT_MS = PITCH_SAMPLE_INTERVAL_MS;
const SLOT_WIDTH = 52;
const AXIS_LEFT = 52;
const AXIS_BOTTOM = 34;
const CHART_PADDING_Y = 14;
const PLAYHEAD_VIEWPORT_RATIO = 0.35;
const IDLE_TIMELINE_MS = 3000;
const Y_LABEL_HALF_HEIGHT = 9;

function shouldShowYLabel(index: number, total: number): boolean {
  if (total <= 13) return true;
  if (total <= 20) return index % 2 === 0;
  return index % 3 === 0;
}

export default function PitchGraph({
  samples,
  currentTimeMs,
  sessionDurationMs,
  targetMelody,
  mode,
  resetKey = 0,
  height = 400,
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

  const timelineMs = useMemo(() => {
    if (mode === 'idle') return IDLE_TIMELINE_MS;
    if (mode === 'live') {
      return Math.max(TIME_SLOT_MS * 4, currentTimeMs + TIME_SLOT_MS * 2);
    }
    return Math.max(TIME_SLOT_MS * 4, sessionDurationMs + TIME_SLOT_MS);
  }, [mode, currentTimeMs, sessionDurationMs]);

  const timeSlots = Math.ceil(timelineMs / TIME_SLOT_MS) + 1;
  const chartViewportWidth = Math.max(120, viewportWidth - AXIS_LEFT);
  const naturalWidth = timeSlots * SLOT_WIDTH;
  const contentWidth = Math.max(naturalWidth, chartViewportWidth);
  const slotWidth = contentWidth / timeSlots;

  const msToX = (ms: number) => (ms / TIME_SLOT_MS) * slotWidth;

  const userPoints = useMemo(() => {
    return samples
      .filter(
        (s) =>
          s.frequencyHz != null &&
          s.frequencyHz > 0 &&
          isVocalFrequency(s.frequencyHz) &&
          s.elapsedMs <= timelineMs,
      )
      .map((sample, idx) => ({
        key: `pt-${sample.timestamp}-${idx}`,
        left: msToX(sample.elapsedMs),
        top: freqToY(sample.frequencyHz!),
      }));
  }, [samples, timelineMs, usableHeight, slotWidth]);

  const lineSegments = useMemo(() => {
    const valid = samples.filter(
      (s) =>
        s.frequencyHz != null &&
        s.frequencyHz > 0 &&
        isVocalFrequency(s.frequencyHz) &&
        s.elapsedMs <= timelineMs,
    );
    const segments: { key: string; left: number; top: number; width: number; angle: number }[] = [];

    for (let i = 1; i < valid.length; i++) {
      const prev = valid[i - 1];
      const curr = valid[i];
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

    return segments;
  }, [samples, timelineMs, usableHeight, slotWidth]);

  const playheadX = msToX(currentTimeMs);
  const isLive = mode === 'live';
  const canScroll = contentWidth > chartViewportWidth + 1;

  useEffect(() => {
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [resetKey]);

  useEffect(() => {
    if (!isLive || viewportWidth <= 0) return;
    const targetScrollX = Math.max(0, playheadX - chartViewportWidth * PLAYHEAD_VIEWPORT_RATIO);
    scrollRef.current?.scrollTo({ x: targetScrollX, animated: false });
  }, [isLive, playheadX, chartViewportWidth, viewportWidth]);

  const timeLabels = useMemo(() => {
    const labels: { key: string; left: number; label: string }[] = [];
    for (let ms = 0; ms <= timelineMs; ms += TIME_SLOT_MS) {
      labels.push({
        key: `t-${ms}`,
        left: msToX(ms),
        label: `${ms}`,
      });
    }
    return labels;
  }, [timelineMs, slotWidth]);

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
                <View key={`vgrid-${t.key}`} style={[styles.vertGrid, { left: t.left }]} />
              ))}

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
                <Text key={t.key} style={[styles.xLabel, { left: t.left, width: slotWidth }]}>
                  {t.label}ms
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
