import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

// POST /api/upload-files
// Body: FormData with fields "photo" and/or "sign"
// Saves to /tmp/ssc_photo.jpg and /tmp/ssc_sign.jpg
// Returns { photo: "/tmp/ssc_photo.jpg", sign: "/tmp/ssc_sign.jpg" }
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const result: Record<string, string> = {};

    const photoFile = formData.get('photo') as File | null;
    const signFile  = formData.get('sign')  as File | null;

    if (photoFile && photoFile.size > 0) {
      const ext  = path.extname(photoFile.name) || '.jpg';
      const dest = `/tmp/ssc_photo${ext}`;
      const buf  = Buffer.from(await photoFile.arrayBuffer());
      fs.writeFileSync(dest, buf);
      result.photo = dest;
    }

    if (signFile && signFile.size > 0) {
      const ext  = path.extname(signFile.name) || '.jpg';
      const dest = `/tmp/ssc_sign${ext}`;
      const buf  = Buffer.from(await signFile.arrayBuffer());
      fs.writeFileSync(dest, buf);
      result.sign = dest;
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
