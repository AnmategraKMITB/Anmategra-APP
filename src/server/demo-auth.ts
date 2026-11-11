import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
const KEY_LENGTH = 64;

/** Format: `scrypt:<salt base64>:<hash base64>`; hanya untuk akun demo. */
export async function hashDemoPassword(password: string): Promise<string> {
  if (password.length < 12) {
    throw new Error('Password demo minimal 12 karakter.');
  }
  const salt = randomBytes(16);
  const key = (await derive(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt:${salt.toString('base64')}:${key.toString('base64')}`;
}

export async function verifyDemoPassword(
  password: string,
  stored: string | undefined,
): Promise<boolean> {
  if (!stored) return false;
  const [scheme, saltText, keyText] = stored.split(':');
  if (scheme !== 'scrypt' || !saltText || !keyText) return false;
  const salt = Buffer.from(saltText, 'base64');
  const expected = Buffer.from(keyText, 'base64');
  if (expected.length !== KEY_LENGTH) return false;
  const actual = (await derive(password, salt, KEY_LENGTH)) as Buffer;
  return timingSafeEqual(actual, expected);
}

/**
 * Pembatas percobaan login demo sederhana per proses. Untuk deployment
 * multi-instance, ganti dengan Redis/Upstash.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60_000;
const MAX_ATTEMPTS = 8;

export function isDemoLoginRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) return false;
  return entry.count >= MAX_ATTEMPTS;
}

export function recordDemoLoginFailure(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count += 1;
}

export function clearDemoLoginFailures(key: string) {
  attempts.delete(key);
}
