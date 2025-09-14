import { NextResponse } from 'next/server';

export async function GET() {
  // Placeholder: return static structure
  return NextResponse.json({
    weekStart: new Date().toISOString().substring(0,10),
    activities: []
  });
}
