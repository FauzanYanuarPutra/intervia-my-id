import { describe, expect, it } from 'vitest';

import {
  createVoiceNoteFile,
  detectVoiceNoteContainer,
  formatVoiceNoteDuration,
  normalizeVoiceNoteMime,
  selectVoiceNoteMime,
} from './voiceNote';

describe('voice-note media helpers', () => {
  it('chooses the first supported recording format', () => {
    expect(
      selectVoiceNoteMime(mimeType => mimeType === 'audio/ogg;codecs=opus'),
    ).toBe('audio/ogg;codecs=opus');
    expect(
      selectVoiceNoteMime(
        mimeType => mimeType === 'audio/mp4;codecs=mp4a.40.2',
      ),
    ).toBe('audio/mp4;codecs=mp4a.40.2');
    expect(selectVoiceNoteMime(() => false)).toBe('');
  });

  it('detects WebM, Ogg, and MP4 containers from bytes', () => {
    expect(
      detectVoiceNoteContainer(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f])),
    ).toBe('webm');
    expect(
      detectVoiceNoteContainer(new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0, 2])),
    ).toBe('ogg');
    expect(
      detectVoiceNoteContainer(
        new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]),
      ),
    ).toBe('mp4');
    expect(detectVoiceNoteContainer(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });

  it('normalizes codec parameters without changing the media family', () => {
    expect(normalizeVoiceNoteMime(' Audio/WebM;Codecs=Opus ')).toBe(
      'audio/webm',
    );
    expect(normalizeVoiceNoteMime('audio/mp4;codecs=mp4a.40.2')).toBe(
      'audio/mp4',
    );
  });

  it('creates a canonical File only when MIME and signature agree', async () => {
    const file = await createVoiceNoteFile(
      new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f])], {
        type: 'audio/webm;codecs=opus',
      }),
      { now: 1234 },
    );

    expect(file.name).toBe('voice-note-1234.webm');
    expect(file.type).toBe('audio/webm');
    expect(file.size).toBe(5);

    const oggFile = await createVoiceNoteFile(
      new Blob([new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0, 2])], {
        type: 'application/ogg;codecs=opus',
      }),
      { now: 2345 },
    );
    expect(oggFile.name).toBe('voice-note-2345.ogg');
    expect(oggFile.type).toBe('audio/ogg');

    const m4aFile = await createVoiceNoteFile(
      new Blob(
        [
          new Uint8Array([
            0,
            0,
            0,
            24,
            0x66,
            0x74,
            0x79,
            0x70,
            0x4d,
            0x34,
            0x41,
            0x20,
          ]),
        ],
        { type: 'audio/mp4;codecs=mp4a.40.2' },
      ),
      { now: 3456 },
    );
    expect(m4aFile.name).toBe('voice-note-3456.m4a');
    expect(m4aFile.type).toBe('audio/mp4');

    const m4aAliasFile = await createVoiceNoteFile(
      new Blob(
        [new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70])],
        { type: 'audio/m4a' },
      ),
      { now: 3457 },
    );
    expect(m4aAliasFile.name).toBe('voice-note-3457.m4a');
    expect(m4aAliasFile.type).toBe('audio/mp4');

    await expect(
      createVoiceNoteFile(
        new Blob([new Uint8Array([0x4f, 0x67, 0x67, 0x53])], {
          type: 'audio/webm',
        }),
      ),
    ).rejects.toMatchObject({
      code: 'mime-mismatch',
    });
  });

  it('uses a detected supported container when a browser omits Blob.type', async () => {
    const file = await createVoiceNoteFile(
      new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f])]),
      { now: 4567 },
    );

    expect(file.name).toBe('voice-note-4567.webm');
    expect(file.type).toBe('audio/webm');
  });

  it('rejects empty, unknown, and oversized recordings', async () => {
    await expect(createVoiceNoteFile(new Blob([]))).rejects.toMatchObject({
      code: 'empty',
    });
    await expect(
      createVoiceNoteFile(new Blob(['plain text'], { type: 'audio/webm' })),
    ).rejects.toMatchObject({ code: 'unsupported-format' });
    await expect(
      createVoiceNoteFile(
        new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f])], {
          type: 'audio/webm',
        }),
        { maxBytes: 4 },
      ),
    ).rejects.toMatchObject({ code: 'too-large' });
  });

  it('formats a stable recording duration', () => {
    expect(formatVoiceNoteDuration(0)).toBe('0:00');
    expect(formatVoiceNoteDuration(65_900)).toBe('1:05');
  });
});
