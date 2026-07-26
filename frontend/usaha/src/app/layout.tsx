import type { Metadata } from 'next';
import '@/app/globals.css';
import 'leaflet/dist/leaflet.css';

export const metadata: Metadata = {
  title: 'Usaha Lajukan',
  description:
    'Portal bisnis terpisah untuk mengelola usaha, tim, produk, operasional, dan keamanan per usaha.',
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  );
}
