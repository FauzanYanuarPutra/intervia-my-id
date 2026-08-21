declare module 'next-pwa' {
  import { NextConfig } from 'next';

  export interface PWAConfig {
    dest?: string;
    register?: boolean;
    skipWaiting?: boolean;
    disable?: boolean;
    sw?: string;
    fallbacks?: Record<string, any>;
    scope?: string;
    // bisa tambah opsi lain jika perlu
  }

  function withPWA(config: NextConfig & PWAConfig): NextConfig;
  export default withPWA;
}
