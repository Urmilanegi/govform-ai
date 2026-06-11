import { NextResponse } from 'next/server';
import fs from 'fs';

const CAPTCHA_IMG = '/tmp/ssc_captcha.png';

export async function GET() {
  if (!fs.existsSync(CAPTCHA_IMG)) {
    return new NextResponse('Not found', { status: 404 });
  }
  const buf = fs.readFileSync(CAPTCHA_IMG);
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
