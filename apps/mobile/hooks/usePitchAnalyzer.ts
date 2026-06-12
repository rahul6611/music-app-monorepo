import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { AudioModule } from 'expo-audio';
import {
  aggregatePitchWindow,
  buildPitchSample,
  detectPitchHz,
  PITCH_SAMPLE_INTERVAL_MS,
  type PitchSample,
} from '@music-app/utils';

type UsePitchAnalyzerOptions = {
  enabled?: boolean;
  fftSize?: number;
  minHz?: number;
  maxHz?: number;
  historySize?: number;
  sampleIntervalMs?: number;
};

type RawReading = { frequencyHz: number | null; clarity: number };

type AudioBufferLike = {
  getChannelData: (channel: number) => Float32Array;
  sampleRate: number;
};

function extractMonoBuffer(buffer: unknown): { samples: Float32Array; sampleRate: number } {
  if (
    buffer &&
    typeof buffer === 'object' &&
    'getChannelData' in buffer &&
    typeof (buffer as AudioBufferLike).getChannelData === 'function'
  ) {
    const audioBuffer = buffer as AudioBufferLike;
    return {
      samples: audioBuffer.getChannelData(0),
      sampleRate: audioBuffer.sampleRate || 44100,
    };
  }

  return { samples: buffer as Float32Array, sampleRate: 44100 };
}

async function ensureMicrophonePermission(): Promise<'granted' | 'denied'> {
  const current = await AudioModule.getRecordingPermissionsAsync();
  if (current.granted) {
    return 'granted';
  }

  if (current.canAskAgain) {
    const requested = await AudioModule.requestRecordingPermissionsAsync();
    if (requested.granted) {
      return 'granted';
    }
  }

  const { AudioManager } = require('react-native-audio-api');
  const nativeStatus = await AudioManager.checkRecordingPermissions();
  if (nativeStatus === 'Granted') {
    return 'granted';
  }

  if (nativeStatus !== 'Denied') {
    const requested = await AudioManager.requestRecordingPermissions();
    if (requested === 'Granted') {
      return 'granted';
    }
  }

  return 'denied';
}

export function usePitchAnalyzer(options: UsePitchAnalyzerOptions = {}) {
  const {
    enabled = false,
    fftSize = 2048,
    minHz = 65,
    maxHz = 1200,
    historySize = 120,
    sampleIntervalMs = PITCH_SAMPLE_INTERVAL_MS,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSample, setCurrentSample] = useState<PitchSample | null>(null);
  const [history, setHistory] = useState<PitchSample[]>([]);
  const [sampleRate, setSampleRate] = useState(44100);

  const recorderRef = useRef<{
    start: () => { status: string; message?: string };
    stop: () => void;
    onAudioReady: (
      config: { sampleRate: number; bufferLength: number; channelCount: number },
      callback: (event: { buffer: unknown }) => void,
    ) => { status: string; message?: string };
    clearOnAudioReady: () => void;
    onError: (callback: (event: { message: string }) => void) => void;
    clearOnError: () => void;
  } | null>(null);
  const savedRef = useRef<PitchSample[]>([]);
  const activeRef = useRef(false);
  const windowReadingsRef = useRef<RawReading[]>([]);
  const lastCommitMsRef = useRef(0);
  const commitWindowRef = useRef<(timestamp: number) => void>(() => {});

  const stop = useCallback(async () => {
    activeRef.current = false;
    if (windowReadingsRef.current.length > 0) {
      commitWindowRef.current(Date.now());
    }
    const recorder = recorderRef.current;
    recorderRef.current = null;

    recorder?.clearOnError?.();
    recorder?.stop();
    recorder?.clearOnAudioReady();

    try {
      const { AudioManager } = require('react-native-audio-api');
      await AudioManager.setAudioSessionActivity(false);
    } catch {
      // ignore when module is unavailable
    }

    setIsListening(false);
  }, []);

  const start = useCallback(async () => {
    if (activeRef.current) {
      return;
    }

    setError(null);
    savedRef.current = [];
    windowReadingsRef.current = [];
    lastCommitMsRef.current = 0;
    setHistory([]);
    setCurrentSample(null);

    const commitWindow = (timestamp: number) => {
      const aggregated = aggregatePitchWindow(windowReadingsRef.current);
      windowReadingsRef.current = [];
      lastCommitMsRef.current = timestamp;

      const sample = buildPitchSample(aggregated.frequencyHz, aggregated.clarity, timestamp);
      setCurrentSample(sample);
      savedRef.current.push(sample);
      setHistory((prev) => [...prev.slice(-(historySize - 1)), sample]);
    };
    commitWindowRef.current = commitWindow;

    try {
      const permission = await ensureMicrophonePermission();
      if (permission !== 'granted') {
        setError(
          Platform.OS === 'android'
            ? 'Microphone permission is required. Enable it in Android Settings > Apps > Musiki > Permissions.'
            : 'Microphone permission is required for pitch detection.',
        );
        return;
      }

      const { AudioRecorder, AudioManager } = require('react-native-audio-api');

      await AudioManager.setAudioSessionOptions({
        iosCategory: 'playAndRecord',
        iosMode: 'measurement',
        iosOptions: ['defaultToSpeaker', 'allowBluetoothHFP'],
      });

      const sessionActive = await AudioManager.setAudioSessionActivity(true);
      if (!sessionActive) {
        setError('Could not activate the audio session.');
        return;
      }

      const preferredSampleRate = AudioManager.getDevicePreferredSampleRate() || 44100;
      const recorder = new AudioRecorder();
      recorderRef.current = recorder;
      setSampleRate(preferredSampleRate);

      recorder.onError(({ message }: { message: string }) => {
        setError(message || 'Microphone capture failed.');
        void stop();
      });

      activeRef.current = true;
      setIsListening(true);
      lastCommitMsRef.current = Date.now();

      const readyResult = recorder.onAudioReady(
        { sampleRate: preferredSampleRate, bufferLength: fftSize, channelCount: 1 },
        ({ buffer }: { buffer: unknown }) => {
          if (!activeRef.current) return;

          const { samples, sampleRate: bufferRate } = extractMonoBuffer(buffer);
          const detected = detectPitchHz(samples, bufferRate, minHz, maxHz);
          windowReadingsRef.current.push(detected);

          const now = Date.now();
          if (now - lastCommitMsRef.current >= sampleIntervalMs) {
            commitWindow(now);
          }
        },
      );

      if (readyResult.status === 'error') {
        setError(readyResult.message ?? 'Could not prepare microphone capture.');
        await stop();
        return;
      }

      const result = recorder.start();
      if (result.status === 'error') {
        setError(result.message ?? 'Could not start microphone capture.');
        await stop();
        return;
      }

      activeRef.current = true;
      setIsListening(true);
    } catch {
      setError(
        'Pitch detection requires a dev build with react-native-audio-api. Run prebuild and rebuild the app.',
      );
      await stop();
    }
  }, [fftSize, historySize, maxHz, minHz, sampleIntervalMs, stop]);

  useEffect(() => {
    if (enabled && !activeRef.current) {
      void start();
      return;
    }
    if (!enabled && activeRef.current) {
      void stop();
    }
  }, [enabled, start, stop]);

  useEffect(() => () => {
    void stop();
  }, [stop]);

  const getSavedSamples = useCallback(() => [...savedRef.current], []);

  const openAppSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  return {
    isListening,
    error,
    currentSample,
    history,
    sampleRate,
    start,
    stop,
    getSavedSamples,
    openAppSettings,
  };
}
