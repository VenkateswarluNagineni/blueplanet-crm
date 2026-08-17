import 'server-only';
import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // Shared secret the inbound-parse provider (SendGrid/Postmark/Mailgun, etc.)
  // must present on every reconciliation webhook call — that route sits
  // outside middleware.ts's cookie auth entirely, so this is its only guard.
  // Optional so local dev without a provider configured doesn't fail to boot;
  // the route itself refuses all requests when it's unset.
  RECONCILIATION_WEBHOOK_SECRET: z.string().min(16).optional(),
});

export const env = EnvSchema.parse(process.env);
