import type { Metadata } from 'next';
import SimpleCreateFlow from './SimpleCreateFlow';

export const metadata: Metadata = {
  title: 'Create Posting | Lajukan',
  description:
    'Mulai dari tujuan, kategori, info dasar, foto, detail tambahan, lalu preview sebelum publish.',
};

export default function CreatePage() {
  return <SimpleCreateFlow />;
}
