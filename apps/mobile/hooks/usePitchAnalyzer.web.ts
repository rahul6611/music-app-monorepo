import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildPitchSample,
  detectPitchHz,
  stabilizeDetectedFrequency,
  type PitchSample,
} from '@music-app/utils';

type UsePitchAnalyzerOptions = {
  enabled?: boolean;
  fftSize?: number;
  minHz?: number;
  maxHz?: number;
  historySize?: number;
};

export function usePitchAnalyzer(options: UsePitchAnalyzerOptions = {}) {
  const {
    enabled = false,
    fftSize = 2048,
    minHz = 65,
    maxHz = 1200,
    historySize = 120,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSample, setCurrentSample] = useState<PitchSample | null>(null);
  const [history, setHistory] = useState<PitchSample[]>([]);
  const [sampleRate, setSampleRate] = useState(44100);

  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const bufferRef = useRef<Float32Array | null>(null);
  const savedRef = useRef<PitchSample[]>([]);
  const activeRef = useRef(false);
  const recentHzRef = useRef<number[]>([]);

  const stop = useCallback(async () => {
    activeRef.current = false;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    analyserRef.current = null;
    if (contextRef.current) {
      await contextRef.current.close();
      contextRef.current = null;
    }
    setIsListening(false);
  }, []);

  const start = useCallback(async () => {
    if (activeRef.current) {
      return;
    }

    setError(null);
    savedRef.current = [];
    recentHzRef.current = [];
    setHistory([]);
    setCurrentSample(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const context = new AudioContext();
      if (context.state === 'suspended') {
        await context.resume();
      }

      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = fftSize;
      source.connect(analyser);

      contextRef.current = context;
      analyserRef.current = analyser;
      streamRef.current = stream;
      bufferRef.current = new Float32Array(analyser.fftSize);
      setSampleRate(context.sampleRate);
      activeRef.current = true;
      setIsListening(true);

      const tick = () => {
        if (!activeRef.current) return;

        const analyserNode = analyserRef.current;
        const buffer = bufferRef.current;
        const audioContext = contextRef.current;
        if (!analyserNode || !buffer || !audioContext) return;

        if (audioContext.state === 'suspended') {
          void audioContext.resume().catch(() => {});
        }

        analyserNode.getFloatTimeDomainData(buffer as any);
        const detected = detectPitchHz(buffer, audioContext.sampleRate, minHz, maxHz);
        const stabilized = stabilizeDetectedFrequency(
          detected.frequencyHz,
          detected.clarity,
          recentHzRef.current,
        );
        recentHzRef.current = stabilized.recentHz;
        const sample = buildPitchSample(stabilized.frequencyHz, detected.clarity, Date.now());
        setCurrentSample(sample);
        savedRef.current.push(sample);
        setHistory((prev) => [...prev.slice(-(historySize - 1)), sample]);
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (err: any) {
      setError(err?.message ?? 'Microphone access failed');
      await stop();
    }
  }, [fftSize, historySize, maxHz, minHz, stop]);

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
    stop();
  }, [stop]);

  const getSavedSamples = useCallback(() => [...savedRef.current], []);

  return {
    isListening,
    error,
    currentSample,
    history,
    sampleRate,
    start,
    stop,
    getSavedSamples,
  };
}
