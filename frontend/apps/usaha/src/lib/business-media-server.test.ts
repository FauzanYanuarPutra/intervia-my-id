import { describe, expect, it } from 'vitest';
import {
  isInternalBusinessMediaUrl,
  readBusinessImageDimensions,
} from './business-media-server';

function webpVp8x(width: number, height: number) {
  const bytes = new Uint8Array(30);
  bytes.set(new TextEncoder().encode('RIFF'), 0);
  bytes.set(new TextEncoder().encode('WEBP'), 8);
  bytes.set(new TextEncoder().encode('VP8X'), 12);
  const encodedWidth = width - 1;
  const encodedHeight = height - 1;
  bytes[24] = encodedWidth & 0xff;
  bytes[25] = (encodedWidth >> 8) & 0xff;
  bytes[26] = (encodedWidth >> 16) & 0xff;
  bytes[27] = encodedHeight & 0xff;
  bytes[28] = (encodedHeight >> 8) & 0xff;
  bytes[29] = (encodedHeight >> 16) & 0xff;
  return bytes;
}

function png(width: number, height: number) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set(new TextEncoder().encode('IHDR'), 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return bytes;
}

describe('business media storage contract', () => {
  it('accepts only the internal immutable forum media path', () => {
    expect(isInternalBusinessMediaUrl('/api/forum/media/forum-123-logo.webp')).toBe(true);
    expect(isInternalBusinessMediaUrl('https://attacker.example/logo.webp')).toBe(false);
    expect(isInternalBusinessMediaUrl('/api/forum/media/../secret')).toBe(false);
    expect(isInternalBusinessMediaUrl('/api/forum/media/logo.webp?token=secret')).toBe(false);
  });

  it('reads actual WebP VP8X dimensions instead of trusting request metadata', () => {
    expect(readBusinessImageDimensions(webpVp8x(1600, 600), 'image/webp')).toEqual({
      width: 1600,
      height: 600,
    });
  });

  it('reads actual PNG dimensions and rejects mismatched or invalid signatures', () => {
    expect(readBusinessImageDimensions(png(640, 640), 'image/png')).toEqual({
      width: 640,
      height: 640,
    });
    expect(readBusinessImageDimensions(png(640, 640), 'image/webp')).toBeNull();
    expect(readBusinessImageDimensions(new Uint8Array([1, 2, 3]), 'image/png')).toBeNull();
  });
});
