import { NextResponse } from 'next/server';
import fs from 'fs';

export async function GET() {
  const official = '/tmp/ssc_official_printout.pdf';
  const summary  = '/tmp/ssc_summary_printout.pdf';
  const path = fs.existsSync(official) ? official : summary;
  if (!fs.existsSync(path)) return new NextResponse('PDF not ready', { status: 404 });
  const buf = fs.readFileSync(path);
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="SSC_OTR_Official.pdf"',
      'Cache-Control': 'no-store',
    },
  });
}
