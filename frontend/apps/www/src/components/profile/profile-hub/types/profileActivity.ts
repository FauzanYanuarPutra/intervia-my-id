import type { ComponentType } from 'react';

export type StatItem = {
  label: string;
  value: string | number;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
};

export type SetupCard = {
  key: string;
  title: string;
  description: string;
  href: string;
  progress: number;
  total: number;
};

