'use client';

import React from 'react';
import { Card as SharedCard, CardHeader, CardContent, CardTitle } from 'lajukan-ui';

type Props = React.HTMLAttributes<HTMLDivElement> & {
  title?: string;
  children: React.ReactNode;
};

export function Card({ title, children, className = '', ...rest }: Props) {
  const baseClass = 'glass-panel rounded-3xl';
  return (
    <SharedCard className={`${baseClass} ${className}`.trim()} {...rest}>
      {title ? (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className={title ? 'pt-0' : undefined}>{children}</CardContent>
    </SharedCard>
  );
}