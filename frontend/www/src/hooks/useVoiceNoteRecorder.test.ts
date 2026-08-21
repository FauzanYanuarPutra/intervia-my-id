import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reactHarness = vi.hoisted(() => ({
  cleanups: [] as Array<() => void>,
}));

vi.mock('react', () => ({
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void)) => {
    const cleanup = effect();
    if (cleanup) reactHarness.cleanups.push(cleanup);
  },
  useRef: (initialValue: unknown) => ({ current: initialValue }),
  useState: (initialValue: unknown) => [initialValue, vi.fn()],
}));

import {
  useVoiceNoteRecorder as mountVoiceNoteRecorderHarness,
  voiceNoteRecorderErrorCode,
} from './useVoiceNoteRecorder';

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  static rejectConstrainedConstruction = false;

  static isTypeSupported(mimeType: string) {
    return mimeType === 'audio/webm;codecs=opus';
  }

  state: RecordingState = 'inactive';
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onerror: (() => void) | null = null;
  onstop: (() => void | Promise<void>) | null = null;

  constructor(
    public readonly stream: MediaStream,
    options: MediaRecorderOptions = {},
  ) {
    if (
      FakeMediaRecorder.rejectConstrainedConstruction &&
      (options.mimeType || options.audioBitsPerSecond)
    ) {
      throw Object.assign(new Error('unsupported options'), {
        name: 'NotSupportedError',
      });
    }
    this.mimeType = options.mimeType || 'audio/webm';
    FakeMediaRecorder.instances.push(this);
  }

  start() {
    this.state = 'recording';
  }

  pause() {
    this.state = 'paused';
  }

  resume() {
    this.state = 'recording';
  }

  stop() {
    if (this.state === 'inactive') return;
    this.state = 'inactive';
    this.ondataavailable?.({
      data: new Blob(
        [new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f])],
        { type: this.mimeType },
      ),
    });
    void this.onstop?.();
  }
}

function microphoneStream() {
  const stop = vi.fn();
  const stream = {
    getTracks: () => [{ stop }],
  } as unknown as MediaStream;
  return { stop, stream };
}

function getUserMediaMock() {
  return vi.mocked(navigator.mediaDevices.getUserMedia);
}

beforeEach(() => {
  reactHarness.cleanups.length = 0;
  FakeMediaRecorder.instances.length = 0;
  FakeMediaRecorder.rejectConstrainedConstruction = false;
  vi.stubGlobal('window', {
    clearInterval: vi.fn(),
    isSecureContext: true,
    setInterval: vi.fn(() => 1),
  });
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia: vi.fn() },
  });
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:voice-note'),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  reactHarness.cleanups.splice(0).forEach(cleanup => cleanup());
  vi.unstubAllGlobals();
});

describe('useVoiceNoteRecorder lifecycle', () => {
  it('coalesces double starts and releases a late permission stream after cancel', async () => {
    const microphone = microphoneStream();
    let resolvePermission!: (stream: MediaStream) => void;
    const permission = new Promise<MediaStream>(resolve => {
      resolvePermission = resolve;
    });
    getUserMediaMock().mockReturnValue(permission);
    const recorder = mountVoiceNoteRecorderHarness();

    const firstStart = recorder.start();
    const duplicateStart = recorder.start();
    expect(getUserMediaMock()).toHaveBeenCalledTimes(1);

    recorder.cancel();
    resolvePermission(microphone.stream);
    await Promise.all([firstStart, duplicateStart]);

    expect(FakeMediaRecorder.instances).toHaveLength(0);
    expect(microphone.stop).toHaveBeenCalledTimes(1);
  });

  it('pauses, resumes, stops, and releases every microphone track', async () => {
    const microphone = microphoneStream();
    getUserMediaMock().mockResolvedValue(microphone.stream);
    const recorder = mountVoiceNoteRecorderHarness();

    await recorder.start();
    const mediaRecorder = FakeMediaRecorder.instances[0]!;
    expect(mediaRecorder.state).toBe('recording');

    recorder.pause();
    expect(mediaRecorder.state).toBe('paused');
    recorder.resume();
    expect(mediaRecorder.state).toBe('recording');
    recorder.stop();
    await new Promise<void>(resolve => setImmediate(resolve));

    expect(mediaRecorder.state).toBe('inactive');
    expect(microphone.stop).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('falls back to the browser default when a WebView over-reports support', async () => {
    const microphone = microphoneStream();
    getUserMediaMock().mockResolvedValue(microphone.stream);
    FakeMediaRecorder.rejectConstrainedConstruction = true;
    const recorder = mountVoiceNoteRecorderHarness();

    await recorder.start();

    expect(FakeMediaRecorder.instances).toHaveLength(1);
    expect(FakeMediaRecorder.instances[0]!.state).toBe('recording');
    recorder.cancel();
    expect(microphone.stop).toHaveBeenCalled();
  });

  it('stops an active recorder and its tracks when the component unmounts', async () => {
    const microphone = microphoneStream();
    getUserMediaMock().mockResolvedValue(microphone.stream);
    const recorder = mountVoiceNoteRecorderHarness();
    await recorder.start();
    const mediaRecorder = FakeMediaRecorder.instances[0]!;
    const cleanup = reactHarness.cleanups.at(-1)!;
    cleanup();

    expect(mediaRecorder.state).toBe('inactive');
    expect(microphone.stop).toHaveBeenCalled();
  });
});

describe('voiceNoteRecorderErrorCode', () => {
  const namedError = (name: string) => Object.assign(new Error(name), { name });

  it('maps browser permission and device errors to actionable codes', () => {
    expect(voiceNoteRecorderErrorCode(namedError('NotAllowedError'))).toBe(
      'permission-denied',
    );
    expect(voiceNoteRecorderErrorCode(namedError('NotFoundError'))).toBe(
      'microphone-not-found',
    );
    expect(voiceNoteRecorderErrorCode(namedError('NotReadableError'))).toBe(
      'microphone-busy',
    );
    expect(voiceNoteRecorderErrorCode(namedError('NotSupportedError'))).toBe(
      'unsupported',
    );
    expect(voiceNoteRecorderErrorCode(new Error('unknown'))).toBe(
      'recording-failed',
    );
  });
});
