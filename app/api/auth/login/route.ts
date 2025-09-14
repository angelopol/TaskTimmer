import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyUser } from '../../../../lib/auth';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/nextAuthOptions';

const schema = z.object({ email: z.string().email(), password: z.string().min(6) });

export async function POST(req: Request) {
  const body = await req.text();
  let data;
  try { data = schema.parse(JSON.parse(body)); } catch { return NextResponse.json({ error: 'Invalid' }, { status: 400 }); }
  const user = await verifyUser(data.email, data.password);
  if (!user) return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
  // For simplicity we rely on next-auth session cookie via /api/auth/[...nextauth]
  // Here we just respond ok; client will call credentials provider next.
  return NextResponse.json({ ok: true });
}
