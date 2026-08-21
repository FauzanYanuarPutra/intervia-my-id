import { describe, expect, it } from 'vitest';
import { serializeJsonLd } from './jsonLd';

describe('serializeJsonLd', () => {
  it('preserves data while preventing script-tag breakout', () => {
    const value = {
      name: '</script><script>alert("xss")</script>',
      note: 'A & B',
    };
    const serialized = serializeJsonLd(value);

    expect(serialized).not.toContain('</script>');
    expect(serialized).toContain('\\u003c/script\\u003e');
    expect(JSON.parse(serialized)).toEqual(value);
  });
});
