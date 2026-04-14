'use client';

import { useState, useRef, useCallback } from 'react';
import { Icon, IconEnum } from '@/components/ui-kit';
import Image from 'next/image';
import clsx from 'clsx';

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.heic',
  '.heif',
  '.bmp',
  '.avif',
]);

export interface ImageFile {
  id?: string;
  file?: File;
  preview: string;
  uploading?: boolean;
  url?: string;
  error?: string;
  persisted?: boolean;
}

interface ImageUploadProps {
  images: ImageFile[];
  onChange: (images: ImageFile[]) => void;
  onAddFiles?: (files: File[]) => void | Promise<void>;
  maxImages?: number;
  maxSizeMB?: number;
  locale?: string;
}

function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  const dotIndex = file.name.lastIndexOf('.');
  const ext = dotIndex >= 0 ? file.name.slice(dotIndex).toLowerCase() : '';
  return IMAGE_EXTENSIONS.has(ext);
}

export function ImageUpload({
  images,
  onChange,
  onAddFiles,
  maxImages = 10,
  maxSizeMB = 5,
  locale = 'id',
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;

    const acceptedFiles: File[] = [];
    const remainingSlots = maxImages - images.length;

    Array.from(files).slice(0, remainingSlots).forEach((file) => {
      // Validate file type
      if (!isImageFile(file)) {
        return;
      }

      // Validate file size
      if (file.size > maxSizeMB * 1024 * 1024) {
        return;
      }

      acceptedFiles.push(file);
    });

    if (acceptedFiles.length === 0) {
      return;
    }

    if (onAddFiles) {
      void onAddFiles(acceptedFiles);
      return;
    }

    const newImages: ImageFile[] = acceptedFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    if (newImages.length > 0) {
      onChange([...images, ...newImages]);
    }
  }, [images, maxImages, maxSizeMB, onAddFiles, onChange]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    // Revoke object URL untuk cleanup memory
    if (images[index].preview.startsWith('blob:')) {
      URL.revokeObjectURL(images[index].preview);
    }
    onChange(newImages);
  };

  const moveImage = (fromIndex: number, toIndex: number) => {
    const newImages = [...images];
    const [moved] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, moved);
    onChange(newImages);
  };

  const canAddMore = images.length < maxImages;

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {canAddMore && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={clsx(
            'relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300',
            dragActive
              ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_20%,_transparent)] scale-[1.02]'
              : 'border-[color:var(--app-border)] dark:border-[color:var(--app-border-strong)] hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-surface-muted)] dark:hover:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_50%,_transparent)]'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileInput}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex flex-col items-center gap-3"
          >
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[color:var(--app-accent)] to-[color:var(--app-accent)] flex items-center justify-center shadow-lg">
              <Icon name={IconEnum.Zap} className="w-8 h-8 text-[color:var(--app-text-inverse)]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                {locale === 'id' ? 'Klik untuk upload atau drag & drop' : 'Click to upload or drag & drop'}
              </p>
              <p className="text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] mt-1">
                {locale === 'id' 
                  ? `PNG, JPG, WEBP hingga ${maxSizeMB}MB (maks ${maxImages} gambar)`
                  : `PNG, JPG, WEBP up to ${maxSizeMB}MB (max ${maxImages} images)`}
              </p>
            </div>
          </button>
        </div>
      )}

      {/* Image Preview Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {images.map((img, index) => (
            <div
              key={index}
              className="relative group aspect-square rounded-xl overflow-hidden border-2 border-[color:var(--app-border)] dark:border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)]"
            >
              {/* Image Preview */}
              <Image
                src={img.preview}
                alt={`Preview ${index + 1}`}
                fill
                className="object-cover"
                unoptimized
              />

              {/* Overlay dengan Actions */}
              <div className="absolute inset-0 bg-[color:color-mix(in_srgb,_var(--app-overlay)_60%,_transparent)] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2">
                {/* Move Left */}
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => moveImage(index, index - 1)}
                    className="p-2 bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_90%,_transparent)] rounded-lg hover:bg-[color:var(--app-surface-strong)] transition-colors"
                    title={locale === 'id' ? 'Pindah kiri' : 'Move left'}
                  >
                    <Icon name={IconEnum.ChevronDown} className="w-4 h-4 text-[color:var(--app-text)] rotate-90" />
                  </button>
                )}

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="p-2 bg-[color:var(--app-danger)] rounded-lg hover:bg-[color:var(--app-danger)] transition-colors"
                  title={locale === 'id' ? 'Hapus' : 'Remove'}
                >
                  <span className="text-[color:var(--app-text-inverse)] font-bold text-lg leading-none">×</span>
                </button>

                {/* Move Right */}
                {index < images.length - 1 && (
                  <button
                    type="button"
                    onClick={() => moveImage(index, index + 1)}
                    className="p-2 bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_90%,_transparent)] rounded-lg hover:bg-[color:var(--app-surface-strong)] transition-colors"
                    title={locale === 'id' ? 'Pindah kanan' : 'Move right'}
                  >
                    <Icon name={IconEnum.ChevronDown} className="w-4 h-4 text-[color:var(--app-text)] -rotate-90" />
                  </button>
                )}
              </div>

              {/* Uploading Indicator */}
              {img.uploading && (
                <div className="absolute inset-0 bg-[color:color-mix(in_srgb,_var(--app-overlay)_50%,_transparent)] flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-[color:var(--app-text-inverse)] border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}

              {/* Error Indicator */}
              {img.error && (
                <div className="absolute bottom-0 left-0 right-0 bg-[color:var(--app-danger)] text-[color:var(--app-text-inverse)] text-xs p-1 text-center">
                  {img.error}
                </div>
              )}

              {/* Cover Badge (First Image) */}
              {index === 0 && (
                <div className="absolute top-2 left-2 px-2 py-1 bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] text-xs font-bold rounded">
                  {locale === 'id' ? 'Cover' : 'Cover'}
                </div>
              )}

              {/* Image Number */}
              <div className="absolute top-2 right-2 px-2 py-1 bg-[color:color-mix(in_srgb,_var(--app-overlay)_50%,_transparent)] text-[color:var(--app-text-inverse)] text-xs font-medium rounded">
                {index + 1}/{images.length}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Text */}
      {images.length > 0 && (
        <p className="text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
          {locale === 'id' 
            ? `Gambar pertama akan menjadi cover. Drag untuk mengubah urutan.`
            : `First image will be the cover. Drag to reorder.`}
        </p>
      )}
    </div>
  );
}
