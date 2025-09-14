// Simple health check endpoint
// Provides application liveness and basic DB readiness indicator.
// NOTE: Avoid heavy queries; we just test a trivial prisma call.

import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET() {
  const started = Date.now();
  let dbOk = true;
  let dbLatencyMs: number | null = null;
  try {
    const t0 = Date.now();
    // Lightweight check: count users (fast index) or raw SELECT 1 via $queryRaw
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - t0;
  } catch (e: any) {
    dbOk = false;
  }
  const totalLatencyMs = Date.now() - started;
  return NextResponse.json({
    status: 'ok',
    uptimeSec: process.uptime(),
    timestamp: new Date().toISOString(),
    db: { ok: dbOk, latencyMs: dbLatencyMs },
    latencyMs: totalLatencyMs,
    env: {
      providerHint: process.env.DB_PROVIDER || 'sqlite'
    }
  }, { status: dbOk ? 200 : 503 });
}
