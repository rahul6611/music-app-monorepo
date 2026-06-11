import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@music-app/store';
import {
  compareToTargetFrequency,
  updateStablePitchReadout,
  westernNoteToSwara,
  type PitchSession,
  type StablePitchReadout,
} from '@music-app/utils';
import { usePitchAnalyzer } from '../../hooks/usePitchAnalyzer';
import PitchGraph, { NOTE_FREQS, type GraphPitchSample, type MelodyNote, type PitchGraphMode } from './PitchGraph';
import { exportPitchChartPng, exportPitchSamplesCsv } from './pitchChartExport';

const SESSIONS_KEY = 'pitch-practice-sessions';

type ExerciseConfig = {
  name: string;
  notes: MelodyNote[];
  duration: number;
};

const MELODIES: Record<string, ExerciseConfig> = {
  bhupali_asc: {
    name: 'Bhupali Ascending (S R G P D Ṡ)',
    notes: [
      { note: 'S', start: 0, end: 2000 },
      { note: 'R', start: 2000, end: 4000 },
      { note: 'G', start: 4000, end: 6000 },
      { note: 'P', start: 6000, end: 8000 },
      { note: 'D', start: 8000, end: 10000 },
      { note: 'Ṡ', start: 10000, end: 12000 },
    ],
    duration: 12000,
  },
  bhupali_desc: {
    name: 'Bhupali Descending (Ṡ D P G R S)',
    notes: [
      { note: 'Ṡ', start: 0, end: 2000 },
      { note: 'D', start: 2000, end: 4000 },
      { note: 'P', start: 4000, end: 6000 },
      { note: 'G', start: 6000, end: 8000 },
      { note: 'R', start: 8000, end: 10000 },
      { note: 'S', start: 10000, end: 12000 },
    ],
    duration: 12000,
  },
  bhupali_loop: {
    name: 'Bhupali Full Cycle (Sa-Re-Ga-Pa-Dha-Sa-Sa...)',
    notes: [
      { note: 'S', start: 0, end: 2000 },
      { note: 'R', start: 2000, end: 4000 },
      { note: 'G', start: 4000, end: 6000 },
      { note: 'P', start: 6000, end: 8000 },
      { note: 'D', start: 8000, end: 10000 },
      { note: 'Ṡ', start: 10000, end: 12000 },
      { note: 'Ṡ', start: 12000, end: 14000 },
      { note: 'D', start: 14000, end: 16000 },
      { note: 'P', start: 16000, end: 18000 },
      { note: 'G', start: 18000, end: 20000 },
      { note: 'R', start: 20000, end: 22000 },
      { note: 'S', start: 22000, end: 24000 },
    ],
    duration: 24000,
  },
};

const PITCH_DEBUG_LOG = __DEV__;
const PITCH_DEBUG_LOG_INTERVAL_MS = 500;

export default function PitchMonitor() {
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const isWide = windowWidth > 900;

  const activeMelody = MELODIES.bhupali_asc;

  const [listening, setListening] = useState(false);
  const [savedSessions, setSavedSessions] = useState<(PitchSession & { melodyName?: string; accuracy?: number })[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  // Time tracker for playhead progress
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState(0);

  const [sessionAnchorMs, setSessionAnchorMs] = useState<number | null>(null);
  const [reviewSession, setReviewSession] = useState<{
    samples: GraphPitchSample[];
    durationMs: number;
  } | null>(null);
  const [chartResetKey, setChartResetKey] = useState(0);

  const { isListening, error, currentSample, history, sampleRate, getSavedSamples, openAppSettings } =
    usePitchAnalyzer({ enabled: listening, historySize: 2000 });

  // Anchor timeline to when the mic is actually live (not the button press)
  useEffect(() => {
    if (listening && isListening && sessionAnchorMs == null) {
      setSessionAnchorMs(Date.now());
    }
    if (!listening) {
      setSessionAnchorMs(null);
    }
  }, [listening, isListening, sessionAnchorMs]);

  const [stableReadout, setStableReadout] = useState<StablePitchReadout | null>(null);
  const stableReadoutRef = useRef<StablePitchReadout | null>(null);
  const lastTargetNoteRef = useRef<string | null>(null);

  // Web Audio Context for playing reference notes
  const activeOscillatorsRef = useRef<any[]>([]);
  const [isPlayingReference, setIsPlayingReference] = useState(false);

  const activeMelodyRef = useRef(activeMelody);
  useEffect(() => {
    activeMelodyRef.current = activeMelody;
  }, [activeMelody]);

  // Helper to play reference notes synthetically on Web
  const stopReferenceAudio = useCallback(() => {
    activeOscillatorsRef.current.forEach((osc) => {
      try {
        osc.stop();
      } catch {}
    });
    activeOscillatorsRef.current = [];
    setIsPlayingReference(false);
  }, []);

  const playReferenceAudio = useCallback(() => {
    if (isPlayingReference) {
      stopReferenceAudio();
      return;
    }

    if (Platform.OS !== 'web') {
      setStatus('Melody play only works on web.');
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      setIsPlayingReference(true);
      const now = ctx.currentTime;
      const oscs: any[] = [];

      activeMelody.notes.forEach((note) => {
        const freq = NOTE_FREQS[note.note];
        if (!freq) return;

        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        // Smooth volume curves to prevent clicks
        gainNode.gain.setValueAtTime(0, now + note.start / 1000);
        gainNode.gain.linearRampToValueAtTime(0.25, now + note.start / 1000 + 0.05);
        gainNode.gain.setValueAtTime(0.25, now + note.end / 1000 - 0.05);
        gainNode.gain.linearRampToValueAtTime(0, now + note.end / 1000);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now + note.start / 1000);
        osc.stop(now + note.end / 1000);

        oscs.push(osc);
      });

      activeOscillatorsRef.current = oscs;

      setTimeout(() => {
        setIsPlayingReference(false);
      }, activeMelody.duration);
    } catch (err) {
      console.error('Failed playing audio tones', err);
    }
  }, [activeMelody, isPlayingReference, stopReferenceAudio]);

  const handleStopAndSave = useCallback(async (finalDuration: number) => {
    const samples = getSavedSamples();
    const anchor = sessionAnchorMs ?? samples[0]?.timestamp ?? null;
    setListening(false);

    if (samples.length > 0 && anchor != null) {
      const mappedSamples = samples.map((s) => ({
        ...s,
        elapsedMs: Math.max(0, s.timestamp - anchor),
      }));

      setReviewSession({
        samples: mappedSamples,
        durationMs: Math.max(finalDuration, mappedSamples[mappedSamples.length - 1]?.elapsedMs ?? 0),
      });
      setChartResetKey((k) => k + 1);

      let totalCloseness = 0;
      let comparedCount = 0;

      const melodyDuration = activeMelodyRef.current.duration;
      for (const s of mappedSamples) {
        if (s.frequencyHz == null || s.frequencyHz <= 0) continue;
        const loopedMs = s.elapsedMs % melodyDuration;
        const targetNote = activeMelodyRef.current.notes.find(
          (n) => loopedMs >= n.start && loopedMs <= n.end
        );
        if (!targetNote) continue;

        comparedCount++;
        const targetFreq = NOTE_FREQS[targetNote.note];
        totalCloseness += compareToTargetFrequency(s.frequencyHz, targetFreq).closenessPercent;
      }

      const sessionAccuracy =
        comparedCount === 0 ? 0 : Math.round(totalCloseness / comparedCount);

      const session: PitchSession & { melodyName: string; accuracy: number } = {
        id: `${Date.now()}`,
        startedAt: anchor,
        endedAt: anchor + finalDuration,
        sampleRate,
        samples: mappedSamples,
        melodyName: activeMelodyRef.current.name,
        accuracy: sessionAccuracy,
      };

      const existingRaw = await AsyncStorage.getItem(SESSIONS_KEY);
      const existing: PitchSession[] = existingRaw ? JSON.parse(existingRaw) : [];
      const next = [session, ...existing].slice(0, 20);
      await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(next));
      setSavedSessions(next);
      setStatus(`Done! Accuracy: ${sessionAccuracy}%`);
    }
  }, [getSavedSamples, sampleRate, sessionAnchorMs]);

  const handleStart = useCallback(() => {
    setStatus(null);
    stopReferenceAudio();
    setReviewSession(null);
    setSessionAnchorMs(null);
    setCurrentTimeMs(0);
    setChartResetKey((k) => k + 1);
    setSessionStartTime(Date.now());
    setListening(true);
  }, [stopReferenceAudio]);

  const handleToggle = useCallback(async () => {
    if (listening) {
      const elapsed = Date.now() - sessionStartTime;
      await handleStopAndSave(elapsed);
    } else {
      handleStart();
    }
  }, [listening, sessionStartTime, handleStopAndSave, handleStart]);

  // Load saved sessions on start
  useEffect(() => {
    AsyncStorage.getItem(SESSIONS_KEY).then((raw) => {
      if (raw) setSavedSessions(JSON.parse(raw));
    });
  }, []);

  // Handle permission or other issues from the analyzer hook
  useEffect(() => {
    if (listening && !isListening && error) {
      setListening(false);
    }
  }, [listening, isListening, error]);

  // Session clock — synced to mic start, not button press
  useEffect(() => {
    if (!listening || sessionAnchorMs == null) {
      if (!listening) setCurrentTimeMs(0);
      return;
    }

    const startTime = sessionAnchorMs;
    let animId: number;

    const tick = () => {
      setCurrentTimeMs(Date.now() - startTime);
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [listening, sessionAnchorMs]);

  const mappedCurrentSamples = useMemo(() => {
    if (history.length === 0) return [];
    const anchor = sessionAnchorMs ?? history[0]?.timestamp ?? null;
    if (anchor == null) return [];
    return history.map((s) => ({
      ...s,
      elapsedMs: Math.max(0, s.timestamp - anchor),
    }));
  }, [history, sessionAnchorMs]);

  const chartMode: PitchGraphMode = listening ? 'live' : reviewSession ? 'review' : 'idle';
  const chartSamples = listening ? mappedCurrentSamples : reviewSession?.samples ?? [];
  const chartSessionDurationMs = listening
    ? currentTimeMs
    : reviewSession?.durationMs ?? 0;

  const handleDownloadChart = useCallback(() => {
    if (!reviewSession || Platform.OS !== 'web') {
      setStatus('Chart download is available on web after you stop a session.');
      return;
    }
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    exportPitchChartPng(reviewSession.samples, reviewSession.durationMs, `pitch-chart-${stamp}.png`);
    setStatus('Chart downloaded.');
  }, [reviewSession]);

  const handleDownloadCsv = useCallback(() => {
    if (!reviewSession || Platform.OS !== 'web') {
      setStatus('CSV download is available on web after you stop a session.');
      return;
    }
    exportPitchSamplesCsv(reviewSession.samples, reviewSession.durationMs);
    setStatus('CSV downloaded.');
  }, [reviewSession]);

  const handleResetChart = useCallback(() => {
    setReviewSession(null);
    setCurrentTimeMs(0);
    setChartResetKey((k) => k + 1);
    setStatus(null);
  }, []);

  const currentAccuracy = useMemo(() => {
    if (!listening || mappedCurrentSamples.length === 0) return null;
    let totalCloseness = 0;
    let compared = 0;

    for (const s of mappedCurrentSamples) {
      if (s.frequencyHz == null || s.frequencyHz <= 0) continue;
      const loopedMs = s.elapsedMs % activeMelody.duration;
      const target = activeMelody.notes.find((n) => loopedMs >= n.start && loopedMs <= n.end);
      if (!target) continue;

      compared++;
      const targetFreq = NOTE_FREQS[target.note];
      totalCloseness += compareToTargetFrequency(s.frequencyHz, targetFreq).closenessPercent;
    }

    return compared === 0 ? 0 : Math.round(totalCloseness / compared);
  }, [mappedCurrentSamples, listening, activeMelody]);

  const loopedTimeMs = currentTimeMs % activeMelody.duration;

  const activeTargetNote = useMemo(() => {
    return activeMelody.notes.find((n) => loopedTimeMs >= n.start && loopedTimeMs <= n.end);
  }, [activeMelody, loopedTimeMs]);

  const targetFrequencyHz = activeTargetNote ? NOTE_FREQS[activeTargetNote.note] : null;

  useEffect(() => {
    if (!listening) {
      stableReadoutRef.current = null;
      setStableReadout(null);
      lastTargetNoteRef.current = null;
      return;
    }

    const targetNote = activeTargetNote?.note ?? null;
    if (targetNote !== lastTargetNoteRef.current) {
      lastTargetNoteRef.current = targetNote;
      stableReadoutRef.current = null;
      setStableReadout(null);
    }

    const next = updateStablePitchReadout(stableReadoutRef.current, currentSample);
    if (next) {
      stableReadoutRef.current = next;
      setStableReadout(next);
    }
  }, [listening, currentSample, activeTargetNote?.note]);

  const liveDeviation = useMemo(() => {
    if (!listening || !stableReadout?.frequencyHz || !targetFrequencyHz) return null;
    return compareToTargetFrequency(stableReadout.frequencyHz, targetFrequencyHz);
  }, [listening, stableReadout?.frequencyHz, targetFrequencyHz]);

  const tuningColor = useMemo(() => {
    if (liveDeviation == null) return '#D1C4E9';
    if (liveDeviation.closenessPercent >= 85) return '#10B981';
    if (liveDeviation.closenessPercent >= 50) return '#F59E0B';
    return '#EF4444';
  }, [liveDeviation]);

  const tuningText = useMemo(() => {
    if (liveDeviation == null) return '';
    if (liveDeviation.closenessPercent >= 85) return 'On pitch';
    const rawDelta = (stableReadout?.frequencyHz ?? 0) - (targetFrequencyHz ?? 0);
    if (Math.abs(rawDelta) < 1) return 'On pitch';
    return rawDelta > 0 ? 'Sharp' : 'Flat';
  }, [liveDeviation, stableReadout?.frequencyHz, targetFrequencyHz]);

  const detectedSwara = stableReadout?.note
    ? westernNoteToSwara(stableReadout.note)
    : null;

  const rawFrequencyDelta =
    stableReadout?.frequencyHz != null && targetFrequencyHz != null
      ? stableReadout.frequencyHz - targetFrequencyHz
      : null;

  const lastDebugLogRef = useRef(0);

  useEffect(() => {
    if (!PITCH_DEBUG_LOG || !listening) return;

    const now = Date.now();
    if (now - lastDebugLogRef.current < PITCH_DEBUG_LOG_INTERVAL_MS) return;
    lastDebugLogRef.current = now;

    const lastSample = mappedCurrentSamples[mappedCurrentSamples.length - 1];

    console.log('[PitchPractice]', {
      targetNote: activeTargetNote?.note ?? null,
      loopMs: Math.floor(loopedTimeMs),
      sessionMs: Math.floor(currentTimeMs),
      expectedHz: targetFrequencyHz,
      rawHz: currentSample?.frequencyHz ?? null,
      stableHz: stableReadout?.frequencyHz ?? null,
      detectedNote: currentSample?.note ?? null,
      stableNote: stableReadout?.note ?? null,
      swara: detectedSwara,
      rawFreqDiffHz: rawFrequencyDelta,
      normalizedFreqDiffHz: liveDeviation?.frequencyDeltaHz ?? null,
      cents: liveDeviation?.centsFromTarget ?? null,
      closenessPercent: liveDeviation?.closenessPercent ?? null,
      confidence: currentSample?.clarity ?? null,
      sampleCount: mappedCurrentSamples.length,
      micLive: isListening,
      scorePercent: currentAccuracy,
      lastSampleMs: lastSample?.elapsedMs ?? null,
      playheadMs: currentTimeMs,
      sessionAnchorMs,
    });
  }, [
    listening,
    activeTargetNote?.note,
    loopedTimeMs,
    currentTimeMs,
    targetFrequencyHz,
    currentSample,
    stableReadout,
    detectedSwara,
    rawFrequencyDelta,
    liveDeviation,
    mappedCurrentSamples,
    isListening,
    currentAccuracy,
    sessionAnchorMs,
  ]);

  useEffect(() => {
    if (!PITCH_DEBUG_LOG) return;
    if (listening && isListening && sessionAnchorMs != null) {
      console.log('[PitchPractice] mic live — session anchor set', { sessionAnchorMs });
    }
    if (!listening) {
      lastDebugLogRef.current = 0;
      console.log('[PitchPractice] session stopped');
    }
  }, [listening, isListening, sessionAnchorMs]);

  // Clean up references on unmount
  useEffect(() => {
    return () => {
      stopReferenceAudio();
    };
  }, [stopReferenceAudio]);

  return (
    <ScrollView style={styles.outerContainer} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Singing Practice</Text>
        {/* <Text style={styles.subtitle}>
          Match your voice pitch to the target notes.
        </Text> */}
      </View>

      {/* Main Responsive Grid Layout */}
      <View style={[styles.mainLayout, isWide ? styles.rowLayout : styles.columnLayout]}>
        
        {/* Left Column: Top Recording Controls + Bottom Pitch Graph */}
        <View style={isWide ? styles.leftColumn : styles.fullWidth}>
          
          <View style={styles.sectionBox}>
            <Text style={styles.sectionLabel}>1. Start Practicing:</Text>
            
            <View style={styles.actionsRow}>
              {Platform.OS === 'web' ? (
                <TouchableOpacity
                  style={[
                    styles.btnSecondary,
                    isPlayingReference && { backgroundColor: '#3B3654', borderColor: '#A78BFA' },
                  ]}
                  onPress={playReferenceAudio}
                >
                  <MaterialIcons
                    name={isPlayingReference ? 'volume-up' : 'volume-mute'}
                    size={20}
                    color={isPlayingReference ? '#C084FC' : '#D1C4E9'}
                  />
                  <Text style={[styles.btnSecText, isPlayingReference && { color: '#C084FC' }]}>
                    {isPlayingReference ? 'Stop Melody' : 'Play Melody'}
                  </Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.btnPrimary,
                  listening ? { backgroundColor: '#EF4444', shadowColor: '#EF4444' } : null,
                ]}
                onPress={handleToggle}
              >
                <MaterialIcons name={listening ? 'stop' : 'mic'} size={20} color="#FFF" />
                <Text style={styles.btnText}>{listening ? 'Stop & Save' : 'Start Singing'}</Text>
              </TouchableOpacity>
            </View>

            {status ? <Text style={styles.statusText}>{status}</Text> : null}

            {/* Readout panel */}
            <View style={styles.readoutContainer}>
              <View style={styles.liveReadout}>
                <View style={styles.readoutBlock}>
                  <Text style={styles.readoutLabel}>Target</Text>
                  <Text style={styles.readoutNote}>
                    {listening && activeTargetNote?.note ? activeTargetNote.note : '—'}
                  </Text>
                  {listening && targetFrequencyHz ? (
                    <Text style={styles.readoutHz}>{targetFrequencyHz.toFixed(1)} Hz</Text>
                  ) : null}
                </View>

                <View style={styles.readoutDivider} />

                <View style={styles.readoutBlock}>
                  <Text style={styles.readoutLabel}>Your Pitch</Text>
                  {listening && stableReadout ? (
                    <>
                      <Text style={[styles.readoutNote, { color: tuningColor }]}>
                        {stableReadout.noteLabel ?? '—'}
                      </Text>
                      <Text style={styles.readoutHz}>
                        {stableReadout.frequencyHz.toFixed(1)} Hz
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.readoutNote}>—</Text>
                  )}
                </View>

                <View style={styles.readoutDivider} />

                <View style={styles.readoutBlock}>
                  <Text style={styles.readoutLabel}>Closeness</Text>
                  {listening && liveDeviation ? (
                    <>
                      <Text style={[styles.tuningIndicator, { color: tuningColor }]}>
                        {liveDeviation.closenessPercent}%
                      </Text>
                      <Text style={styles.tuningSubText}>
                        {liveDeviation.frequencyDeltaHz > 0 ? '+' : ''}
                        {liveDeviation.frequencyDeltaHz.toFixed(1)} Hz ·{' '}
                        {liveDeviation.centsFromTarget > 0 ? '+' : ''}
                        {liveDeviation.centsFromTarget}¢
                      </Text>
                      {tuningText ? <Text style={styles.tuningSubText}>{tuningText}</Text> : null}
                    </>
                  ) : (
                    <Text style={styles.tuningPlaceholder}>—</Text>
                  )}
                </View>
              </View>
            </View>
          </View>

          <View style={styles.sectionBox}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionLabel}>2. Pitch Chart:</Text>
              <View style={styles.chartHeaderRight}>
                {currentAccuracy !== null ? (
                  <View style={styles.accuracyBadge}>
                    <Text style={styles.accuracyText}>{currentAccuracy}% Avg</Text>
                  </View>
                ) : null}
                {reviewSession && !listening ? (
                  <>
                    <TouchableOpacity style={styles.downloadBtn} onPress={handleDownloadChart}>
                      <MaterialIcons name="download" size={16} color="#C084FC" />
                      <Text style={styles.downloadBtnText}>Save PNG</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.downloadBtn} onPress={handleDownloadCsv}>
                      <MaterialIcons name="table-chart" size={16} color="#C084FC" />
                      <Text style={styles.downloadBtnText}>Save CSV</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.resetBtn} onPress={handleResetChart}>
                      <MaterialIcons name="refresh" size={16} color="#D1C4E9" />
                      <Text style={styles.resetBtnText}>Reset</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            </View>

            {chartMode === 'review' ? (
              <Text style={styles.reviewHint}>
                Session complete — scroll to view full chart ({Math.round(chartSessionDurationMs / 1000)}s)
              </Text>
            ) : null}

            <View style={{ marginTop: 8 }}>
              <PitchGraph
                key={chartResetKey}
                samples={chartSamples}
                currentTimeMs={listening ? currentTimeMs : 0}
                sessionDurationMs={chartSessionDurationMs}
                targetMelody={activeMelody.notes}
                mode={chartMode}
                resetKey={chartResetKey}
                height={400}
              />
            </View>
          </View>

          {error ? (
            <View style={styles.errorBlock}>
              <Text style={styles.error}>{error}</Text>
              {error.includes('permission') ? (
                <TouchableOpacity onPress={openAppSettings}>
                  <Text style={styles.settingsLink}>Grant Microphone Access</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>

        {isWide ? (
          <View style={styles.rightColumn}>
            <View style={styles.historyCompact}>
              <Text style={styles.historyCompactTitle}>History</Text>
              {savedSessions.length === 0 ? (
                <Text style={styles.noHistoryText}>No saves yet</Text>
              ) : (
                savedSessions.slice(0, 5).map((session) => {
                  const acc = session.accuracy ?? 0;
                  const badgeColor = acc >= 80 ? '#10B981' : acc >= 50 ? '#F59E0B' : '#EF4444';
                  return (
                    <View key={session.id} style={styles.historyCompactRow}>
                      <Text style={[styles.historyCompactScore, { color: badgeColor }]}>{acc}%</Text>
                      <Text style={styles.historyCompactDate} numberOfLines={1}>
                        {new Date(session.startedAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        ) : null}

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#13111C', // deep dark purple background
  },
  content: {
    padding: 20,
    gap: 16,
    paddingBottom: 60,
  },
  header: {
    gap: 4,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 20,
  },
  mainLayout: {
    width: '100%',
  },
  rowLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
  },
  columnLayout: {
    flexDirection: 'column',
    gap: 16,
  },
  leftColumn: {
    flex: 1,
    gap: 16,
    minWidth: 0,
  },
  rightColumn: {
    width: 148,
    maxWidth: 148,
    flexShrink: 0,
    gap: 8,
  },
  fullWidth: {
    width: '100%',
    gap: 16,
  },
  sectionBox: {
    backgroundColor: '#1E1B29',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2E2A3F',
    padding: 16,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#D1C4E9',
    letterSpacing: 0.5,
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  selectorPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorText: {
    fontSize: 13,
    fontWeight: '700',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A78BFA',
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
  },
  downloadBtnText: {
    color: '#C084FC',
    fontSize: 11,
    fontWeight: '700',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2E2A3F',
    backgroundColor: '#13111C',
  },
  resetBtnText: {
    color: '#D1C4E9',
    fontSize: 11,
    fontWeight: '700',
  },
  reviewHint: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
  },
  accuracyBadge: {
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    borderColor: '#A78BFA',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  accuracyText: {
    color: '#C084FC',
    fontSize: 12,
    fontWeight: '700',
  },
  readoutContainer: {
    backgroundColor: '#13111C',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 70,
    borderWidth: 1,
    borderColor: '#2E2A3F',
  },
  liveReadout: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  readoutBlock: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  readoutLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  readoutNote: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  readoutHz: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  readoutDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#2E2A3F',
  },
  tuningIndicator: {
    fontSize: 16,
    fontWeight: '700',
  },
  tuningPlaceholder: {
    fontSize: 18,
    color: '#9CA3AF',
  },
  tuningSubText: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  helperText: {
    color: '#9CA3AF',
    fontSize: 13,
    textAlign: 'center',
  },
  errorBlock: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  error: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '500',
  },
  settingsLink: {
    color: '#A78BFA',
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  statusText: {
    color: '#A78BFA',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  btnPrimary: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: '#7C3AED', // purple-600
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  btnSecondary: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#1E1B29',
    borderColor: '#2E2A3F',
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  btnSecText: {
    color: '#D1C4E9',
    fontSize: 14,
    fontWeight: '600',
  },
  historySection: {
    marginTop: 4,
    gap: 10,
  },
  historyRow: {
    flexDirection: 'row',
    backgroundColor: '#13111C',
    borderColor: '#2E2A3F',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  historyMelody: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  historyDate: {
    color: '#9CA3AF',
    fontSize: 11,
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  scoreBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  scoreBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  noHistoryText: {
    color: '#9CA3AF',
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 8,
  },
  historyCompact: {
    backgroundColor: '#1E1B29',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2E2A3F',
    padding: 10,
    gap: 6,
  },
  historyCompactTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  historyCompactRow: {
    gap: 2,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#2E2A3F',
  },
  historyCompactScore: {
    fontSize: 14,
    fontWeight: '800',
  },
  historyCompactDate: {
    fontSize: 9,
    color: '#9CA3AF',
  },
});
