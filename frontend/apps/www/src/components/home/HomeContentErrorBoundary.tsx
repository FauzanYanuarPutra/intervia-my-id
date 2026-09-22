'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  locale: string;
  children: ReactNode;
};

type State = {
  failed: boolean;
};

export class HomeContentErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[HOME_CONTENT_BOUNDARY]', {
      message: error?.message,
      stack: error?.stack,
      componentStack: info.componentStack,
    });
  }

  reset = () => {
    this.setState({ failed: false });
  };

  render() {
    if (!this.state.failed) return this.props.children;

    const locale = this.props.locale === 'en' ? 'en' : 'id';
    const isId = locale === 'id';

    return (
      <main className="grid min-h-[70svh] place-items-center px-4 py-10 sm:px-6">
        <section
          role="alert"
          className="w-full max-w-md rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-6 text-center shadow-sm"
        >
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
            <span className="text-2xl font-black">L</span>
          </div>

          <h1 className="mt-4 text-lg font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            {isId ? 'Beranda belum bisa ditampilkan' : 'Home could not be displayed'}
          </h1>

          <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
            {isId
              ? 'Salah satu bagian beranda mengalami masalah. Kamu tetap bisa mencoba memuat ulang tanpa kehilangan halaman.'
              : 'One part of the home page failed. You can retry without leaving the page.'}
          </p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={this.reset}
              className="min-h-11 flex-1 rounded-full bg-[color:var(--app-accent)] px-4 text-sm font-black text-[color:var(--app-text-inverse)]"
            >
              {isId ? 'Coba lagi' : 'Try again'}
            </button>
            <a
              href={`/${locale}/home`}
              className="min-h-11 flex-1 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-4 py-2.5 text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]"
            >
              {isId ? 'Muat ulang halaman' : 'Reload page'}
            </a>
          </div>
        </section>
      </main>
    );
  }
}
