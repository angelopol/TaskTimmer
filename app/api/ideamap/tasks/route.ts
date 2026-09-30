import { NextResponse } from 'next/server';
import { sessionUserId } from '../../../../lib/sessionUser';
import { asUser, IdeaMapError, type IdeaMapTask } from '../../../../lib/ideamap';

export const dynamic = 'force-dynamic';

/** Live list of the IdeaMap tasks assigned to the user (open ones plus those finished since `since`). */
export async function GET(req: Request) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const since = new URL(req.url).searchParams.get('since');
  const query = since && /^\d{4}-\d{2}-\d{2}$/.test(since) ? '?since=' + since : '';
  try {
    const { tasks } = await asUser<{ tasks: IdeaMapTask[] }>(userId, '/integrations/tasktimmer/tasks' + query);
    return NextResponse.json({ connected: true, tasks });
  } catch (error) {
    if (error instanceof IdeaMapError && error.disconnected) return NextResponse.json({ connected: false, tasks: [] });
    const message = error instanceof IdeaMapError ? error.message : 'Could not load IdeaMap tasks.';
    return NextResponse.json({ connected: true, tasks: [], error: message }, { status: 502 });
  }
}
