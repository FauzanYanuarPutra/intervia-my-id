import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

export const metadata = {
  title: 'Lajukan CRM',
  description: 'CRM pipeline, support inbox, and agent operations for the ecosystem.',
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