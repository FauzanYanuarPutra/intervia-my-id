import type { ReactNode } from 'react';

export type UsahaSetupStep = {
  label: string;
  active?: boolean;
  done?: boolean;
};

export type UsahaSetupFlowProps = {
  actions: ReactNode;
  desc: string;
  eyebrow: string;
  steps: UsahaSetupStep[];
  title: string;
};
