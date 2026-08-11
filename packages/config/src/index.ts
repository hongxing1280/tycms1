import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  PUBLIC_WEB_URL: z.string().url().default('http://localhost:3000'),
  ADMIN_WEB_URL: z.string().url().default('http://localhost:3001'),
  API_URL: z.string().url().default('http://localhost:4000'),
  JWT_SECRET: z.string().min(16).optional(),
  SESSION_SECRET: z.string().min(16).optional(),
  CACHE_REVALIDATE_SECRET: z.string().min(8).optional(),
  BAIDU_PUSH_DEFAULT_TOKEN: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function readEnv(input: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(input);
}
