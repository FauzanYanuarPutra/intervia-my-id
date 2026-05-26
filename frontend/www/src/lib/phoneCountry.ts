export type PhoneCountryCode =
  | 'AU'
  | 'ID'
  | 'US'
  | 'GB'
  | 'SG'
  | 'MY'
  | 'TH'
  | 'PH'
  | 'IN'
  | 'AE';

export type PhoneCountry = {
  code: PhoneCountryCode;
  flag: string;
  dialCode: string;
  label: string;
  placeholder: string;
  minLocalLength: number;
  nationalPrefix?: string;
};

export const DEFAULT_AUTH_PHONE_COUNTRY: PhoneCountryCode = 'AU';

export const AUTH_PHONE_COUNTRIES: PhoneCountry[] = [
  {
    code: 'AU',
    flag: '🇦🇺',
    dialCode: '+61',
    label: 'Australia',
    placeholder: '0412 345 678',
    minLocalLength: 9,
    nationalPrefix: '0',
  },
  {
    code: 'ID',
    flag: '🇮🇩',
    dialCode: '+62',
    label: 'Indonesia',
    placeholder: '0812 3456 7890',
    minLocalLength: 9,
    nationalPrefix: '0',
  },
  {
    code: 'US',
    flag: '🇺🇸',
    dialCode: '+1',
    label: 'United States',
    placeholder: '(415) 555 2671',
    minLocalLength: 10,
  },
  {
    code: 'GB',
    flag: '🇬🇧',
    dialCode: '+44',
    label: 'United Kingdom',
    placeholder: '07123 456789',
    minLocalLength: 10,
    nationalPrefix: '0',
  },
  {
    code: 'SG',
    flag: '🇸🇬',
    dialCode: '+65',
    label: 'Singapore',
    placeholder: '8123 4567',
    minLocalLength: 8,
  },
  {
    code: 'MY',
    flag: '🇲🇾',
    dialCode: '+60',
    label: 'Malaysia',
    placeholder: '012 345 6789',
    minLocalLength: 9,
    nationalPrefix: '0',
  },
  {
    code: 'TH',
    flag: '🇹🇭',
    dialCode: '+66',
    label: 'Thailand',
    placeholder: '081 234 5678',
    minLocalLength: 9,
    nationalPrefix: '0',
  },
  {
    code: 'PH',
    flag: '🇵🇭',
    dialCode: '+63',
    label: 'Philippines',
    placeholder: '0917 123 4567',
    minLocalLength: 10,
    nationalPrefix: '0',
  },
  {
    code: 'IN',
    flag: '🇮🇳',
    dialCode: '+91',
    label: 'India',
    placeholder: '09876 543210',
    minLocalLength: 10,
    nationalPrefix: '0',
  },
  {
    code: 'AE',
    flag: '🇦🇪',
    dialCode: '+971',
    label: 'United Arab Emirates',
    placeholder: '050 123 4567',
    minLocalLength: 9,
    nationalPrefix: '0',
  },
];

const PHONE_COUNTRY_BY_CODE = new Map(
  AUTH_PHONE_COUNTRIES.map(country => [country.code, country]),
);

const COUNTRIES_BY_DIAL_LENGTH = [...AUTH_PHONE_COUNTRIES].sort(
  (left, right) =>
    right.dialCode.replace(/\D/g, '').length -
    left.dialCode.replace(/\D/g, '').length,
);

export function normalizePhoneInput(value: string): string {
  return value.replace(/[^\d+\s()-]/g, '');
}

export function getPhoneCountry(
  code: PhoneCountryCode | string | null | undefined,
): PhoneCountry {
  if (!code) return PHONE_COUNTRY_BY_CODE.get(DEFAULT_AUTH_PHONE_COUNTRY)!;
  return (
    PHONE_COUNTRY_BY_CODE.get(code as PhoneCountryCode) ||
    PHONE_COUNTRY_BY_CODE.get(DEFAULT_AUTH_PHONE_COUNTRY)!
  );
}

export function getPhoneCountryFlagEmoji(
  code: PhoneCountryCode | string | null | undefined,
): string {
  const normalized = String(code || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return '';
  return String.fromCodePoint(
    ...normalized.split('').map(letter => 0x1f1e6 + letter.charCodeAt(0) - 65),
  );
}

function getDialDigits(country: PhoneCountry): string {
  return country.dialCode.replace(/\D/g, '');
}

function trimInternationalPrefix(raw: string): string {
  if (raw.startsWith('00')) return raw.slice(2);
  return raw;
}

export function detectPhoneCountryFromValue(
  value: string,
): PhoneCountryCode | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith('+') && !trimmed.startsWith('00')) return null;

  const digits = trimInternationalPrefix(trimmed).replace(/\D/g, '');
  if (!digits) return null;

  const matched = COUNTRIES_BY_DIAL_LENGTH.find(country =>
    digits.startsWith(getDialDigits(country)),
  );

  return matched?.code || null;
}

export function stripCountryDialCode(
  value: string,
  countryCode: PhoneCountryCode,
): string {
  const country = getPhoneCountry(countryCode);
  const digits = trimInternationalPrefix(value.trim()).replace(/\D/g, '');
  const dialDigits = getDialDigits(country);

  if (!digits.startsWith(dialDigits)) {
    return value.replace(/[^\d]/g, '');
  }

  const rest = digits.slice(dialDigits.length);
  if (!rest) return '';
  if (country.nationalPrefix && !rest.startsWith(country.nationalPrefix)) {
    return `${country.nationalPrefix}${rest}`;
  }
  return rest;
}

export function buildInternationalPhoneNumber(
  value: string,
  countryCode: PhoneCountryCode,
): string {
  const trimmed = value.trim();
  const digits = trimInternationalPrefix(trimmed).replace(/\D/g, '');
  if (!digits) return '';

  const detectedCountryCode = detectPhoneCountryFromValue(trimmed);
  if (detectedCountryCode) {
    return digits;
  }

  const country = getPhoneCountry(countryCode);
  const dialDigits = getDialDigits(country);
  const compact = digits.replace(/^0+/, '');

  if (digits.startsWith(dialDigits) && digits.length >= dialDigits.length + 6) {
    return digits;
  }

  return `${dialDigits}${compact}`;
}

export function isPhoneNumberReady(
  value: string,
  countryCode: PhoneCountryCode,
): boolean {
  const country = getPhoneCountry(countryCode);
  const normalized = buildInternationalPhoneNumber(value, countryCode);
  const dialDigits = getDialDigits(country);
  return normalized.length >= dialDigits.length + country.minLocalLength;
}

export function formatPhonePreview(
  value: string,
  countryCode: PhoneCountryCode,
): string {
  const normalized = buildInternationalPhoneNumber(value, countryCode);
  if (!normalized) {
    return `${getPhoneCountry(countryCode).dialCode} ...`;
  }

  return `+${normalized}`;
}
