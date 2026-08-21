import { describe, expect, it } from 'vitest';

import {
  hasExpectedFileSignature,
  storeValidatedUploads,
  validateUploadCandidate,
} from './uploadFiles';

function candidate(name: string, type: string, contents = 'test') {
  return new File([contents], name, { type });
}

describe('upload validation', () => {
  it('accepts known image and document pairs', () => {
    expect(
      validateUploadCandidate(candidate('photo.jpg', 'image/jpeg'), {
        accept: 'image',
        maxBytes: 1024,
      }),
    ).toBe('');
    expect(
      validateUploadCandidate(candidate('brief.pdf', 'application/pdf'), {
        accept: 'document',
        maxBytes: 1024,
      }),
    ).toBe('');
  });

  it('rejects active content and extension spoofing', () => {
    expect(
      validateUploadCandidate(candidate('payload.html', 'text/plain'), {
        accept: 'document',
        maxBytes: 1024,
      }),
    ).toBe('file type is not allowed');
    expect(
      validateUploadCandidate(candidate('vector.svg', 'image/svg+xml'), {
        accept: 'image',
        maxBytes: 1024,
      }),
    ).toBe('file type is not allowed');
    expect(
      validateUploadCandidate(candidate('photo.jpg', 'text/html'), {
        accept: 'image',
        maxBytes: 1024,
      }),
    ).toBe('file type is not allowed');
  });

  it('checks signatures for commonly rendered formats', () => {
    expect(
      hasExpectedFileSignature(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), '.jpg'),
    ).toBe(true);
    expect(
      hasExpectedFileSignature(
        Buffer.from('<script>alert(1)</script>'),
        '.jpg',
      ),
    ).toBe(false);
    expect(hasExpectedFileSignature(Buffer.from('%PDF-1.7\n'), '.pdf')).toBe(
      true,
    );
  });

  it('accepts MediaRecorder WebM, Ogg, and M4A MIME variants', () => {
    expect(
      validateUploadCandidate(
        candidate('voice-note.webm', 'audio/webm;codecs=opus'),
        {
          accept: 'media',
          maxBytes: 1024,
        },
      ),
    ).toBe('');
    expect(
      validateUploadCandidate(
        candidate('voice-note.ogg', 'audio/ogg;codecs=opus'),
        {
          accept: 'media',
          maxBytes: 1024,
        },
      ),
    ).toBe('');
    expect(
      validateUploadCandidate(
        candidate('voice-note.ogg', 'application/ogg;codecs=opus'),
        {
          accept: 'media',
          maxBytes: 1024,
        },
      ),
    ).toBe('');
    expect(
      validateUploadCandidate(
        candidate('voice-note.m4a', 'audio/mp4;codecs=mp4a.40.2'),
        {
          accept: 'media',
          maxBytes: 1024,
        },
      ),
    ).toBe('');
    expect(
      validateUploadCandidate(candidate('voice-note.m4a', 'audio/m4a'), {
        accept: 'media',
        maxBytes: 1024,
      }),
    ).toBe('');
  });

  it('checks MediaRecorder container signatures', () => {
    expect(
      hasExpectedFileSignature(
        Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f]),
        '.webm',
      ),
    ).toBe(true);
    expect(hasExpectedFileSignature(Buffer.from('not-webm'), '.webm')).toBe(
      false,
    );
    expect(
      hasExpectedFileSignature(Buffer.from('OggS\u0000\u0002'), '.ogg'),
    ).toBe(true);
    expect(hasExpectedFileSignature(Buffer.from('not-ogg'), '.ogg')).toBe(
      false,
    );
    expect(
      hasExpectedFileSignature(
        Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]),
        '.m4a',
      ),
    ).toBe(true);
    expect(hasExpectedFileSignature(Buffer.from('not-an-m4a'), '.m4a')).toBe(
      false,
    );
  });

  it('rejects a spoofed voice-note container before storage', async () => {
    const result = await storeValidatedUploads(
      [candidate('voice-note.webm', 'audio/webm', 'plain text')],
      {
        accept: 'media',
        folder: 'test',
        maxBytes: 1024,
        minioTarget: 'test',
      },
    );

    expect(result.uploaded).toEqual([]);
    expect(result.rejected).toEqual([
      {
        name: 'voice-note.webm',
        reason: 'file content does not match its extension',
      },
    ]);
  });

  it('applies the stricter audio-specific size limit', () => {
    const audio = new File(
      [new Uint8Array(2 * 1024 * 1024)],
      'voice-note.webm',
      { type: 'audio/webm' },
    );

    expect(
      validateUploadCandidate(audio, {
        accept: 'media',
        maxBytes: 10 * 1024 * 1024,
        maxBytesByType: { audio: 1024 * 1024 },
      }),
    ).toBe('file too large (max 1MB)');

    const ogg = new File(
      [new Uint8Array(2 * 1024 * 1024)],
      'voice-note.ogg',
      { type: 'application/ogg;codecs=opus' },
    );
    expect(
      validateUploadCandidate(ogg, {
        accept: 'media',
        maxBytes: 10 * 1024 * 1024,
        maxBytesByType: { audio: 1024 * 1024 },
      }),
    ).toBe('file too large (max 1MB)');

    const unknownMimeAudio = new File(
      [new Uint8Array(2 * 1024 * 1024)],
      'voice-note.m4a',
      { type: 'application/octet-stream' },
    );
    expect(
      validateUploadCandidate(unknownMimeAudio, {
        accept: 'media',
        maxBytes: 10 * 1024 * 1024,
        maxBytesByType: { audio: 1024 * 1024 },
      }),
    ).toBe('file too large (max 1MB)');

    const video = new File(
      [new Uint8Array(2 * 1024 * 1024)],
      'clip.webm',
      { type: 'video/webm' },
    );
    expect(
      validateUploadCandidate(video, {
        accept: 'media',
        maxBytes: 10 * 1024 * 1024,
        maxBytesByType: { audio: 1024 * 1024 },
      }),
    ).toBe('');
  });
});
