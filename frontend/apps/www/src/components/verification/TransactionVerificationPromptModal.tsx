'use client';

import { Modal } from '@/components/common/Modal';
import type { TransactionVerificationState } from '@/lib/identityVerification';

type TransactionVerificationPromptModalProps = {
  open: boolean;
  locale: string;
  prompt: TransactionVerificationState | null;
  onClose: () => void;
  onOpenVerification: () => void;
  onOpenProfile: () => void;
};

export function TransactionVerificationPromptModal({
  open,
  locale,
  prompt,
  onClose,
  onOpenVerification,
  onOpenProfile,
}: TransactionVerificationPromptModalProps) {
  const isId = locale === 'id';
  const needsPhoneOtp = Boolean(prompt?.hasPhone && !prompt?.phoneReady);

  return (
    <Modal
      open={open}
      title={isId ? 'Lengkapi verifikasi dulu' : 'Complete verification first'}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onOpenVerification}
            className="inline-flex flex-1 items-center justify-center rounded-full bg-[color:var(--app-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)]"
          >
            {needsPhoneOtp
              ? isId
                ? 'Verifikasi sekarang'
                : 'Verify now'
              : isId
                ? 'Lengkapi sekarang'
                : 'Complete now'}
          </button>
          <button
            type="button"
            onClick={onOpenProfile}
            className="inline-flex flex-1 items-center justify-center rounded-full border border-[color:var(--app-border)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]"
          >
            {isId ? 'Profile' : 'Open profile'}
          </button>
        </div>
      }
    >
      <p>
        {isId
          ? 'Verifikasi nomor HP dulu.'
          : 'Before continuing the transaction, the account needs an active phone number verified with OTP.'}
      </p>
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between rounded-2xl border border-[color:var(--app-border)] px-3 py-2 dark:border-[color:var(--app-border-strong)]">
          <span>{isId ? 'Nomor telepon' : 'Phone number'}</span>
          <span className="text-xs font-semibold">
            {prompt?.phoneReady
              ? isId
                ? 'Siap'
                : 'Ready'
              : prompt?.hasPhone
                ? isId
                  ? 'Perlu OTP'
                  : 'OTP needed'
                : isId
                  ? 'Belum lengkap'
                  : 'Incomplete'}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-[color:var(--app-border)] px-3 py-2 dark:border-[color:var(--app-border-strong)]">
          <span>{isId ? 'Trust lanjutan' : 'Advanced trust'}</span>
          <span className="text-xs font-semibold">
            {prompt?.identityReady
              ? isId
                ? 'Siap'
                : 'Ready'
              : prompt?.hasPhone
                ? isId
                  ? 'Bisa menyusul'
                  : 'Can follow later'
                : isId
                  ? 'Belum lengkap'
                  : 'Incomplete'}
          </span>
        </div>
      </div>
      <p className="mt-3 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
        {!prompt?.hasPhone
          ? isId
            ? 'Tambahkan nomor HP di profile.'
            : 'Add a phone number in your profile first so transactions can continue in a safer and cleaner flow.'
          : needsPhoneOtp
            ? isId
              ? 'Nomor sudah ada. Verifikasi OTP di profile.'
              : 'Your phone number is already saved, but OTP verification is still required. We will redirect you to profile so phone verification is completed in one clear flow.'
          : isId
            ? 'Verifikasi identitas bisa nanti.'
            : 'Once the phone is secure, advanced identity verification can still be completed later from the profile when higher limits or trust are needed.'}
      </p>
    </Modal>
  );
}
