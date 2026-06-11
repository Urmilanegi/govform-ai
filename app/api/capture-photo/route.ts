export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import sharp from 'sharp';
import fs from 'fs';
import os from 'os';
import path from 'path';

// SSC photo spec: passport size, JPEG, 20–50 KB.
// We feed this same image to the bot's fake webcam as a .y4m so SSC's
// "Capture Live Photo" grabs exactly what the user shot on our site.
const PHOTO_JPG = path.join(os.tmpdir(), 'govform_photo.jpg');
const PHOTO_Y4M = path.join(os.tmpdir(), 'govform_cam.y4m');
const PHOTO_W = 480;
const PHOTO_H = 640;

function toY4m(jpgPath: string, y4mPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Scale/pad to even dimensions, yuv420p — required by the fake camera.
    // decrease+pad = poora frame fit (zoom/crop nahi) — face zyada zoom nahi hota
    // 5-second looped video (25fps × 125 frames) — SSC "Capture" ke exact waqt bhi valid frame mile.
    // Full scale — face bada dikhe taaki SSC face detection kaam kare aur red box draw ho.
    const ff = spawn('ffmpeg', [
      '-y', '-loop', '1', '-i', jpgPath, '-t', '5',
      '-vf', `scale=iw*0.55:ih*0.55,pad=${PHOTO_W}:${PHOTO_H}:(ow-iw)/2:(oh-ih)/2:white,format=yuv420p`,
      '-r', '25', '-pix_fmt', 'yuv420p', y4mPath,
    ]);
    let err = '';
    ff.stderr.on('data', d => { err += d.toString(); });
    ff.on('close', code => code === 0 ? resolve() : reject(new Error('ffmpeg: ' + err.slice(-300))));
    ff.on('error', reject);
  });
}

// Shrink a JPEG buffer to land within [minKB, maxKB] by stepping quality down.
async function compressToRange(input: Buffer, w: number, h: number, minKB: number, maxKB: number): Promise<Buffer> {
  let best: Buffer | null = null;
  for (const q of [92, 85, 78, 70, 60, 50, 42, 35, 28, 20]) {
    const out = await sharp(input)
      .rotate()
      .resize(w, h, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: q, mozjpeg: true })
      .toBuffer();
    best = out;
    const kb = out.length / 1024;
    if (kb <= maxKB && kb >= minKB) return out;
    if (kb < minKB) return out; // already smaller than target floor — accept
  }
  return best as Buffer;
}

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json(); // data URL or base64 JPEG/PNG
    if (!image) return NextResponse.json({ ok: false, error: 'no image' }, { status: 400 });
    const b64 = image.replace(/^data:image\/\w+;base64,/, '');
    const raw = Buffer.from(b64, 'base64');

    // Auto-resize to passport size, 20–50 KB.
    const jpg = await compressToRange(raw, PHOTO_W, PHOTO_H, 20, 50);
    fs.writeFileSync(PHOTO_JPG, jpg);
    await toY4m(PHOTO_JPG, PHOTO_Y4M);
    // Marker: bot ko batao ki USER ne abhi photo capture ki (placeholder nahi).
    fs.writeFileSync(path.join(os.tmpdir(), 'govform_cam_ready'), String(Date.now()));

    return NextResponse.json({ ok: true, sizeKB: Math.round(jpg.length / 1024), path: PHOTO_JPG });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
