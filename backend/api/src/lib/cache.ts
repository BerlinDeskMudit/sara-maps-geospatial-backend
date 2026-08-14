import { createHash } from 'node:crypto';

export function hashKey(parts: string[]): string {
  const raw = parts.join('|');
  return createHash('sha1').update(raw).digest('hex');
}

export async function cacheGet(
  client: { isOpen: boolean; get(key: string): Promise<string | null> } | undefined,
  key: string,
): Promise<string | null> {
  if (!client || !client.isOpen) return null;
  try {
    return await client.get(key);
  } catch {
    return null;
  }
}

export async function cacheSet(
  client:
    | { isOpen: boolean; set(key: string, value: string, opts: { EX: number }): Promise<unknown> }
    | undefined,
  key: string,
  value: string,
  ttlS: number,
): Promise<void> {
  if (!client || !client.isOpen || ttlS <= 0) return;
  try {
    await client.set(key, value, { EX: ttlS });
  } catch {
    // cache writes must never break the request
  }
}
