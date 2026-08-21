'use client';

import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AUTH_PHONE_COUNTRIES,
  detectPhoneCountryFromValue,
  formatPhonePreview,
  getPhoneCountry,
  getPhoneCountryFlagEmoji,
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
  const generatedId = useId();
  const inputId = id || generatedId;
  const selectedCountry = getPhoneCountry(countryCode);
  const countryLabel = locale === 'id' ? 'Pilih negara' : 'Choose country';
  const phoneLabel =
    locale === 'id' ? 'Nomor HP / WhatsApp' : 'Phone / WhatsApp number';
  const selectedFlag = getPhoneCountryFlagEmoji(selectedCountry.code);

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <label
          htmlFor={inputId}
          className="block text-[11px] font-semibold text-[color:var(--app-text-soft)]"
        >
          {phoneLabel}
        </label>

        <div
          className={cn(
            'ui-field-shell flex min-h-[42px] min-w-0 items-center gap-2 rounded-[12px] border border-[color:var(--app-border)] bg-white px-2 py-1 transition-[border-color,background-color,box-shadow] focus-within:border-[color:var(--app-accent-border)] focus-within:bg-[color:var(--app-surface)] focus-within:ring-2 focus-within:ring-[color:color-mix(in_srgb,_var(--app-accent)_12%,_transparent)] dark:bg-[color:var(--app-surface-strong)]',
            disabled &&
            'cursor-not-allowed bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]',
          )}
        >
          <span className="relative shrink-0">
            <select
              aria-label={countryLabel}
              title={`${selectedCountry.label} ${selectedCountry.dialCode}`}
              value={countryCode}
              onChange={event =>
                onCountryCodeChange(event.target.value as PhoneCountryCode)
              }
              disabled={disabled}
              className={cn(
                'absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed',
                selectClassName,
              )}
            >
              {AUTH_PHONE_COUNTRIES.map(country => (
                <option key={country.code} value={country.code}>
                  {`${getPhoneCountryFlagEmoji(country.code)} ${country.dialCode} ${country.label}`}
                </option>
              ))}
            </select>
            <span className="inline-flex min-h-[34px] items-center gap-1.5 rounded-[10px] bg-[color:var(--app-surface-muted)] px-2 text-[12px] font-bold text-[color:var(--app-text)]">
              <span className="text-base leading-none">{selectedFlag}</span>
              <span>{selectedCountry.dialCode}</span>
              <ChevronDown className="h-3.5 w-3.5 text-[color:var(--app-text-soft)]" />
            </span>
          </span>

          <input
            id={inputId}
            type="tel"
            inputMode="tel"
            enterKeyHint="next"
            value={value}
            onChange={event => {
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
              'min-h-[38px] min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 py-0 text-[15px] shadow-none outline-none focus:border-0 focus:bg-transparent focus:ring-0 disabled:bg-transparent sm:text-sm dark:bg-transparent',
            )}
          />
        </div>
      </div>

      <p className="text-[11px] leading-4 text-[color:var(--app-text-soft)]">
        {locale === 'id' ? 'Kode ke:' : 'Code to:'}{' '}
        <span className="inline-flex max-w-full flex-wrap items-center gap-1 break-words font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
          {selectedFlag} {formatPhonePreview(value, countryCode)}
        </span>
      </p>
    </div>
  );
}
