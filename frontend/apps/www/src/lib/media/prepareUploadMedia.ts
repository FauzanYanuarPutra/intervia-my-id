import {
  IMAGE_UPLOAD_MAX_DIMENSION,
  IMAGE_UPLOAD_MIN_BYTES_TO_COMPRESS,
  IMAGE_UPLOAD_MIN_QUALITY,
  IMAGE_UPLOAD_QUALITY,
  IMAGE_UPLOAD_TARGET_BYTES,
} from '@/lib/media/uploadStandard';

type PrepareUploadMediaOptions = {
  compressImages?: boolean;
  minBytesToCompress?: number;
  targetBytes?: number;
  maxImageDimension?: number;
  imageQuality?: number;
  minImageQuality?: number;
  backgroundColor?: string;
};

type ImageSource = {
  width: number;
  height: number;
  source: CanvasImageSource;
  release?: () => void;
};

const DEFAULT_OPTIONS: Required<PrepareUploadMediaOptions> = {
  compressImages: true,
  minBytesToCompress: IMAGE_UPLOAD_MIN_BYTES_TO_COMPRESS,
  targetBytes: IMAGE_UPLOAD_TARGET_BYTES,
  maxImageDimension: IMAGE_UPLOAD_MAX_DIMENSION,
  imageQuality: IMAGE_UPLOAD_QUALITY,
  minImageQuality: IMAGE_UPLOAD_MIN_QUALITY,
  backgroundColor: '#ffffff',
};

const IMAGE_EXTENSIONS = new Set([
  '.avif',
  '.bmp',
  '.gif',
  '.heic',
  '.heif',
  '.jpeg',
  '.jpg',
  '.png',
  '.webp',
]);

function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : '';
}

function stripFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(0, dotIndex) : fileName;
}

function isSvgImage(file: File): boolean {
  return file.type === 'image/svg+xml' || getFileExtension(file.name) === '.svg';
}

export function isCompressibleImageFile(file: File): boolean {
  if (!file.type.startsWith('image/')) return false;
  if (isSvgImage(file)) return false;
  if (file.type === 'image/gif' || getFileExtension(file.name) === '.gif') {
    return false;
  }
  const ext = getFileExtension(file.name);
  return IMAGE_EXTENSIONS.has(ext) || file.type.startsWith('image/');
}

function fitInside(
  width: number,
  height: number,
  maxSize: number,
): { width: number; height: number } {
  if (!width || !height) return { width, height };
  const longestEdge = Math.max(width, height);
  if (longestEdge <= maxSize) return { width, height };
  const scale = maxSize / longestEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function loadImageSource(file: File): Promise<ImageSource> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        width: bitmap.width,
        height: bitmap.height,
        source: bitmap,
        release: () => bitmap.close?.(),
      };
    } catch {
      // Fall back to a regular image element for browsers that cannot decode
      // the source with createImageBitmap.
    }
  }

  if (typeof document === 'undefined') {
    throw new Error('Image compression is not supported in this environment');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.decoding = 'async';
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Failed to load image'));
      element.src = objectUrl;
    });

    return {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      source: image,
      release: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob> {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to compress image'));
      },
      mimeType,
      quality,
    );
  });
}

function buildCompressionCandidates(
  maxImageDimension: number,
  imageQuality: number,
  minImageQuality: number,
) {
  const dimensionSteps = [1, 0.88, 0.75, 0.64, 0.54];
  const qualitySteps = [0, -0.05, -0.1, -0.16, -0.22];
  const seen = new Set<string>();

  return dimensionSteps
    .map((dimensionFactor, index) => {
      const dimension = Math.max(
        720,
        Math.round(maxImageDimension * dimensionFactor),
      );
      const quality = Math.max(
        minImageQuality,
        Math.min(0.92, imageQuality + qualitySteps[index]!),
      );
      return { dimension, quality };
    })
    .filter(candidate => {
      const key = `${candidate.dimension}:${candidate.quality}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export async function prepareUploadFile(
  file: File,
  options?: PrepareUploadMediaOptions,
): Promise<File> {
  const merged = { ...DEFAULT_OPTIONS, ...(options || {}) };
  if (!merged.compressImages || !isCompressibleImageFile(file)) return file;
  if (file.size <= merged.minBytesToCompress) return file;

  let source: ImageSource | null = null;
  try {
    source = await loadImageSource(file);
    const longestEdge = Math.max(source.width, source.height);
    const maxDimension = Math.min(merged.maxImageDimension, longestEdge);
    const targetBytes = merged.targetBytes;

    if (typeof document === 'undefined') return file;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    const candidates = buildCompressionCandidates(
      maxDimension,
      merged.imageQuality,
      merged.minImageQuality,
    );

    let bestBlob: Blob | null = null;
    let bestDimension = maxDimension;

    for (const candidate of candidates) {
      const target = fitInside(
        source.width,
        source.height,
        candidate.dimension,
      );

      if (
        target.width === source.width &&
        target.height === source.height &&
        file.size <= merged.minBytesToCompress * 2 &&
        !bestBlob
      ) {
        return file;
      }

      canvas.width = target.width;
      canvas.height = target.height;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = merged.backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(source.source, 0, 0, canvas.width, canvas.height);

      const blob = await canvasToBlob(canvas, 'image/jpeg', candidate.quality);
      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob;
        bestDimension = candidate.dimension;
      }
      if (blob.size <= targetBytes) {
        bestBlob = blob;
        break;
      }
    }

    if (!bestBlob || bestBlob.size >= file.size) return file;

    const baseName = stripFileExtension(file.name || 'image').trim() || 'image';
    const suffix = bestDimension < maxDimension ? '-optimized' : '';
    return new File([bestBlob], `${baseName}${suffix}.jpg`, {
      type: 'image/jpeg',
      lastModified: file.lastModified || Date.now(),
    });
  } catch {
    return file;
  } finally {
    source?.release?.();
  }
}

export async function prepareUploadFiles(
  files: File[],
  options?: PrepareUploadMediaOptions,
): Promise<File[]> {
  return await Promise.all(files.map(file => prepareUploadFile(file, options)));
}
