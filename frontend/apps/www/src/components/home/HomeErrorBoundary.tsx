'use client';

import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from 'react';

type HomeErrorBoundaryProps = {
  children: ReactNode;
  locale: string;
  section?: string;
};

type HomeErrorBoundaryState = {
  hasError: boolean;
};

function safeLocale(locale: string): 'id' | 'en' {
  return locale === 'en' ? 'en' : 'id';
}

export class HomeErrorBoundary extends Component<
  HomeErrorBoundaryProps,
  HomeErrorBoundaryState
> {
  state: HomeErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): HomeErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep production UI safe without exposing stack traces to visitors.
    console.error('[HOME_RENDER_ERROR]', {
      message: error?.message || 'Unknown Home render error',
      digest: (error as Error & { digest?: string })?.digest || null,
      section: this.props.section || 'home',
      componentStack: info.componentStack,
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const isId = safeLocale(this.props.locale) === 'id';
    const label = this.props.section || (isId ? 'Bagian Home' : 'Home section');

    return (
      <section
        className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm"
        role="status"
        aria-live="polite"
      >
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold text-slate-900">
              {isId ? 'Bagian ini sedang diperbaiki' : 'This section needs a retry'}
            </p>
            <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">
              {label}
            </p>
          </div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="min-h-8 shrink-0 rounded-full bg-slate-900 px-3 text-[10px] font-bold text-white transition hover:bg-slate-800"
          >
            {isId ? 'Coba lagi' : 'Retry'}
          </button>
        </div>
      </section>
    );
  }
}
