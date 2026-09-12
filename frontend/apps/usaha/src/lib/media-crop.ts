export type BusinessMediaKind = 'logo' | 'banner' | 'product';

export type BusinessImageValue = {
  url: string;
  mimeType: string;
  width: number;
  height: number;
};

export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const PRESETS = {
  logo: { aspect: 1, width: 640, height: 640, label: 'Logo usaha (1:1)' },
  banner: { aspect: 8 / 3, width: 1600, height: 600, label: 'Banner usaha (8:3)' },
  product: { aspect: 1, width: 1200, height: 1200, label: 'Foto produk / menu (1:1)' },
} as const;

export function mediaCropPreset(kind: BusinessMediaKind) {
  return PRESETS[kind];
}

export function parseBusinessImageValue(value: unknown): BusinessImageValue | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const url = typeof input.url === 'string' ? input.url.trim() : '';
  const mimeTypeValue = input.mimeType ?? input.mime_type;
  const mimeType = typeof mimeTypeValue === 'string' ? mimeTypeValue.trim() : '';
  const width = typeof input.width === 'number' ? input.width : Number(input.width);
  const height = typeof input.height === 'number' ? input.height : Number(input.height);
  if (!url || !mimeType || !Number.isInteger(width) || !Number.isInteger(height)) return undefined;
  return { url, mimeType, width, height };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function computeCoverCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetAspect: number,
  zoom = 1,
  horizontalPosition = 0,
  verticalPosition = 0,
): CropRect {
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    !Number.isFinite(targetAspect) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    targetAspect <= 0
  ) {
    throw new Error('invalid_crop_dimensions');
  }

  const safeZoom = clamp(Number.isFinite(zoom) ? zoom : 1, 1, 4);
  const sourceAspect = sourceWidth / sourceHeight;
  const baseWidth = sourceAspect >= targetAspect ? sourceHeight * targetAspect : sourceWidth;
  const baseHeight = sourceAspect >= targetAspect ? sourceHeight : sourceWidth / targetAspect;
  const width = baseWidth / safeZoom;
  const height = baseHeight / safeZoom;
  const xRange = (sourceWidth - width) / 2;
  const yRange = (sourceHeight - height) / 2;

  return {
    x: sourceWidth / 2 - width / 2 + clamp(horizontalPosition, -1, 1) * xRange,
    y: sourceHeight / 2 - height / 2 + clamp(verticalPosition, -1, 1) * yRange,
    width,
    height,
  };
}
