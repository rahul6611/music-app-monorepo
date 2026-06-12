import type { PitchPlaybackSegment } from '@music-app/utils';

export type PitchPlayerWaveform = OscillatorType;

export type PitchFrequencyPlayerOptions = {
  waveform?: PitchPlayerWaveform;
  gain?: number;
  onEnded?: () => void;
};

export class PitchFrequencyPlayer {
  private context: AudioContext | null = null;
  private endTimer: ReturnType<typeof setTimeout> | null = null;
  private playing = false;

  get isPlaying(): boolean {
    return this.playing;
  }

  async play(
    segments: PitchPlaybackSegment[],
    options: PitchFrequencyPlayerOptions = {},
  ): Promise<void> {
    if (typeof window === 'undefined') return;
    this.stop();

    if (segments.length === 0) {
      throw new Error('No frequency data to play.');
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('Web Audio is not available in this browser.');
    }

    const context = new AudioContextClass();
    if (context.state === 'suspended') {
      await context.resume();
    }

    const waveform = options.waveform ?? 'triangle';
    const peakGain = options.gain ?? 0.28;
    const startAt = context.currentTime + 0.06;
    const durationSec = segments[segments.length - 1].endMs / 1000;

    for (const segment of segments) {
      const segStart = startAt + segment.startMs / 1000;
      const segEnd = startAt + segment.endMs / 1000;
      if (segEnd <= segStart) continue;

      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      oscillator.type = waveform;
      oscillator.frequency.setValueAtTime(segment.frequencyHz, segStart);

      const attack = Math.min(0.01, (segEnd - segStart) / 4);
      gainNode.gain.setValueAtTime(0, segStart);
      gainNode.gain.linearRampToValueAtTime(peakGain, segStart + attack);
      gainNode.gain.setValueAtTime(peakGain, segEnd - attack);
      gainNode.gain.linearRampToValueAtTime(0, segEnd);

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      oscillator.start(segStart);
      oscillator.stop(segEnd + 0.002);
    }

    this.context = context;
    this.playing = true;

    this.endTimer = setTimeout(() => {
      this.playing = false;
      options.onEnded?.();
      void this.context?.close();
      this.context = null;
    }, durationSec * 1000 + 120);
  }

  stop(): void {
    if (this.endTimer != null) {
      clearTimeout(this.endTimer);
      this.endTimer = null;
    }
    this.playing = false;
    void this.context?.close();
    this.context = null;
  }
}
