import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/nextAuthOptions';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(2).max(60),
  color: z.string().regex(/^#?[0-9A-Fa-f]{6}$/).optional().nullable(),
  weeklyTargetMinutes: z.number().int().min(0).max(100000).default(0)
});

const updateSchema = createSchema.partial();

export async function GET(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session as any).userId;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (id) {
    const activity = await prisma.activity.findFirst({ where: { id, userId } });
    if (!activity) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ activity });
  }
  const activities = await prisma.activity.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  return NextResponse.json({ activities });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session as any).userId;
  let dataRaw: any;
  try { dataRaw = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parse = createSchema.safeParse(dataRaw);
  if (!parse.success) return NextResponse.json({ error: parse.error.flatten() }, { status: 422 });
  const { name, color, weeklyTargetMinutes } = parse.data;
  try {
    const activity = await prisma.activity.create({ data: { name, color: color || null, weeklyTargetMinutes, userId } });
    return NextResponse.json({ activity }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Create failed' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session as any).userId;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id param ?id=' }, { status: 400 });
  let body: any; try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  try {
    const existing = await prisma.activity.findFirst({ where: { id, userId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const updated = await prisma.activity.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ activity: updated });
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session as any).userId;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const existing = await prisma.activity.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.activity.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
