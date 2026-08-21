import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { VoiceNoteRecorder } from './VoiceNoteRecorder';

describe('VoiceNoteRecorder', () => {
  it('renders an accessible Indonesian 44px recording trigger', () => {
    const html = renderToStaticMarkup(
      <VoiceNoteRecorder locale="id" onSubmit={() => undefined} />,
    );

    expect(html).toContain('aria-label="Rekam pesan suara"');
    expect(html).toContain('h-11');
    expect(html).toContain('w-11');
    expect(html).toContain('type="button"');
  });

  it('provides equivalent English labeling', () => {
    const html = renderToStaticMarkup(
      <VoiceNoteRecorder locale="en" onSubmit={() => undefined} />,
    );

    expect(html).toContain('aria-label="Record a voice message"');
  });
});
