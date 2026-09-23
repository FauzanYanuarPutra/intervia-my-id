import type { Metadata } from 'next';
import BlogEditorial from './BlogEditorial';

export const metadata: Metadata = {
  title: 'Editorial Blog | Lajukan CMS',
  robots: { index: false, follow: false },
};

export default function BlogEditorialPage() {
  return <BlogEditorial />;
}
