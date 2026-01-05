import 'server-only';

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
  NEXT_PUBLIC_BASE_URL: z.string().optional(),
  VERCEL_URL: z.string().optional(),
  WAITWHILE_API_URL: z.string().optional(),
  WAITWHILE_API_KEY: z.string().optional(),
  WAITWHILE_WEBHOOK_SECRET: z.string().optional(),
  CSRF_SECRET: z.string().optional(),
  RATE_LIMIT_API: z.string().optional(),
  RATE_LIMIT_SUBMIT: z.string().optional(),
  CONTENT_SECURITY_POLICY: z.string().optional(),
  NEXT_PUBLIC_ENABLE_ANALYTICS: z.string().optional(),
  NEXT_PUBLIC_ENABLE_ERROR_REPORTING: z.string().optional(),
  NEXT_PUBLIC_DEBUG_MODE: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_API_KEY_SID: z.string().optional(),
  TWILIO_API_KEY_SECRET: z.string().optional(),
  TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  HEALTH_CHECK_ENABLED: z.string().optional(),
  HEALTH_CHECK_SECRET: z.string().optional(),
  LOG_LEVEL: z.string().optional(),
  NEXT_PUBLIC_IMAGE_QUALITY: z.string().optional(),
  NEXT_PUBLIC_CACHE_TIMEOUT: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const errors = parsed.error.flatten().fieldErrors;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Invalid environment variables: ${JSON.stringify(errors)}`);
  }
  console.warn('Invalid environment variables:', errors);
}

export const env = parsed.success
  ? parsed.data
  : (process.env as z.infer<typeof envSchema>);

export type Env = z.infer<typeof envSchema>;
