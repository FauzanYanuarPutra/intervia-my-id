import type { Metadata } from 'next';
import { BlogSubmissions } from './BlogSubmissions';

export const metadata: Metadata = {
  title: 'Artikel Saya | Lajukan Blog',
  robots: { index: false, follow: true },
};

export default function BlogSubmissionsPage() {
  return <BlogSubmissions />;
}
