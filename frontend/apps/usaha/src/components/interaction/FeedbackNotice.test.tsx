import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FeedbackNotice } from './FeedbackNotice';

describe('FeedbackNotice', () => {
  it('announces errors assertively', () => {
    const html = renderToStaticMarkup(<FeedbackNotice message="Gagal" tone="error" />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
  });

  it('announces success politely', () => {
    const html = renderToStaticMarkup(<FeedbackNotice message="Tersimpan" tone="success" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });
});
