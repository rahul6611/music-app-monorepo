import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@music-app/store';
import type { PitchSession } from '@music-app/utils';
import { usePitchAnalyzer } from '../../hooks/usePitchAnalyzer';
import PitchGraph, { NOTE_FREQS, type MelodyNote } from './PitchGraph';

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

const getMelodyFriendlyName = (fullName: string) => {
  if (fullName.includes('Ascending')) return 'Low to High';
  if (fullName.includes('Descending')) return 'High to Low';
  if (fullName.includes('Full Cycle') || fullName.includes('Cycle')) return 'Up and Down';
  return 'Practice Scale';
};

export default function PitchMonitor() {
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const isWide = windowWidth > 900;

  const [activeMelodyKey, setActiveMelodyKey] = useState<keyof typeof MELODIES>('bhupali_asc');
  const activeMelody = MELODIES[activeMelodyKey];

  const [listening, setListening] = useState(false);
  const [savedSessions, setSavedSessions] = useState<(PitchSession & { melodyName?: string; accuracy?: number })[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  // Time tracker for playhead progress
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState(0);

  const { isListening, error, currentSample, sampleRate, getSavedSamples, openAppSettings } =
    usePitchAnalyzer({ enabled: listening, historySize: 300 });

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
    setListening(false);
    const samples = getSavedSamples();

    if (samples.length > 0) {
      const startTime = samples[0].timestamp;
      const mappedSamples = samples.map((s) => ({
        ...s,
        elapsedMs: s.timestamp - startTime,
      }));

      // Calculate final accuracy score
      let matches = 0;
      let comparedCount = 0;

      for (const s of mappedSamples) {
        if (s.frequencyHz == null || s.frequencyHz <= 0) continue;
        const targetNote = activeMelodyRef.current.notes.find(
          (n) => s.elapsedMs >= n.start && s.elapsedMs <= n.end
        );
        if (!targetNote) continue;

        comparedCount++;
        const targetFreq = NOTE_FREQS[targetNote.note];
        // Shift octave
        const k = Math.round(Math.log2(targetFreq / s.frequencyHz));
        const shifted = s.frequencyHz * Math.pow(2, k);
        const centsDiff = Math.abs(1200 * Math.log2(shifted / targetFreq));

        if (centsDiff <= 50) {
          matches++;
        }
      }

      const sessionAccuracy = comparedCount === 0 ? 0 : Math.round((matches / comparedCount) * 100);

      const session: PitchSession & { melodyName: string; accuracy: number } = {
        id: `${Date.now()}`,
        startedAt: startTime,
        endedAt: startTime + finalDuration,
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
  }, [getSavedSamples, sampleRate]);

  const handleStart = useCallback(() => {
    setStatus(null);
    stopReferenceAudio();
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

  // Playback timer loop
  useEffect(() => {
    if (!listening) {
      setCurrentTimeMs(0);
      return;
    }

    const startTime = Date.now();
    let animId: number;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const duration = activeMelodyRef.current.duration;
      if (elapsed >= duration) {
        setCurrentTimeMs(duration);
        void handleStopAndSave(duration);
      } else {
        setCurrentTimeMs(elapsed);
        animId = requestAnimationFrame(tick);
      }
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [listening, handleStopAndSave]);

  // Calculate real-time samples list mapped with elapsed times
  const currentSamples = getSavedSamples();
  const mappedCurrentSamples = useMemo(() => {
    if (currentSamples.length === 0) return [];
    const startTime = currentSamples[0].timestamp;
    return currentSamples.map((s) => ({
      ...s,
      elapsedMs: s.timestamp - startTime,
    }));
  }, [currentSamples]);

  // Calculate real-time accuracy
  const currentAccuracy = useMemo(() => {
    if (!listening || mappedCurrentSamples.length === 0) return null;
    let matches = 0;
    let compared = 0;

    for (const s of mappedCurrentSamples) {
      if (s.frequencyHz == null || s.frequencyHz <= 0) continue;
      const target = activeMelody.notes.find((n) => s.elapsedMs >= n.start && s.elapsedMs <= n.end);
      if (!target) continue;

      compared++;
      const targetFreq = NOTE_FREQS[target.note];
      const k = Math.round(Math.log2(targetFreq / s.frequencyHz));
      const shifted = s.frequencyHz * Math.pow(2, k);
      const centsDiff = Math.abs(1200 * Math.log2(shifted / targetFreq));
      if (centsDiff <= 50) {
        matches++;
      }
    }

    return compared === 0 ? 0 : Math.round((matches / compared) * 100);
  }, [mappedCurrentSamples, listening, activeMelody]);

  // Get active target note at current time
  const activeTargetNote = useMemo(() => {
    return activeMelody.notes.find((n) => currentTimeMs >= n.start && currentTimeMs <= n.end);
  }, [activeMelody, currentTimeMs]);

  // Clean cents details & colors
  const centsValue = currentSample?.cents;
  const centsText =
    centsValue != null ? `${centsValue > 0 ? '+' : ''}${centsValue}¢` : '';

  const tuningColor = useMemo(() => {
    if (centsValue == null) return '#D1C4E9';
    const absCents = Math.abs(centsValue);
    if (absCents <= 15) return '#10B981'; // green - perfect
    if (absCents <= 35) return '#F59E0B'; // orange - close
    return '#EF4444'; // red - off
  }, [centsValue]);

  const tuningText = useMemo(() => {
    if (centsValue == null) return '';
    const absCents = Math.abs(centsValue);
    if (absCents <= 15) return 'Perfect!';
    if (centsValue > 0) return 'Too High';
    return 'Too Low';
  }, [centsValue]);

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
        <Text style={styles.subtitle}>
          Match your voice pitch to the target notes.
        </Text>
      </View>

      {/* Main Responsive Grid Layout */}
      <View style={[styles.mainLayout, isWide ? styles.rowLayout : styles.columnLayout]}>
        
        {/* Left Column: Top Recording Controls + Bottom Pitch Graph */}
        <View style={isWide ? styles.leftColumn : styles.fullWidth}>
          
          {/* Step 1: Scale Selector */}
          <View style={styles.sectionBox}>
            <Text style={styles.sectionLabel}>1. Choose Scale:</Text>
            <View style={styles.selectorRow}>
              {Object.entries(MELODIES).map(([key, config]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.selectorPill,
                    activeMelodyKey === key
                      ? { backgroundColor: '#A78BFA', borderColor: '#C084FC' }
                      : { backgroundColor: '#1E1B29', borderColor: '#2E2A3F' },
                  ]}
                  onPress={() => {
                    setActiveMelodyKey(key as keyof typeof MELODIES);
                    stopReferenceAudio();
                  }}
                >
                  <Text
                    style={[
                      styles.selectorText,
                      activeMelodyKey === key ? { color: '#FFF' } : { color: '#D1C4E9' },
                    ]}
                  >
                    {key === 'bhupali_asc'
                      ? 'Low to High'
                      : key === 'bhupali_desc'
                      ? 'High to Low'
                      : 'Up and Down'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Step 2: Live Controls & Readouts */}
          <View style={styles.sectionBox}>
            <Text style={styles.sectionLabel}>2. Start Practicing:</Text>
            
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
                  <Text style={styles.readoutLabel}>Target Note</Text>
                  <Text style={styles.readoutNote}>
                    {listening && activeTargetNote?.note ? activeTargetNote.note : '—'}
                  </Text>
                </View>

                <View style={styles.readoutDivider} />

                <View style={styles.readoutBlock}>
                  <Text style={styles.readoutLabel}>Your Note</Text>
                  <Text style={[styles.readoutNote, { color: listening ? tuningColor : '#FFFFFF' }]}>
                    {listening && currentSample?.note ? currentSample.note : '—'}
                  </Text>
                </View>

                <View style={styles.readoutDivider} />

                <View style={styles.readoutBlock}>
                  <Text style={styles.readoutLabel}>Pitch Meter</Text>
                  {listening && centsText ? (
                    <Text style={[styles.tuningIndicator, { color: tuningColor }]}>
                      {centsText}
                    </Text>
                  ) : (
                    <Text style={styles.tuningPlaceholder}>—</Text>
                  )}
                  {listening && tuningText ? <Text style={styles.tuningSubText}>{tuningText}</Text> : null}
                </View>
              </View>
            </View>
          </View>

          {/* Step 3: Graph Display */}
          <View style={styles.sectionBox}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionLabel}>3. Pitch Graph:</Text>
              {currentAccuracy !== null ? (
                <View style={styles.accuracyBadge}>
                  <Text style={styles.accuracyText}>{currentAccuracy}% Match</Text>
                </View>
              ) : null}
            </View>

            <View style={{ marginTop: 8 }}>
              <PitchGraph
                samples={mappedCurrentSamples}
                currentTimeMs={currentTimeMs}
                durationMs={activeMelody.duration}
                targetMelody={activeMelody.notes}
                isPlaying={listening}
                height={240}
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

        {/* Right Column: Saved Sessions List */}
        <View style={isWide ? styles.rightColumn : styles.fullWidth}>
          <View style={styles.sectionBox}>
            <Text style={styles.sectionLabel}>Saved Sessions:</Text>
            <View style={styles.historySection}>
              {savedSessions.length === 0 ? (
                <Text style={styles.noHistoryText}>No saved practices yet.</Text>
              ) : (
                savedSessions.slice(0, 8).map((session) => {
                  const acc = session.accuracy ?? 0;
                  const badgeColor = acc >= 80 ? '#10B981' : acc >= 50 ? '#F59E0B' : '#EF4444';
                  return (
                    <View key={session.id} style={styles.historyRow}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.historyMelody}>
                          {session.melodyName ? getMelodyFriendlyName(session.melodyName) : 'Scale'}
                        </Text>
                        <Text style={styles.historyDate}>
                          {new Date(session.startedAt).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>

                      <View style={styles.historyRight}>
                        <View style={[styles.scoreBadge, { backgroundColor: badgeColor + '20', borderColor: badgeColor }]}>
                          <Text style={[styles.scoreBadgeText, { color: badgeColor }]}>{acc}% Score</Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        </View>

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
    flex: 2,
    gap: 16,
  },
  rightColumn: {
    flex: 1,
    minWidth: 280,
    gap: 16,
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
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
});
