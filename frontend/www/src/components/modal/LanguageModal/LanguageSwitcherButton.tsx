'use client';
import { motion } from 'framer-motion';
import { useLanguageModal } from './LanguageModalContext';
import { Button } from '@/components/ui/Button';
import { Icon, IconEnum } from '@/components/ui-kit';

export function LanguageSwitcherButton() {
  const { open, currentLocale } = useLanguageModal();
  return (
    <motion.div whileTap={{ scale: 0.9 }} whileHover={{ scale: 1.05 }}>
      <Button
        onClick={open}
        className="flex items-center gap-2 bg-gradient-to-r from-[color:var(--app-accent)] to-[color:var(--app-accent-strong)] text-[color:var(--app-text-inverse)] font-medium px-4 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all"
      >
        <Icon name={IconEnum.Globe} className="w-4 h-4" />
        <span>{currentLocale?.toUpperCase() || 'EN'}</span>
      </Button>
    </motion.div>
  );
}
