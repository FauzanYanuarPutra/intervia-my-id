import { normalizeAvatarSpec, readLajukanAvatarSpec } from './normalize';
import { DEFAULT_LAJUKAN_AVATAR } from './presets';
import { escapeXml, renderAvatarDefs, renderChibiAvatar } from './parts';
import type { LajukanAvatarSpec, LajukanAvatarStyle } from './types';

export function createLajukanAvatarSvg(
  value: Partial<LajukanAvatarStyle> = DEFAULT_LAJUKAN_AVATAR,
  label = 'Lajukan avatar',
): string {
  const spec = normalizeAvatarSpec(value);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="${escapeXml(label)}">${renderAvatarDefs(spec)}${renderChibiAvatar(spec)}</svg>`;
}

export function createLajukanAvatarDataUrl(
  value: Partial<LajukanAvatarStyle> = DEFAULT_LAJUKAN_AVATAR,
  label = 'Lajukan avatar',
): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    createLajukanAvatarSvg(value, label),
  )}`;
}

export function readLajukanAvatarFallbackSpec(
  value: unknown,
): LajukanAvatarSpec {
  return readLajukanAvatarSpec(value);
}

export function createLajukanAvatarFallbackDataUrl(
  value?: unknown,
  label = 'Lajukan avatar',
): string {
  return createLajukanAvatarDataUrl(
    value as Partial<LajukanAvatarStyle>,
    label,
  );
}
