import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/nextAuthOptions';
import { prisma } from '../../../../lib/prisma';
import { z } from 'zod';

const startSchema = z.object({
	activityId: z.string().cuid().nullable().optional(),
	// Client-local timestamp for the exact start instant
	clientNow: z.string().datetime().optional(),
	// Client-local calendar date (YYYY-MM-DD) for storing the log.date field
	clientDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

export async function POST(req: Request) {
	const session = await getServerSession(authOptions as any);
	if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	const userId = (session as any).userId as string | undefined;
	if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	let body: unknown;
	try { body = await req.json(); } catch { body = {}; }
	const parsed = startSchema.safeParse(body || {});
	if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
	const { activityId, clientNow, clientDate } = parsed.data;

	// Ensure activity ownership if provided
	if (activityId) {
		const act = await prisma.activity.findFirst({ where: { id: activityId, userId } });
		if (!act) return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
	}

	// Enforce only one active log per user
	const active = await (prisma.timeLog as any).findFirst({ where: { userId, endedAt: { equals: null } } });
	if (active) return NextResponse.json({ error: 'Already active' }, { status: 409 });

	// Determine start instant and client-local date
	const startedAt = clientNow ? new Date(clientNow) : new Date();
	let dateLocal: Date;
	if (clientDate) {
		const [yy,mm,dd] = clientDate.split('-').map(Number);
		dateLocal = new Date(yy, (mm-1), dd, 0,0,0,0); // interpret as client-local midnight
	} else {
		// Fallback: compute calendar date from startedAt in server local tz (best-effort)
		const y = startedAt.getFullYear();
		const m = startedAt.getMonth();
		const d = startedAt.getDate();
		dateLocal = new Date(y, m, d, 0,0,0,0);
	}

	// Overlap guard: shouldn't happen since we checked active, but keep for race conditions
	const overlapping = await (prisma.timeLog as any).findFirst({
		where: {
			userId,
			AND: [
				{ startedAt: { lt: new Date(startedAt.getTime() + 1) } },
				{ OR: [ { endedAt: { gt: startedAt } }, { endedAt: null } ] }
			]
		}
	});
	if (overlapping) return NextResponse.json({ error: 'Time range overlaps an existing log' }, { status: 409 });

		const log = await (prisma.timeLog as any).create({
		data: {
			userId,
			activityId: activityId || null,
			segmentId: null,
			date: dateLocal,
			startedAt,
				endedAt: null,
			minutes: 0,
			partial: false,
			source: 'ADHOC',
			comment: null
		},
		include: { activity: { select: { id: true, name: true, color: true } } }
	});
	return NextResponse.json({ log }, { status: 201 });
}

