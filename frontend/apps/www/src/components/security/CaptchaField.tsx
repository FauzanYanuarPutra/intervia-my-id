'use client';

import { useEffect, useMemo, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, opts: Record<string, unknown>) => string;
      remove?: (widgetId: string) => void;
    };
    hcaptcha?: {
      render: (container: HTMLElement, opts: Record<string, unknown>) => string;
      remove?: (widgetId: string) => void;
    };
  }
}

type CaptchaProvider = 'turnstile' | 'hcaptcha';

function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      if (existing.getAttribute('data-loaded') === 'true') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('captcha_script_failed')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.setAttribute('data-loaded', 'true');
      resolve();
    };
    script.onerror = () => reject(new Error('captcha_script_failed'));
    document.head.appendChild(script);
  });
}

export function CaptchaField(props: {
  action: string;
  onTokenChange: (token: string) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  const provider =
    (process.env.NEXT_PUBLIC_CAPTCHA_PROVIDER?.toLowerCase() as CaptchaProvider | undefined) ||
    'turnstile';

  const siteKey =
    provider === 'hcaptcha'
      ? process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY
      : process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const scriptSrc = useMemo(() => {
    if (provider === 'hcaptcha') {
      return 'https://js.hcaptcha.com/1/api.js?render=explicit';
    }
    return 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  }, [provider]);

  useEffect(() => {
    let cancelled = false;

    const mountWidget = async () => {
      if (!siteKey || !containerRef.current) return;

      try {
        await loadScript(scriptSrc, `captcha-script-${provider}`);
        if (cancelled || !containerRef.current) return;

        if (provider === 'hcaptcha' && window.hcaptcha) {
          widgetIdRef.current = window.hcaptcha.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token: string) => props.onTokenChange(token),
            'expired-callback': () => props.onTokenChange(''),
            'error-callback': () => props.onTokenChange(''),
          });
          return;
        }

        if (provider === 'turnstile' && window.turnstile) {
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            action: props.action,
            callback: (token: string) => props.onTokenChange(token),
            'expired-callback': () => props.onTokenChange(''),
            'error-callback': () => props.onTokenChange(''),
          });
        }
      } catch {
        props.onTokenChange('');
      }
    };

    void mountWidget();

    return () => {
      cancelled = true;
      if (widgetIdRef.current && provider === 'turnstile' && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
      }
      if (widgetIdRef.current && provider === 'hcaptcha' && window.hcaptcha?.remove) {
        window.hcaptcha.remove(widgetIdRef.current);
      }
    };
  }, [props.action, props.onTokenChange, provider, scriptSrc, siteKey]);

  if (!siteKey) {
    return null;
  }

  return <div ref={containerRef} className={props.className} />;
}