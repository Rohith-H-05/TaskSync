import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from workspace root or local directory
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config(); // fallback to local service .env

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('4000'),
  DATABASE_URL: z.string().url().default('postgresql://postgres:postgres_password@localhost:5432/tasksync_db?schema=public'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long').default('super_secret_jwt_key_min_32_characters_for_tasksync_dev'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CLIENT_URL: z.string().default('http://localhost:5173')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;
