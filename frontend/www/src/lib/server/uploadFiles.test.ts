import { describe, expect, it } from 'vitest';

import {
  hasExpectedFileSignature,
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
      hasExpectedFileSignature(
        Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
        '.jpg',
      ),
    ).toBe(true);
    expect(
      hasExpectedFileSignature(Buffer.from('<script>alert(1)</script>'), '.jpg'),
    ).toBe(false);
    expect(
      hasExpectedFileSignature(Buffer.from('%PDF-1.7\n'), '.pdf'),
    ).toBe(true);
  });
});
