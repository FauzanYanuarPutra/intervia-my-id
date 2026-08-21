'use client';

import React from 'react';
import { Skeleton as UISkeleton, SkeletonPanel } from '@/components/ui/Skeleton';
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
      : variant === 'rounded'
        ? 'block'
        : variant === 'rectangular'
          ? 'block'
          : 'line';

  return (
    <UISkeleton
      aria-hidden="true"
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

export function CardSkeleton() {
  return (
    <SkeletonPanel className="p-4">
      <Skeleton variant="rounded" className="w-full h-40 mb-4" />
      <Skeleton variant="text" className="h-4 w-3/4 mb-2" />
      <Skeleton variant="text" className="h-3 w-1/2 mb-4" />
      <div className="flex gap-2">
        <Skeleton variant="rounded" className="h-6 w-16" />
        <Skeleton variant="rounded" className="h-6 w-16" />
      </div>
    </SkeletonPanel>
  );
}

export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b border-[color:var(--app-border)] p-4 dark:border-[color:var(--app-border-strong)]">
      <Skeleton variant="circular" width={48} height={48} />
      <div className="flex-1">
        <Skeleton variant="text" className="h-4 w-1/3 mb-2" />
        <Skeleton variant="text" className="h-3 w-2/3" />
      </div>
      <Skeleton variant="rounded" className="h-8 w-20" />
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Skeleton variant="circular" width={80} height={80} />
        <div className="flex-1">
          <Skeleton variant="text" className="h-6 w-1/3 mb-2" />
          <Skeleton variant="text" className="h-4 w-1/4" />
        </div>
      </div>
      <Skeleton variant="rounded" className="h-24 w-full mb-4" />
      <div className="grid grid-cols-3 gap-4">
        <Skeleton variant="rounded" className="h-20" />
        <Skeleton variant="rounded" className="h-20" />
        <Skeleton variant="rounded" className="h-20" />
      </div>
    </div>
  );
}

export function ChatListSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 8 }).map((_, i) => (
        <ListItemSkeleton key={i} />
      ))}
    </div>
  );
}

export function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton variant="circular" width={40} height={40} />
            <div>
              <Skeleton variant="text" className="h-4 w-32 mb-1" />
              <Skeleton variant="text" className="h-3 w-20" />
            </div>
          </div>
          <Skeleton variant="text" className="h-4 w-full mb-2" />
          <Skeleton variant="text" className="h-4 w-3/4 mb-4" />
          <Skeleton variant="rounded" className="h-48 w-full mb-4" />
          <div className="flex gap-4">
            <Skeleton variant="rounded" className="h-8 w-20" />
            <Skeleton variant="rounded" className="h-8 w-20" />
            <Skeleton variant="rounded" className="h-8 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
      <div className="flex gap-4 border-b border-[color:var(--app-border)] p-4 dark:border-[color:var(--app-border-strong)]">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} variant="text" className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 border-b border-[color:var(--app-border)] p-4 dark:border-[color:var(--app-border-strong)]">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} variant="text" className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
