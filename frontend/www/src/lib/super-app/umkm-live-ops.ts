export type UmkmLocationMode = 'fixed' | 'mobile';

export type UmkmLiveScheduleDay =
  | 'mon'
  | 'tue'
  | 'wed'
  | 'thu'
  | 'fri'
  | 'sat'
  | 'sun';

export const UMKM_LIVE_SCHEDULE_DAY_OPTIONS: Array<{
  id: UmkmLiveScheduleDay;
  shortId: string;
  shortEn: string;
  labelId: string;
  labelEn: string;
}> = [
  { id: 'mon', shortId: 'Sen', shortEn: 'Mon', labelId: 'Senin', labelEn: 'Monday' },
  { id: 'tue', shortId: 'Sel', shortEn: 'Tue', labelId: 'Selasa', labelEn: 'Tuesday' },
  { id: 'wed', shortId: 'Rab', shortEn: 'Wed', labelId: 'Rabu', labelEn: 'Wednesday' },
  { id: 'thu', shortId: 'Kam', shortEn: 'Thu', labelId: 'Kamis', labelEn: 'Thursday' },
  { id: 'fri', shortId: 'Jum', shortEn: 'Fri', labelId: 'Jumat', labelEn: 'Friday' },
  { id: 'sat', shortId: 'Sab', shortEn: 'Sat', labelId: 'Sabtu', labelEn: 'Saturday' },
  { id: 'sun', shortId: 'Min', shortEn: 'Sun', labelId: 'Minggu', labelEn: 'Sunday' },
];

function hasOwn(meta: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(meta, key);
}

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readBool(value: unknown, fallback = false): boolean {
  if (value === true) return true;
  if (value === false) return false;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
}

function normalizeScheduleDayToken(value: string): UmkmLiveScheduleDay | null {
  const token = value.trim().toLowerCase();
  if (!token) return null;
  if (['mon', 'monday', 'sen', 'senin', '1'].includes(token)) return 'mon';
  if (['tue', 'tuesday', 'sel', 'selasa', '2'].includes(token)) return 'tue';
  if (['wed', 'wednesday', 'rab', 'rabu', '3'].includes(token)) return 'wed';
  if (['thu', 'thursday', 'kam', 'kamis', '4'].includes(token)) return 'thu';
  if (['fri', 'friday', 'jum', 'jumat', '5'].includes(token)) return 'fri';
  if (['sat', 'saturday', 'sab', 'sabtu', '6'].includes(token)) return 'sat';
  if (['sun', 'sunday', 'min', 'minggu', '0', '7'].includes(token)) return 'sun';
  return null;
}

function parseTimeToMinutes(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function getCurrentScheduleDay(now: Date): UmkmLiveScheduleDay {
  const day = now.getDay();
  if (day === 0) return 'sun';
  if (day === 1) return 'mon';
  if (day === 2) return 'tue';
  if (day === 3) return 'wed';
  if (day === 4) return 'thu';
  if (day === 5) return 'fri';
  return 'sat';
}

export function normalizeUmkmLocationMode(
  value: unknown,
  fallback: UmkmLocationMode = 'fixed',
): UmkmLocationMode {
  const normalized = readText(value).toLowerCase();
  if (
    ['mobile', 'moving', 'keliling', 'pkl', 'street_vendor', 'street', 'roving'].includes(
      normalized,
    )
  ) {
    return 'mobile';
  }
  if (
    ['fixed', 'storefront', 'toko', 'outlet', 'base', 'stationary'].includes(normalized)
  ) {
    return 'fixed';
  }
  return fallback;
}

export function parseUmkmLiveScheduleDays(value: unknown): UmkmLiveScheduleDay[] {
  const rawTokens = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\s]+/)
      : [];
  const unique = new Set<UmkmLiveScheduleDay>();
  for (const item of rawTokens) {
    const normalized = normalizeScheduleDayToken(typeof item === 'string' ? item : String(item));
    if (normalized) unique.add(normalized);
  }
  return UMKM_LIVE_SCHEDULE_DAY_OPTIONS.map((item) => item.id).filter((item) =>
    unique.has(item),
  );
}

export function getUmkmLocationModeLabel(mode: UmkmLocationMode, isId: boolean): string {
  if (mode === 'mobile') return isId ? 'Jualan keliling' : 'Mobile / moving';
  return isId ? 'Toko tetap' : 'Fixed location';
}

export function getUmkmLocationModeHint(mode: UmkmLocationMode, isId: boolean): string {
  if (mode === 'mobile') {
    return isId
      ? 'Pakai ini kalau jualannya pindah-pindah, misalnya booth event, bazaar, food truck, atau dagang keliling.'
      : 'Best for street vendors, event booths, bazaars, food trucks, or sellers whose selling point moves.';
  }
  return isId
    ? 'Pakai ini kalau usaha kamu punya titik tetap, misalnya toko, outlet, studio, workshop, atau rumah produksi.'
    : 'Best for shops, workshops, outlets, studios, production houses, or businesses with a stable base.';
}

export function formatUmkmLiveScheduleSummary(
  input: {
    days?: UmkmLiveScheduleDay[];
    start?: string | null;
    end?: string | null;
  },
  isId: boolean,
): string {
  const days = input.days || [];
  const start = readText(input.start);
  const end = readText(input.end);

  const dayLabel =
    days.length === UMKM_LIVE_SCHEDULE_DAY_OPTIONS.length
      ? isId
        ? 'Setiap hari'
        : 'Every day'
      : days.length > 0
        ? UMKM_LIVE_SCHEDULE_DAY_OPTIONS.filter((item) => days.includes(item.id))
            .map((item) => (isId ? item.shortId : item.shortEn))
            .join(', ')
        : '';

  const timeLabel = start && end ? `${start}-${end}` : '';
  return [dayLabel, timeLabel].filter(Boolean).join(' · ');
}

export function isUmkmLiveScheduleWindowOpen(input: {
  enabled?: boolean;
  days?: UmkmLiveScheduleDay[];
  start?: string | null;
  end?: string | null;
  now?: Date;
}): boolean {
  if (!input.enabled) return true;
  const days = input.days || [];
  const startMinutes = parseTimeToMinutes(readText(input.start));
  const endMinutes = parseTimeToMinutes(readText(input.end));
  if (days.length === 0 || startMinutes === null || endMinutes === null) return true;

  const now = input.now || new Date();
  const today = getCurrentScheduleDay(now);
  if (!days.includes(today)) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  if (endMinutes >= startMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}

export function getUmkmLivePresence(
  meta: Record<string, unknown>,
  options?: { now?: Date },
): {
  locationMode: UmkmLocationMode;
  outletActive: boolean;
  hasOutletActiveFlag: boolean;
  manualLive: boolean;
  hasManualLiveFlag: boolean;
  scheduleEnabled: boolean;
  scheduleDays: UmkmLiveScheduleDay[];
  scheduleStart: string;
  scheduleEnd: string;
  scheduleConfigured: boolean;
  scheduleOpenNow: boolean;
  scheduleSummary: string;
  hasPresenceControls: boolean;
  liveNow: boolean | null;
} {
  const locationMode = normalizeUmkmLocationMode(meta.location_mode);
  const hasOutletActiveFlag = hasOwn(meta, 'outlet_active');
  const outletActive = hasOutletActiveFlag ? readBool(meta.outlet_active, false) : true;
  const hasManualLiveFlag = hasOwn(meta, 'live_now');
  const manualLive = hasManualLiveFlag ? readBool(meta.live_now, false) : outletActive;
  const scheduleEnabled = readBool(meta.auto_live_schedule_enabled, false);
  const scheduleDays = parseUmkmLiveScheduleDays(meta.live_schedule_days);
  const scheduleStart = readText(meta.live_schedule_start);
  const scheduleEnd = readText(meta.live_schedule_end);
  const scheduleConfigured =
    scheduleEnabled && scheduleDays.length > 0 && Boolean(scheduleStart) && Boolean(scheduleEnd);
  const scheduleOpenNow = isUmkmLiveScheduleWindowOpen({
    enabled: scheduleEnabled,
    days: scheduleDays,
    start: scheduleStart,
    end: scheduleEnd,
    now: options?.now,
  });
  const hasPresenceControls =
    locationMode === 'mobile' || hasOutletActiveFlag || hasManualLiveFlag || scheduleEnabled;

  return {
    locationMode,
    outletActive,
    hasOutletActiveFlag,
    manualLive,
    hasManualLiveFlag,
    scheduleEnabled,
    scheduleDays,
    scheduleStart,
    scheduleEnd,
    scheduleConfigured,
    scheduleOpenNow,
    scheduleSummary: formatUmkmLiveScheduleSummary(
      { days: scheduleDays, start: scheduleStart, end: scheduleEnd },
      true,
    ),
    hasPresenceControls,
    liveNow: hasPresenceControls ? outletActive && manualLive && scheduleOpenNow : null,
  };
}
