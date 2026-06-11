export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';

const SCREENSHOT_FILES = ['/tmp/govform_screenshot.png', '/tmp/govform_screen.png'];

export async function GET(_request: NextRequest) {
  const screenshotFile = SCREENSHOT_FILES.find((file) => fs.existsSync(file));
  if (!screenshotFile) {
    return new NextResponse('Not found', { status: 404 });
  }
  const buf = fs.readFileSync(screenshotFile);
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store, no-cache',
    },
  });
}
