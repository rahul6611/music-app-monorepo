import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  buildPitchPlaybackSchedule,
  parsePitchCsv,
  summarizePitchCsvRows,
  type PitchCsvRow,
} from '@music-app/utils';
import { PitchFrequencyPlayer } from '../../utils/pitchFrequencyPlayer';
import type { GraphPitchSample } from './PitchGraph';

type PitchCsvReplayerProps = {
  sessionSamples?: GraphPitchSample[] | null;
  onStatus?: (message: string | null) => void;
};

function rowsFromSession(samples: GraphPitchSample[]): PitchCsvRow[] {
  return samples.map((sample) => ({
    elapsedMs: Math.max(0, Math.round(sample.elapsedMs)),
    frequencyHz:
      sample.frequencyHz != null && sample.frequencyHz > 0 ? sample.frequencyHz : null,
  }));
}

export default function PitchCsvReplayer({ sessionSamples, onStatus }: PitchCsvReplayerProps) {
  const [rows, setRows] = useState<PitchCsvRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playerRef = useRef(new PitchFrequencyPlayer());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const summary = useMemo(() => summarizePitchCsvRows(rows), [rows]);
  const schedule = useMemo(() => buildPitchPlaybackSchedule(rows), [rows]);

  const loadRows = useCallback((nextRows: PitchCsvRow[], sourceLabel: string) => {
    setRows(nextRows);
    setFileName(sourceLabel);
    setError(null);
    const nextSummary = summarizePitchCsvRows(nextRows);
    if (nextSummary.pitchedCount === 0) {
      setError('No frequency (Hz) values found in this file.');
    }
  }, []);

  useEffect(() => {
    if (!sessionSamples?.length) return;
    loadRows(rowsFromSession(sessionSamples), 'Current session');
  }, [sessionSamples, loadRows]);

  useEffect(() => () => {
    playerRef.current.stop();
  }, []);

  const handlePickFile = useCallback(() => {
    if (Platform.OS !== 'web') {
      onStatus?.('CSV replay is available on web.');
      return;
    }
    fileInputRef.current?.click();
  }, [onStatus]);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;

      try {
        const text = await file.text();
        const parsed = parsePitchCsv(text);
        loadRows(parsed, file.name);
        onStatus?.(`Loaded ${file.name}`);
      } catch (err: any) {
        setRows([]);
        setFileName(null);
        setError(err?.message ?? 'Could not parse CSV.');
      }
    },
    [loadRows, onStatus],
  );

  const handlePlay = useCallback(async () => {
    if (Platform.OS !== 'web') {
      onStatus?.('CSV replay is available on web.');
      return;
    }
    if (schedule.length === 0) {
      setError('Load a CSV with Frequency (Hz) values first.');
      return;
    }

    setError(null);
    try {
      setIsPlaying(true);
      await playerRef.current.play(schedule, {
        waveform: 'triangle',
        onEnded: () => setIsPlaying(false),
      });
      onStatus?.('Playing captured frequencies…');
    } catch (err: any) {
      setIsPlaying(false);
      setError(err?.message ?? 'Playback failed.');
    }
  }, [onStatus, schedule]);

  const handleStop = useCallback(() => {
    playerRef.current.stop();
    setIsPlaying(false);
    onStatus?.('Playback stopped.');
  }, [onStatus]);

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.sectionBox}>
        <Text style={styles.sectionLabel}>3. Replay frequencies (CSV)</Text>
        <Text style={styles.hint}>Upload a pitch CSV and hear the captured Hz on web.</Text>
      </View>
    );
  }

  return (
    <View style={styles.sectionBox}>
      <Text style={styles.sectionLabel}>3. Replay frequencies (CSV)</Text>
      {/* <Text style={styles.hint}>
        Plays back the Hz values from your capture (not the Note column). Use this to check if
        pitch detection matches what you heard.
      </Text> */}

      {Platform.OS === 'web' ? (
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange as any}
          style={{ display: 'none' }}
        />
      ) : null}

      <View style={styles.controlsRow}>
        <TouchableOpacity style={styles.uploadBtn} onPress={handlePickFile}>
          <MaterialIcons name="upload-file" size={16} color="#C084FC" />
          <Text style={styles.uploadBtnText}>Upload CSV</Text>
        </TouchableOpacity>

        {!isPlaying ? (
          <TouchableOpacity
            style={[styles.playBtn, schedule.length === 0 && styles.playBtnDisabled]}
            onPress={handlePlay}
            disabled={schedule.length === 0}
          >
            <MaterialIcons name="play-arrow" size={18} color="#FFFFFF" />
            <Text style={styles.playBtnText}>Play Hz</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.stopBtn} onPress={handleStop}>
            <MaterialIcons name="stop" size={18} color="#FFFFFF" />
            <Text style={styles.playBtnText}>Stop</Text>
          </TouchableOpacity>
        )}
      </View>

      {fileName ? (
        <Text style={styles.metaText}>
          {fileName} — {summary.pitchedCount}/{summary.rowCount} rows with Hz,{' '}
          {(summary.durationMs / 1000).toFixed(1)}s
        </Text>
      ) : (
        <Text style={styles.metaText}>No file loaded yet.</Text>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionBox: {
    backgroundColor: '#1E1B29',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2E2A3F',
    padding: 16,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#D1C4E9',
    letterSpacing: 0.5,
  },
  hint: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 18,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A78BFA',
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
  },
  uploadBtnText: {
    color: '#C084FC',
    fontSize: 12,
    fontWeight: '700',
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#7C3AED',
  },
  playBtnDisabled: {
    opacity: 0.45,
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#DC2626',
  },
  playBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  metaText: {
    color: '#D1C4E9',
    fontSize: 12,
  },
  errorText: {
    color: '#F87171',
    fontSize: 12,
  },
});
