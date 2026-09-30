import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// AES-256-GCM for secrets TaskTimmer must be able to read back (third-party tokens, OAuth state).
// Key: INTEGRATIONS_SECRET, falling back to NEXTAUTH_SECRET. Rotating it invalidates stored
// secrets, which only means reconnecting the integration.
function key() {
  const secret = process.env.INTEGRATIONS_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('INTEGRATIONS_SECRET or NEXTAUTH_SECRET must be set.');
  return createHash('sha256').update('tasktimmer:secretbox:' + secret).digest();
}

export function seal(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv, cipher.getAuthTag(), data].map(part => typeof part === 'string' ? part : part.toString('base64url')).join('.');
}

/** Returns null when the value was tampered with or sealed under another key. */
export function open(sealed: string | undefined | null): string | null {
  const [version, iv, tag, data] = (sealed || '').split('.');
  if (version !== 'v1' || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
