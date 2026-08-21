import type { Metadata } from 'next';
import CreateDraftsClient from './CreateDraftsClient';

export const metadata: Metadata = {
  title: 'Draft Create | Lajukan',
  description: 'Lanjutkan draft postingan Lajukan yang belum selesai.',
};

export default function CreateDraftsPage() {
  return <CreateDraftsClient />;
}
