import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PortalRouteError } from './PortalRouteError';

describe('PortalRouteError', () => {
  it('offers recovery without exposing the upstream error message', () => {
    const html = renderToStaticMarkup(
      <PortalRouteError
        error={new Error('identity-db-password=secret')}
        reset={() => undefined}
      />,
    );

    expect(html).toContain('Workspace belum bisa dimuat');
    expect(html).toContain('Coba lagi');
    expect(html).toContain('Kembali ke beranda');
    expect(html).not.toContain('identity-db-password');
  });
});
