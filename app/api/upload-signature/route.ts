export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import fs from 'fs';
import os from 'os';
import path from 'path';

// SSC signature spec: JPEG, ~6cm x 2cm @300DPI (~709x236), 10–20 KB.
// Student koi bhi badi/uneven photo de — yahan auto crop + compress hota hai.
const SIGN_JPG = path.join(os.tmpdir(), 'govform_sign.jpg');
const SIGN_W = 709;
const SIGN_H = 236;

async function compressSign(input: Buffer): Promise<Buffer> {
  let best: Buffer | null = null;
  for (const q of [90, 80, 70, 60, 50, 42, 35, 28, 22, 16, 12]) {
    const out = await sharp(input)
      .rotate()
      .resize(SIGN_W, SIGN_H, { fit: 'inside', background: { r: 255, g: 255, b: 255 } })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: q, mozjpeg: true })
      .toBuffer();
    best = out;
    const kb = out.length / 1024;
    if (kb <= 20) return out; // under 20KB — good (SSC floor 10KB is soft)
  }
  return best as Buffer;
}

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();
    if (!image) return NextResponse.json({ ok: false, error: 'no image' }, { status: 400 });
    const b64 = image.replace(/^data:image\/\w+;base64,/, '');
    const out = await compressSign(Buffer.from(b64, 'base64'));
    fs.writeFileSync(SIGN_JPG, out);
    return NextResponse.json({ ok: true, sizeKB: Math.round(out.length / 1024), path: SIGN_JPG });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
