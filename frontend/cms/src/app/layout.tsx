import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

export const metadata = {
  title: 'Lajukan CMS',
  description: 'Content management system for sectors and knowledge base.',
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
