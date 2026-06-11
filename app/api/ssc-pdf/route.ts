import { NextResponse } from 'next/server';
import fs from 'fs';

export async function GET() {
  const filePath = '/tmp/ssc_summary_printout.pdf';
  if (!fs.existsSync(filePath)) {
    return new NextResponse('PDF not ready yet. Form fill karo pehle.', { status: 404 });
  }
  const buf = fs.readFileSync(filePath);
  // Check if it's actually a PDF (starts with %PDF) or HTML fallback
  const isHtml = buf.slice(0, 15).toString().trim().startsWith('<!DOCTYPE');
  return new NextResponse(buf, {
    headers: {
      'Content-Type': isHtml ? 'text/html' : 'application/pdf',
      'Content-Disposition': `attachment; filename="SSC_OTR_Summary.${isHtml ? 'html' : 'pdf'}"`,
      'Cache-Control': 'no-store',
    },
  });
}
