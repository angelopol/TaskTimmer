import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { sessionUserId } from '../../../../lib/sessionUser';
import { asUser, IDEAMAP_WEB_URL } from '../../../../lib/ideamap';

export const dynamic = 'force-dynamic';

/** Connection status for the settings dialog (never exposes the token). */
export async function GET() {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const connection = await prisma.ideaMapConnection.findUnique({ where: { userId } });
  return NextResponse.json({
    connected: !!connection,
    name: connection?.ideamapUserName ?? null,
    email: connection?.ideamapEmail ?? null,
    connectedAt: connection?.createdAt ?? null,
    lastUsedAt: connection?.lastUsedAt ?? null,
    webUrl: IDEAMAP_WEB_URL
  });
}

/** Disconnects on both sides: revokes the IdeaMap token (best effort) and forgets it here. */
export async function DELETE() {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { await asUser(userId, '/integrations/tasktimmer/token', { method: 'DELETE' }); } catch {}
  await prisma.ideaMapConnection.deleteMany({ where: { userId } });
  return NextResponse.json({ ok: true });
}
