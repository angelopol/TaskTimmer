import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '../../../../lib/prisma';
import { sessionUserId } from '../../../../lib/sessionUser';

export const dynamic = 'force-dynamic';
const body = z.object({ completed: z.boolean() });
const select = { id: true, title: true, notes: true, list: true, dueAt: true, allDay: true, completed: true, flagged: true, priority: true, completionSentAt: true };

/**
 * Completes (or reopens) a reminder from TaskTimmer. Nothing is written to the iPhone here: the
 * request is queued and the Shortcut picks it up from the next sync response (see /api/ingest/reminders).
 * It can be undone until that response has gone out.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const { completed } = parsed.data;

  const current = await prisma.externalReminder.findFirst({ where: { id: params.id, userId } });
  if (!current) return NextResponse.json({ error: 'This reminder is no longer on your list.' }, { status: 404 });
  if (current.completed === completed) return NextResponse.json({ reminder: await prisma.externalReminder.findUnique({ where: { id: current.id }, select }) });
  if (!completed && current.completionSentAt) {
    return NextResponse.json({ error: 'Already sent to your iPhone. Reopen it in the Reminders app.' }, { status: 409 });
  }

  const reminder = await prisma.externalReminder.update({
    where: { id: current.id },
    data: completed
      ? { completed: true, completionRequestedAt: new Date(), completionSentAt: null }
      : { completed: false, completionRequestedAt: null },
    select
  });
  return NextResponse.json({ reminder });
}
