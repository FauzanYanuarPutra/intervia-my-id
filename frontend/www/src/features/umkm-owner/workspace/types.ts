import type { ComponentType } from 'react';

export type UsahaWorkspaceIcon = ComponentType<{ className?: string }>;

export type UsahaWorkspaceHero = {
  eyebrow: string;
  title: string;
  desc: string;
  primaryLabel: string;
  primaryHref?: string;
  primaryTarget?: string;
  secondaryLabel: string;
  secondaryHref: string;
};

export type UsahaFlowStat = {
  label: string;
  value: number | string;
  desc: string;
};

export type UsahaFlowNavItem = {
  id: string;
  title: string;
  desc: string;
  badge: string;
  href: string;
  icon: UsahaWorkspaceIcon;
  selected: boolean;
};

export type UsahaWorkspaceNote = {
  tone: 'warning' | 'success';
  text: string;
};

export type UsahaWorkspaceStoreSummary = {
  name: string;
  summary: string;
};
