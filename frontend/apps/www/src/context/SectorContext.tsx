'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Building2, type LucideIcon } from 'lucide-react';
import { SECTORS, type Sector as StaticSector } from '@/data/sectors';

type CmsSector = {
  id: string;
  name_id?: string | null;
  name_en?: string | null;
  description_id?: string | null;
  description_en?: string | null;
  color?: string | null;
  icon_key?: string | null;
  is_active?: boolean;
  sort_order?: number | null;
};

export type SectorView = {
  id: string;
  nameId: string;
  nameEn: string;
  descriptionId?: string | null;
  descriptionEn?: string | null;
  color?: string | null;
  colorClass: string;
  colorStyle?: CSSProperties;
  iconKey?: string | null;
  icon: LucideIcon;
  isActive: boolean;
  sortOrder: number;
  source: 'cms' | 'static';
};

type SectorContextValue = {
  sectors: SectorView[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getSectorById: (id?: string | null) => SectorView | null;
};

const SectorContext = createContext<SectorContextValue | undefined>(undefined);

const DEFAULT_COLOR_CLASS = 'bg-[color:var(--app-surface)]';
const DEFAULT_ICON: LucideIcon = Building2;

const staticMap = new Map<string, StaticSector>();
const iconMap = new Map<string, LucideIcon>();

function normalizeKey(value?: string | null): string {
  if (!value) return '';
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

for (const sector of SECTORS) {
  staticMap.set(sector.id, sector);
  iconMap.set(normalizeKey(sector.id), sector.icon);
  iconMap.set(normalizeKey(sector.nameEn), sector.icon);
  iconMap.set(normalizeKey(sector.nameId), sector.icon);
}

function resolveIcon(iconKey?: string | null, fallback?: StaticSector): LucideIcon {
  const key = normalizeKey(iconKey);
  if (key && iconMap.has(key)) return iconMap.get(key) as LucideIcon;
  if (fallback?.icon) return fallback.icon;
  return DEFAULT_ICON;
}

function resolveText(value?: string | null, fallback = ''): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return fallback;
}

function resolveColor(value?: string | null, fallback?: string | null): { className: string; style?: CSSProperties } {
  const raw = (value || fallback || '').trim();
  if (!raw) return { className: DEFAULT_COLOR_CLASS };
  const lower = raw.toLowerCase();
  if (lower.startsWith('#') || lower.startsWith('rgb') || lower.startsWith('hsl')) {
    return { className: '', style: { backgroundColor: raw } };
  }
  return { className: raw };
}

function toStaticView(sector: StaticSector): SectorView {
  const color = sector.color || DEFAULT_COLOR_CLASS;
  const colorMeta = resolveColor(color, DEFAULT_COLOR_CLASS);
  return {
    id: sector.id,
    nameId: sector.nameId,
    nameEn: sector.nameEn,
    descriptionId: sector.descId,
    descriptionEn: sector.descEn,
    color,
    colorClass: colorMeta.className,
    colorStyle: colorMeta.style,
    iconKey: sector.id,
    icon: sector.icon,
    isActive: true,
    sortOrder: 0,
    source: 'static',
  };
}

function toCmsView(sector: CmsSector): SectorView {
  const fallback = staticMap.get(sector.id);
  const nameId = resolveText(sector.name_id, fallback?.nameId || sector.id);
  const nameEn = resolveText(sector.name_en, fallback?.nameEn || nameId);
  const color = sector.color || fallback?.color || DEFAULT_COLOR_CLASS;
  const colorMeta = resolveColor(color, fallback?.color || DEFAULT_COLOR_CLASS);
  return {
    id: sector.id,
    nameId,
    nameEn,
    descriptionId: sector.description_id ?? fallback?.descId ?? null,
    descriptionEn: sector.description_en ?? fallback?.descEn ?? null,
    color,
    colorClass: colorMeta.className,
    colorStyle: colorMeta.style,
    iconKey: sector.icon_key ?? fallback?.id ?? null,
    icon: resolveIcon(sector.icon_key ?? sector.id, fallback),
    isActive: sector.is_active ?? true,
    sortOrder: sector.sort_order ?? 0,
    source: 'cms',
  };
}

function mergeSectors(cmsSectors: CmsSector[]): SectorView[] {
  const staticViews = SECTORS.map(toStaticView);
  if (!cmsSectors.length) {
    return staticViews;
  }

  const cmsViews = cmsSectors
    .map(toCmsView)
    .filter((sector) => sector.isActive);
  const cmsIds = new Set(cmsViews.map((sector) => sector.id));
  const fallback = staticViews.filter((sector) => !cmsIds.has(sector.id));
  const combined = [...cmsViews, ...fallback];

  return combined.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.nameEn.localeCompare(b.nameEn);
  });
}

export function getSectorLabel(sector: SectorView, locale: string): string {
  return locale === 'id' ? sector.nameId : sector.nameEn;
}

export function getSectorDescription(sector: SectorView, locale: string): string {
  const desc = locale === 'id' ? sector.descriptionId : sector.descriptionEn;
  return desc || '';
}

export function SectorProvider({ children }: { children: React.ReactNode }) {
  const [cmsSectors, setCmsSectors] = useState<CmsSector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sectors?active=true&limit=200', { cache: 'no-store' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = (payload as { error?: string })?.error || 'Failed to load sectors';
        throw new Error(message);
      }
      const items = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];
      setCmsSectors(items as CmsSector[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sectors');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const sectors = useMemo(() => mergeSectors(cmsSectors), [cmsSectors]);

  const getSectorById = useCallback(
    (id?: string | null) => {
      if (!id) return null;
      return sectors.find((sector) => sector.id === id) || null;
    },
    [sectors],
  );

  return (
    <SectorContext.Provider value={{ sectors, loading, error, refresh, getSectorById }}>
      {children}
    </SectorContext.Provider>
  );
}

export function useSectors() {
  const context = useContext(SectorContext);
  if (!context) {
    throw new Error('useSectors must be used within SectorProvider');
  }
  return context;
}