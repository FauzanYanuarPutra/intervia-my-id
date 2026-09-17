import { ImageIcon } from 'lucide-react';

type ProductThumbProps = {
  name: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizes = {
  sm: 'h-10 w-10 rounded-xl',
  md: 'h-12 w-12 rounded-[14px]',
  lg: 'h-16 w-16 rounded-2xl',
} as const;

export function ProductThumb({ name, imageUrl, size = 'md', className = '' }: ProductThumbProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-[#eef2ec] text-portal-forest ${sizes[size]} ${className}`}
      role="img"
      aria-label={imageUrl ? `Foto ${name}` : `Belum ada foto untuk ${name}`}
    >
      {imageUrl ? (
        <span className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${imageUrl})` }} />
      ) : initials ? (
        <span className="text-xs font-black tracking-[-0.03em]">{initials}</span>
      ) : (
        <ImageIcon className="h-4 w-4" />
      )}
    </span>
  );
}
