import { NextResponse } from 'next/server';
import fs from 'fs';
export async function GET() {
  const f = '/tmp/rpsc_printout.pdf';
  if (!fs.existsSync(f)) return new NextResponse('PDF not ready', { status: 404 });
  const buf = fs.readFileSync(f);
  return new NextResponse(buf, { headers: { 'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="rpsc_form.pdf"','Cache-Control':'no-store' } });
}
