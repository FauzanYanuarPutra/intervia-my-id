import type { Metadata } from 'next';
import '@/app/globals.css';
import 'leaflet/dist/leaflet.css';

export const metadata: Metadata = {
  title: {
    default: 'Lajukan Usaha',
    template: '%s | Lajukan Usaha',
  },
  description:
    'Business OS Lajukan untuk mengelola usaha, tim, katalog, pelanggan, operasional, dan kontrol akses dalam satu workspace.',
  applicationName: 'Lajukan Usaha',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body className="antialiased">{children}</body></html>;
}
