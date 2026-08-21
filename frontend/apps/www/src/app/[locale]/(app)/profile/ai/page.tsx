import type { Metadata } from 'next';
import PersonalAiStudio from './PersonalAiStudio';

export const metadata: Metadata = {
  title: 'AI Pribadi | Lajukan',
  description: 'Kelola AI pribadi, instruksi, tab chat, dan riwayat percakapan.',
};

export default function ProfileAiPage() {
  return <PersonalAiStudio />;
}
