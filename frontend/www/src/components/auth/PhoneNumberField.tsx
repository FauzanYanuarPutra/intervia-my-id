'use client';

import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AUTH_PHONE_COUNTRIES,
  detectPhoneCountryFromValue,
  formatPhonePreview,
  getPhoneCountry,
  normalizePhoneInput,
  stripCountryDialCode,
  type PhoneCountryCode,
} from '@/lib/phoneCountry';

type PhoneNumberFieldProps = {
  locale: 'id' | 'en';
  value: string;
  countryCode: PhoneCountryCode;
  onValueChange: (value: string) => void;
  onCountryCodeChange: (value: PhoneCountryCode) => void;
  inputClassName: string;
  selectClassName?: string;
  autoComplete?: string;
  id?: string;
  disabled?: boolean;
};

export default function PhoneNumberField({
  locale,
  value,
  countryCode,
  onValueChange,
  onCountryCodeChange,
  inputClassName,
  selectClassName,
  autoComplete = 'tel',
  id,
  disabled = false,
}: PhoneNumberFieldProps) {
  const selectedCountry = getPhoneCountry(countryCode);
  const countryLabel = locale === 'id' ? 'Pilih negara' : 'Choose country';
  const phoneLabel =
    locale === 'id' ? 'Nomor HP / WhatsApp' : 'Phone / WhatsApp number';

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-[color:var(--app-text-soft)]">
            {countryLabel}
          </span>
          <span className="relative block">
            <select
              value={countryCode}
              onChange={(event) =>
                onCountryCodeChange(event.target.value as PhoneCountryCode)
              }
              disabled={disabled}
              className={cn(
                'min-h-[56px] w-full appearance-none rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3.5 pr-10 text-[15px] font-medium text-[color:var(--app-text)] outline-none transition-[border-color,box-shadow] focus:border-[color:var(--app-accent-border)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,_var(--app-accent)_12%,_transparent)] disabled:cursor-not-allowed disabled:bg-[color:var(--app-surface-muted)] disabled:text-[color:var(--app-text-soft)] sm:text-sm',
                selectClassName,
              )}
            >
              {AUTH_PHONE_COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {`${country.flag} ${country.dialCode} ${country.label}`}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--app-text-soft)]" />
          </span>
        </label>

        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-[color:var(--app-text-soft)]">
            {phoneLabel}
          </span>
          <div className="relative min-w-0">
            <span className="pointer-events-none absolute left-3 top-1/2 inline-flex -translate-y-1/2 items-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text-soft)] dark:bg-[color:var(--app-surface-strong)]">
              {selectedCountry.dialCode}
            </span>
            <input
              id={id}
              type="tel"
              inputMode="tel"
              enterKeyHint="next"
              value={value}
              onChange={(event) => {
                const nextRaw = normalizePhoneInput(event.target.value);
                const detectedCountry = detectPhoneCountryFromValue(nextRaw);

                if (detectedCountry && detectedCountry !== countryCode) {
                  onCountryCodeChange(detectedCountry);
                  onValueChange(stripCountryDialCode(nextRaw, detectedCountry));
                  return;
                }

                onValueChange(nextRaw);
              }}
              placeholder={selectedCountry.placeholder}
              autoComplete={autoComplete}
              disabled={disabled}
              className={cn(
                inputClassName,
                'min-h-[56px] w-full min-w-0 pl-[5.4rem] sm:pl-[5.7rem]',
              )}
            />
          </div>
        </label>
      </div>

      <p className="text-xs leading-5 text-[color:var(--app-text-soft)]">
        {locale === 'id'
          ? 'Kode akan dikirim ke nomor ini:'
          : 'We will send the code to:'}{' '}
        <span className="inline-flex max-w-full flex-wrap items-center gap-1 break-words font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
          {selectedCountry.flag} {formatPhonePreview(value, countryCode)}
        </span>
      </p>
    </div>
  );
}
