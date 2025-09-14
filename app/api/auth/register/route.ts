import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createUser } from '../../../../lib/auth';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional()
});

export async function POST(req: Request) {
  const raw = await req.text();
  let data;
  try { data = schema.parse(JSON.parse(raw)); } catch { return NextResponse.json({ error: 'Invalid data' }, { status: 400 }); }
  try {
    await createUser(data.email, data.password, data.name);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
  if (e.code === 'P2002') return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
  return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
