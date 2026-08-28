import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';

export type MelodyNote = {
  note: string;
  start: number; // start time in ms
  end: number;   // end time in ms
};

export type GraphPitchSample = {
  timestamp: number;
  elapsedMs: number;
  frequencyHz: number | null;
  clarity: number;
  note: string | null;
  cents: number | null;
};

type PitchGraphProps = {
  samples: GraphPitchSample[];
  currentTimeMs: number;
  durationMs: number;
  targetMelody: MelodyNote[];
  isPlaying: boolean;
  height?: number;
};

export const NOTE_SEMITONES: Record<string, number> = {
  'S': 0,
  'R': 2,
  'G': 4,
  'P': 7,
  'D': 9,
  'Ṡ': 12,
};

export const NOTE_FREQS: Record<string, number> = {
  'S': 261.63,
  'R': 293.66,
  'G': 329.63,
  'P': 392.00,
  'D': 440.00,
  'Ṡ': 523.25,
};

const NOTE_SCALE = ['Ṡ', 'D', 'P', 'G', 'R', 'S'];

export default function PitchGraph({
  samples,
  currentTimeMs,
  durationMs = 12000,
  targetMelody,
  isPlaying,
  height = 240,
}: PitchGraphProps) {
  const [containerWidth, setContainerWidth] = useState(320);
  const paddingY = 24;
  const usableHeight = height - paddingY * 2;

  // Helper to map semitones to Y position
  const getTopBySemitone = (semitones: number) => {
    const ratio = semitones / 12; // 0 to 1 range
    return paddingY + (1 - ratio) * usableHeight;
  };

  // Helper to map frequency to semitones with target octave folding
  const getFoldedSemitones = (freq: number, targetNoteName: string | undefined) => {
    const targetFreq = targetNoteName ? NOTE_FREQS[targetNoteName] : 261.63;
    // Find octave offset k to shift freq closest to targetFreq
    const k = Math.round(Math.log2(targetFreq / freq));
    const shiftedFreq = freq * Math.pow(2, k);
    // Calculate semitones relative to C4 (Sa)
    return 12 * Math.log2(shiftedFreq / 261.63);
  };

  // Pre-calculate target note positions
  const referenceBlocks = useMemo(() => {
    return targetMelody.map((item, idx) => {
      const xStart = (item.start / durationMs) * containerWidth;
      const xEnd = (item.end / durationMs) * containerWidth;
      const blockWidth = Math.max(12, xEnd - xStart);
      const semitone = NOTE_SEMITONES[item.note] ?? 0;
      const top = getTopBySemitone(semitone) - 10; // offset half block height
      return {
        key: `${item.note}-${item.start}-${idx}`,
        note: item.note,
        left: xStart,
        width: blockWidth,
        top,
      };
    });
  }, [targetMelody, durationMs, containerWidth, usableHeight]);

  // Pre-calculate user pitch points
  const userPoints = useMemo(() => {
    return samples
      .filter((s) => s.frequencyHz != null && s.frequencyHz > 0 && s.elapsedMs <= durationMs)
      .map((sample, idx) => {
        const x = (sample.elapsedMs / durationMs) * containerWidth;
        
        // Find what the target note was at this elapsed time
        const activeTarget = targetMelody.find(
          (t) => sample.elapsedMs >= t.start && sample.elapsedMs <= t.end
        );
        
        const semitones = getFoldedSemitones(sample.frequencyHz!, activeTarget?.note);
        const y = getTopBySemitone(Math.max(0, Math.min(12, semitones)));

        return {
          key: `user-pt-${sample.timestamp}-${idx}`,
          left: x,
          top: y,
        };
      });
  }, [samples, durationMs, containerWidth, targetMelody, usableHeight]);

  // Calculate current playhead position
  const playheadX = (currentTimeMs / durationMs) * containerWidth;

  return (
    <View
      style={[styles.graphWrapper, { height }]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0) setContainerWidth(w);
      }}
    >
      {/* Background Grid Lines */}
      {NOTE_SCALE.map((note) => {
        const semitone = NOTE_SEMITONES[note];
        const top = getTopBySemitone(semitone);
        return (
          <View key={`grid-${note}`} style={[styles.gridRow, { top }]}>
            <Text style={styles.gridLabel}>{note}</Text>
            <View style={styles.gridLine} />
          </View>
        );
      })}

      {/* Target reference melody blocks (orange pills) */}
      {referenceBlocks.map((block) => (
        <View
          key={block.key}
          style={[
            styles.targetBlock,
            {
              left: block.left,
              width: block.width,
              top: block.top,
            },
          ]}
        >
          <Text style={styles.targetLabel}>{block.note}</Text>
        </View>
      ))}

      {/* User's voice pitch path (white glowing dots) */}
      {userPoints.map((pt) => (
        <View
          key={pt.key}
          style={[
            styles.userPoint,
            {
              left: pt.left - 2,
              top: pt.top - 2,
            },
          ]}
        />
      ))}

      {/* Playhead line (sweeping cursor) */}
      {isPlaying && playheadX >= 0 && playheadX <= containerWidth ? (
        <View style={[styles.playhead, { left: playheadX }]}>
          <View style={styles.playheadTip} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  graphWrapper: {
    width: '100%',
    backgroundColor: '#1E1B29', // deep dark violet
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#2E2A3F',
  },
  gridRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: 1,
  },
  gridLabel: {
    color: '#D1C4E9',
    fontSize: 12,
    fontWeight: '700',
    width: 28,
    textAlign: 'center',
    position: 'absolute',
    left: 8,
    zIndex: 5,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  gridLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2E2A3F',
    marginLeft: 36,
  },
  targetBlock: {
    position: 'absolute',
    height: 20,
    backgroundColor: '#F59E0B', // golden orange
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#FFF3D4',
  },
  targetLabel: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  userPoint: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 2,
    zIndex: 10,
  },
  playhead: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#A78BFA', // violet playhead
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
    shadowColor: '#A78BFA',
    shadowOpacity: 0.8,
    shadowRadius: 3,
  },
});
