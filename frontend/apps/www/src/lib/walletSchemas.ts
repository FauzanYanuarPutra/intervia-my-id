import { z } from 'zod';

const optionalTrimmed = z.preprocess((value) => {
  if (value == null) return undefined;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : undefined;
}, z.string().optional());

export const CreateWalletTopupSchema = z
  .object({
    amount_cents: z.preprocess(
      (value) => {
        if (value == null || value === '') return NaN;
        if (typeof value === 'number') return value;
        return Number(value);
      },
      z.number().int().positive().max(5_000_000_000_000),
    ),
    currency: optionalTrimmed,
    environment: z
      .enum(['development', 'live', 'dev', 'sandbox', 'test', 'production', 'prod'])
      .optional(),
    payment_provider: z
      .enum(['midtrans', 'stripe', 'xendit', 'paypal', 'adyen', 'manual', 'mock', 'test', 'sandbox'])
      .optional(),
    payment_method: optionalTrimmed,
    description: optionalTrimmed,
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strip();

export const CreateWalletWithdrawalSchema = z
  .object({
    amount_cents: z.preprocess(
      (value) => {
        if (value == null || value === '') return NaN;
        if (typeof value === 'number') return value;
        return Number(value);
      },
      z.number().int().positive().max(5_000_000_000_000),
    ),
    currency: optionalTrimmed,
    environment: z
      .enum(['development', 'live', 'dev', 'sandbox', 'test', 'production', 'prod'])
      .optional(),
    bank_code: z.string().trim().min(2).max(32),
    bank_name: z.string().trim().min(2).max(80),
    bank_account_name: z.string().trim().min(3).max(100),
    bank_account_number: z
      .string()
      .trim()
      .regex(/^[0-9\s.-]{6,40}$/),
    note: optionalTrimmed,
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strip();

