'use client';

type OscType = OscillatorType | undefined;

type ToneSpec = {
  frequency: number;
  duration: number;
  volume?: number;
  type?: OscType;
  delay?: number;
  gapAfter?: number;
};

type SoundKey =
  | 'messageSend'
  | 'messageReceive'
  | 'callStart'
  | 'callAlert'
  | 'callConnected'
  | 'callEnd';

type LoopKey = 'incomingRing' | 'outgoingRing';

const SOUND_PATTERNS: Record<SoundKey, ToneSpec[]> = {
  messageSend: [
    { frequency: 760, duration: 0.08, volume: 0.22 },
    { frequency: 980, duration: 0.08, volume: 0.18, delay: 0.05 },
  ],
  messageReceive: [
    { frequency: 520, duration: 0.09, volume: 0.28, type: 'triangle' },
    { frequency: 390, duration: 0.12, volume: 0.22, delay: 0.04 },
  ],
  callStart: [
    { frequency: 620, duration: 0.15, volume: 0.28, type: 'sawtooth' },
    { frequency: 840, duration: 0.14, volume: 0.2, delay: 0.08 },
  ],
  callAlert: [
    { frequency: 660, duration: 0.12, volume: 0.3, type: 'square' },
    { frequency: 880, duration: 0.12, volume: 0.25, delay: 0.1 },
  ],
  callConnected: [
    { frequency: 1320, duration: 0.15, volume: 0.3, type: 'triangle' },
    { frequency: 880, duration: 0.1, volume: 0.2, delay: 0.05 },
  ],
  callEnd: [
    { frequency: 420, duration: 0.12, volume: 0.25 },
    { frequency: 260, duration: 0.16, volume: 0.22, delay: 0.05 },
  ],
};

const LOOP_PATTERNS: Record<
  LoopKey,
  { pattern: ToneSpec[]; interval: number }
> = {
  incomingRing: {
    pattern: [
      { frequency: 540, duration: 0.22, volume: 0.32, type: 'triangle' },
      { frequency: 660, duration: 0.22, volume: 0.28, delay: 0.25 },
    ],
    interval: 1400,
  },
  outgoingRing: {
    pattern: [
      { frequency: 440, duration: 0.16, volume: 0.24, type: 'sawtooth' },
      { frequency: 660, duration: 0.16, volume: 0.22, delay: 0.22 },
    ],
    interval: 1600,
  },
};

class SoundManager {
  private ctx: AudioContext | null = null;
  private loops = new Map<LoopKey, number>();
  private unlocked = false;
  private unlockListenersAttached = false;

  private createContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const audioWindow = window as Window & {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioContextCtor =
      audioWindow.AudioContext || audioWindow.webkitAudioContext;
    if (!AudioContextCtor) {
      return null;
    }
    if (!this.ctx) {
      this.ctx = new AudioContextCtor();
    }
    return this.ctx;
  }

  private attachUnlockListeners() {
    if (
      this.unlockListenersAttached ||
      this.unlocked ||
      typeof window === 'undefined'
    ) {
      return;
    }

    const unlockFromGesture = () => {
      void this.unlock();
    };

    this.unlockListenersAttached = true;
    window.addEventListener('pointerdown', unlockFromGesture, {
      once: true,
      capture: true,
    });
    window.addEventListener('keydown', unlockFromGesture, {
      once: true,
      capture: true,
    });
    window.addEventListener('touchstart', unlockFromGesture, {
      once: true,
      capture: true,
    });
  }

  private ensureContext(): AudioContext | null {
    if (!this.unlocked) {
      this.attachUnlockListeners();
      return null;
    }

    const ctx = this.createContext();
    if (!ctx) {
      return null;
    }

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  async unlock() {
    this.unlocked = true;
    const ctx = this.createContext();
    if (!ctx) {
      return;
    }
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }
  }

  private playPattern(pattern: ToneSpec[]) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    let cursor = ctx.currentTime;
    pattern.forEach(tone => {
      const startTime = cursor + (tone.delay ?? 0);
      this.playToneAt(ctx, tone, startTime);
      cursor = startTime + tone.duration + (tone.gapAfter ?? 0);
    });
  }

  private playToneAt(ctx: AudioContext, tone: ToneSpec, startTime: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tone.type ?? 'sine';
    osc.frequency.value = tone.frequency;
    gain.gain.value = tone.volume ?? 0.2;
    osc.connect(gain).connect(ctx.destination);

    const stopTime = startTime + tone.duration;
    osc.start(startTime);
    gain.gain.setValueAtTime(gain.gain.value, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    osc.stop(stopTime + 0.02);
  }

  play(sound: SoundKey) {
    const pattern = SOUND_PATTERNS[sound];
    if (!pattern) return;
    this.playPattern(pattern);
  }

  startLoop(loop: LoopKey) {
    if (typeof window === 'undefined') return;
    if (this.loops.has(loop)) return;
    const def = LOOP_PATTERNS[loop];
    if (!def) return;
    this.playPattern(def.pattern);
    const id = window.setInterval(
      () => this.playPattern(def.pattern),
      def.interval,
    );
    this.loops.set(loop, id);
  }

  stopLoop(loop?: LoopKey) {
    if (typeof window === 'undefined') return;
    if (loop) {
      const handle = this.loops.get(loop);
      if (handle != null) {
        clearInterval(handle);
        this.loops.delete(loop);
      }
      return;
    }
    this.loops.forEach(handle => clearInterval(handle));
    this.loops.clear();
  }
}

export const soundManager = new SoundManager();
