import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sessionUserId } from '../../../../../../lib/sessionUser';
import { asUser, IdeaMapError, TASK_STATUSES, type IdeaMapTask } from '../../../../../../lib/ideamap';

export const dynamic = 'force-dynamic';
const body = z.object({ status: z.enum(TASK_STATUSES) });

/** Changes the status of an assigned IdeaMap task; IdeaMap enforces assignment and project permissions. */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !/^\d+$/.test(params.id)) return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  try {
    const { task } = await asUser<{ task: IdeaMapTask }>(userId, `/integrations/tasktimmer/tasks/${params.id}/status`, {
      method: 'PUT', body: JSON.stringify(parsed.data)
    });
    return NextResponse.json({ task });
  } catch (error) {
    if (!(error instanceof IdeaMapError)) return NextResponse.json({ error: 'Could not update the task.' }, { status: 502 });
    // Never forward a 401: TaskTimmer's client treats 401 as "signed out of TaskTimmer".
    const status = error.disconnected ? 409 : error.status === 403 ? 403 : error.status === 404 ? 404 : 502;
    const message = error.status === 403 ? 'You do not have permission to change this task in IdeaMap.' : error.message;
    return NextResponse.json({ error: message, disconnected: error.disconnected }, { status });
  }
}
