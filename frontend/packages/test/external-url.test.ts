import { describe, expect, it } from 'vitest';

import {
  isSafeExternalHttpUrl,
  normalizeSafeExternalHttpUrl,
} from '../utils/externalUrl';

describe('external URL safety', () => {
  it('accepts ordinary public HTTP(S) URLs', () => {
    expect(isSafeExternalHttpUrl('https://www.bi.go.id/id/publikasi')).toBe(true);
    expect(normalizeSafeExternalHttpUrl('https://example.com/a b')).toBe(
      'https://example.com/a%20b',
    );
  });

  it('rejects local, private, credentialed, and special-use hosts', () => {
    for (const value of [
      'http://localhost:8080/private',
      'http://127.0.0.1/admin',
      'http://10.0.0.1/private',
      'http://100.64.0.1/private',
      'http://169.254.169.254/latest/meta-data',
      'http://172.16.0.1/private',
      'http://192.168.1.1/private',
      'http://192.0.2.1/example',
      'http://198.18.0.1/benchmark',
      'http://198.51.100.1/example',
      'http://203.0.113.1/example',
      'http://224.0.0.1/multicast',
      'http://[::1]/private',
      'http://[::ffff:127.0.0.1]/private',
      'http://[fc00::1]/private',
      'http://[fe80::1]/private',
      'http://[ff02::1]/multicast',
      'http://[2001:db8::1]/example',
      'https://user:pass@example.com/source',
      'file:///etc/passwd',
    ]) {
      expect(isSafeExternalHttpUrl(value), value).toBe(false);
    }
  });
});
