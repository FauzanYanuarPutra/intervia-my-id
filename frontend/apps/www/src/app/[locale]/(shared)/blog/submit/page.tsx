import type { Metadata } from 'next';
import BlogSubmitForm from './BlogSubmitForm';

export const metadata: Metadata = {
  title: 'Tulis Artikel | Lajukan Blog',
  description: 'Kirim artikel ke Blog Lajukan melalui review editorial atau publikasi langsung sesuai hak publikasi.',
  robots: { index: false, follow: true },
};

export default function BlogSubmitPage() {
  return <BlogSubmitForm />;
}
