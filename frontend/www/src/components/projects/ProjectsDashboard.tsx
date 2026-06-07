'use client';

import React from 'react';
import Link from 'next/link';

const PROJECTS = [
  {
    name: 'IKN Tower Crane Deployment',
    status: 'Active',
    progress: 65,
    budget: 'Rp 1.2B',
    next: 'Milestone 3 approval',
  },
  {
    name: 'Solar Panel Off-Grid Setup',
    status: 'Negotiation',
    progress: 25,
    budget: 'Rp 350jt',
    next: 'Contract draft',
  },
  {
    name: 'Logistics Fleet Expansion',
    status: 'Completed',
    progress: 100,
    budget: 'Rp 800jt',
    next: 'Final review',
  },
];

export default function ProjectsDashboard() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[color:var(--app-accent)]">
            Projects Hub
          </p>
          <h1 className="text-3xl font-black tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            Track milestones and escrow status in one view.
          </h1>
          <p className="mt-2 text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
            Setiap project terhubung ke chat, kontrak, dan escrow.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/chat"
            className="rounded-full border border-[color:var(--app-border)] dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] bg-[color:var(--app-surface-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_5%,_transparent)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]"
          >
            Open Rooms
          </Link>
          <button className="rounded-full bg-[color:var(--app-accent)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--app-text-inverse)]">
            New Project
          </button>
        </div>
      </header>

      <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {PROJECTS.map(project => (
          <div
            key={project.name}
            className="rounded-2xl border border-[color:var(--app-border)] dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] bg-[color:var(--app-surface-strong)] dark:bg-[color:var(--app-surface-strong)] p-5 shadow-sm"
          >
            <p className="text-xs font-bold text-[color:var(--app-accent)] uppercase tracking-widest">
              {project.status}
            </p>
            <h2 className="mt-2 text-lg font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              {project.name}
            </h2>
            <p className="mt-1 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
              Budget: {project.budget}
            </p>

            <div className="mt-4 h-2 w-full rounded-full bg-[color:var(--app-surface-muted)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_5%,_transparent)]">
              <div
                className="h-2 rounded-full bg-[color:var(--app-accent)]"
                style={{ width: `${project.progress}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
              Next: {project.next}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
