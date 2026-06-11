import { NextResponse } from 'next/server';
import { NOTIFICATIONS } from '@/lib/notifications-data';

export async function GET() {
  return NextResponse.json({ notifications: NOTIFICATIONS });
}
