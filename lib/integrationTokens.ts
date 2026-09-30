import { createHash, randomBytes } from 'crypto';
import { prisma } from './prisma';

// Token auth for machine clients (the iOS Shortcut), separate from the NextAuth session.
// Tokens are short so they are easy to paste or type on a phone: 16 characters from a
// 32-symbol alphabet without look-alikes (no I, O, 0, 1) = 80 bits of entropy, shown as
// XXXX-XXXX-XXXX-XXXX. Only a SHA-256 hash is stored; the plain token is shown once.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split('');
const TOKEN_LENGTH = 16;
export const REMINDERS_KIND = 'apple-reminders';

export function generateToken() {
  // 256 is a multiple of 32, so `byte & 31` is uniform.
  const chars = Array.from(randomBytes(TOKEN_LENGTH), byte => ALPHABET[byte & 31]).join('');
  return chars.match(/.{4}/g)!.join('-');
}

/** Accepts the token with or without dashes/spaces and in any case. */
export function normalizeToken(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function hashToken(raw: string) {
  return createHash('sha256').update(normalizeToken(raw)).digest('hex');
}

/** Creates (or replaces) the user's token for `kind`. Any previous token stops working immediately. */
export async function issueToken(userId: string, kind = REMINDERS_KIND) {
  const token = generateToken();
  const data = { tokenHash: hashToken(token), prefix: token.slice(0, 4), createdAt: new Date(), lastUsedAt: null, lastSyncAt: null };
  await prisma.integrationToken.upsert({
    where: { userId_kind: { userId, kind } },
    create: { userId, kind, ...data },
    update: data
  });
  return token;
}

/** Resolves a bearer token to its user id, or null. */
export async function verifyToken(raw: string | null | undefined, kind = REMINDERS_KIND) {
  if (!raw) return null;
  const normalized = normalizeToken(raw);
  if (normalized.length !== TOKEN_LENGTH) return null;
  const record = await prisma.integrationToken.findUnique({ where: { tokenHash: hashToken(normalized) } });
  if (!record || record.kind !== kind) return null;
  await prisma.integrationToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
  return record.userId;
}

export function bearerFrom(req: Request) {
  const header = req.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : req.headers.get('x-tasktimmer-token');
}
