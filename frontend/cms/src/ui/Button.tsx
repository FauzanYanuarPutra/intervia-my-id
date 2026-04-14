'use client';

import React from 'react';
import { Button as SharedButton } from 'lajukan-ui';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: React.ReactNode;
};

const variantMap: Record<Variant, 'default' | 'secondary' | 'destructive' | 'ghost'> = {
  primary: 'default',
  secondary: 'secondary',
  danger: 'destructive',
  ghost: 'ghost',
};

export function Button({ variant = 'primary', children, ...props }: Props) {
  return (
    <SharedButton variant={variantMap[variant]} {...props}>
      {children}
    </SharedButton>
  );
}