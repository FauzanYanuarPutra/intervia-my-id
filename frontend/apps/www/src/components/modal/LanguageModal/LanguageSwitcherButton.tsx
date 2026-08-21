'use client';
import { motion } from 'framer-motion';
import { useLanguageModal } from './LanguageModalContext';
import { Button } from '@/components/ui/Button';
import { Icon, IconEnum } from '@/components/ui-kit';
import { cn } from '@/lib/utils';

type LanguageSwitcherButtonProps = {
  className?: string;
};

export function LanguageSwitcherButton({
  className,
}: LanguageSwitcherButtonProps) {
  const { open, currentLocale } = useLanguageModal();
  return (
    <motion.div className="inline-flex" whileTap={{ scale: 0.96 }}>
      <Button
        size="sm"
        onClick={open}
        className={cn(
          'h-11 min-h-11 rounded-full border border-[color:color-mix(in_srgb,_var(--app-accent)_22%,_transparent)] bg-[color:var(--app-accent-strong)] px-3.5 font-bold text-[color:var(--app-text-inverse)] shadow-[0_12px_24px_-18px_color-mix(in_srgb,var(--app-accent)_72%,transparent)] hover:brightness-105',
          className,
        )}
      >
        <Icon name={IconEnum.Globe} className="h-4 w-4" />
        <span>{currentLocale?.toUpperCase() || 'EN'}</span>
      </Button>
    </motion.div>
  );
}
