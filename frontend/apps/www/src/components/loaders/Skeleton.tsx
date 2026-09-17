'use client';

import React from 'react';
import {
  Skeleton as UISkeleton,
  SkeletonGroup,
  SkeletonPanel,
} from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  className,
  variant = 'text',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;
  const pulse = animation !== 'none';
  const uiVariant =
    variant === 'circular'
      ? 'circle'
      : variant === 'text'
        ? 'line'
        : 'block';

  return (
    <UISkeleton
      variant={uiVariant}
      pulse={pulse}
      className={cn(
        variant === 'rounded' && 'rounded-xl',
        variant === 'rectangular' && 'rounded-none',
        variant === 'text' && 'rounded',
        className,
      )}
      style={style}
    />
  );
}

export function CardSkeleton({
  mediaClassName = 'aspect-[4/3]',
}: {
  mediaClassName?: string;
}) {
  return (
    <SkeletonPanel className="p-4">
      <Skeleton
        variant="rounded"
        className={cn('mb-4 w-full', mediaClassName)}
      />
      <Skeleton variant="text" className="mb-2 h-4 w-3/4" />
      <Skeleton variant="text" className="mb-4 h-3 w-1/2" />
      <div className="flex gap-2">
        <Skeleton variant="rounded" className="h-8 w-20" />
        <Skeleton variant="rounded" className="h-8 w-16" />
      </div>
    </SkeletonPanel>
  );
}

export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b border-[color:var(--app-border)] px-3 py-3 dark:border-[color:var(--app-border-strong)] sm:gap-4 sm:px-4">
      <Skeleton variant="circular" width={44} height={44} />
      <div className="min-w-0 flex-1">
        <Skeleton variant="text" className="mb-2 h-4 w-1/3" />
        <Skeleton variant="text" className="h-3 w-2/3" />
      </div>
      <Skeleton variant="rounded" className="h-9 w-20 shrink-0" />
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <SkeletonGroup label="Memuat profil" className="p-4 sm:p-6">
      <div className="mb-6 flex items-center gap-4">
        <Skeleton variant="circular" width={72} height={72} />
        <div className="min-w-0 flex-1">
          <Skeleton variant="text" className="mb-2 h-6 w-1/3" />
          <Skeleton variant="text" className="h-4 w-1/4" />
        </div>
      </div>
      <div className="mb-5 space-y-2">
        <Skeleton variant="text" className="h-4 w-full" />
        <Skeleton variant="text" className="h-4 w-2/3" />
      </div>
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} variant="rounded" className="h-16 sm:h-20" />
        ))}
      </div>
    </SkeletonGroup>
  );
}

export function ChatListSkeleton() {
  return (
    <SkeletonGroup label="Memuat percakapan" className="space-y-0">
      {Array.from({ length: 5 }).map((_, index) => (
        <ListItemSkeleton key={index} />
      ))}
    </SkeletonGroup>
  );
}

export function FeedSkeleton() {
  return (
    <SkeletonGroup label="Memuat linimasa" className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          data-feed-skeleton-item="true"
          className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 dark:border-[color:var(--app-border-strong)]"
        >
          <div className="mb-4 flex items-center gap-3">
            <Skeleton variant="circular" width={44} height={44} />
            <div className="min-w-0 flex-1">
              <Skeleton variant="text" className="mb-1.5 h-4 w-32" />
              <Skeleton variant="text" className="h-3 w-20" />
            </div>
            <Skeleton variant="circular" width={32} height={32} />
          </div>
          <Skeleton variant="text" className="mb-2 h-4 w-5/6" />
          <Skeleton variant="text" className="mb-2 h-4 w-full" />
          <Skeleton variant="text" className="mb-4 h-4 w-2/3" />
          <Skeleton
            variant="rounded"
            className="mb-4 aspect-video w-full rounded-xl"
          />
          <div className="flex gap-3">
            {Array.from({ length: 3 }).map((_, actionIndex) => (
              <Skeleton
                key={actionIndex}
                variant="rounded"
                className="h-9 w-20"
              />
            ))}
          </div>
        </div>
      ))}
    </SkeletonGroup>
  );
}

export function TableSkeleton({
  rows = 5,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  const safeRows = Math.max(1, Math.min(8, rows));
  const safeCols = Math.max(1, Math.min(6, cols));

  return (
    <SkeletonGroup
      label="Memuat tabel"
      className="overflow-hidden rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] dark:border-[color:var(--app-border-strong)]"
    >
      <div className="flex gap-4 border-b border-[color:var(--app-border)] p-4 dark:border-[color:var(--app-border-strong)]">
        {Array.from({ length: safeCols }).map((_, index) => (
          <Skeleton key={index} variant="text" className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: safeRows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          data-table-skeleton-row="true"
          className="flex gap-4 border-b border-[color:var(--app-border)] p-4 last:border-b-0 dark:border-[color:var(--app-border-strong)]"
        >
          {Array.from({ length: safeCols }).map((_, colIndex) => (
            <Skeleton key={colIndex} variant="text" className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </SkeletonGroup>
  );
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  const safeCount = Math.max(1, Math.min(6, count));

  return (
    <SkeletonGroup
      label="Memuat daftar"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: safeCount }).map((_, index) => (
        <div key={index} data-grid-skeleton-item="true">
          <CardSkeleton />
        </div>
      ))}
    </SkeletonGroup>
  );
}
