export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getGovformDataDir, getGovformProfileDir } from '@/lib/govform-runtime';

const OTP_FILE     = '/tmp/govform_otp.txt';
const CAPTCHA_FILE = '/tmp/govform_captcha.txt';

// POST — submit OTP or CAPTCHA solution
export async function POST(request: NextRequest) {
  const body = await request.json();
  if (body.otp)      fs.writeFileSync(OTP_FILE,     body.otp);
  if (body.captcha)  fs.writeFileSync(CAPTCHA_FILE, body.captcha);
  if (body.solution) fs.writeFileSync(CAPTCHA_FILE, body.solution);
  return NextResponse.json({ ok: true });
}

// GET — SSE stream
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const govformDataDir = getGovformDataDir();
  const student = {
    FULL_NAME:    p.get('name')     || 'SUMIT KUMAR MINA',
    FATHER_NAME:  p.get('father')   || 'HARKESH MEENA',
    MOTHER_NAME:  p.get('mother')   || '',
    MOBILE:       p.get('mobile')   || '',
    EMAIL:        p.get('email')    || 'Sumitkunwal8824@gmail.com',
    DOB:          p.get('dob')      || '07/07/2000',
    GENDER:       p.get('gender')   || 'Male',
    AADHAAR:      p.get('aadhaar')  || '201227964504',
    CATEGORY:     p.get('category') || 'ST',
    STATE:        p.get('state')    || 'Rajasthan',
    DISTRICT:     p.get('district') || 'Sawai Madhopur',
    PIN:          p.get('pin')      || '322214',
    ADDRESS:      p.get('address')  || 'Narouli Chaur, Sawai Madhopur',
    PHOTO_PATH:   p.get('photo')    || '',
    SIGN_PATH:    p.get('sign')     || '',
    EXAM_NAME:    p.get('examName') || 'NTPC',
    VISIBLE_MARK: p.get('mark')     || 'Mole on right hand',
  };

  const encoder = new TextEncoder();
  const stream  = new ReadableStream({
    start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        const { execSync } = require('child_process');
        execSync("pkill -9 -f 'rrb-fill' 2>/dev/null || true");
        execSync("pkill -9 -f 'rrb-profile' 2>/dev/null || true");
        const profileDir = getGovformProfileDir('rrb-profile');
        ['SingletonLock','SingletonCookie','SingletonSocket'].forEach((f: string) => {
          try { require('fs').unlinkSync(profileDir + '/' + f); } catch {}
        });
      } catch {}

      send({ type: 'start', message: '🚀 RRB automation shuru ho rahi hai...' });

      const envKey = ['GOVFORM', 'SCRIPTS', 'DIR'].join('_');
      const scriptsDir = (process.env[envKey] as string | undefined) || path.join(process.cwd(), 'scripts');
      const scriptPath = scriptsDir + path.sep + 'rrb-fill.cjs';
      const nodeModules = path.join(process.cwd(), 'node_modules');
      const child = spawn(process.execPath, [scriptPath], {
        env: {
          ...process.env,
          NODE_PATH: nodeModules,
          GOVFORM_DATA_DIR: govformDataDir,
          GOVFORM_SERVERLESS: process.env.VERCEL ? '1' : '',
          ...student,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let buf = '';
      child.stdout.on('data', (chunk: Buffer) => {
        buf += chunk.toString();
        const lines = buf.split('\n'); buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try { send(JSON.parse(line)); } catch { send({ type: 'log', message: line }); }
        }
      });
      child.stderr.on('data', (chunk: Buffer) => {
        const msg = chunk.toString().trim();
        if (msg && !msg.includes('ExperimentalWarning')) send({ type: 'log', message: msg.slice(0, 200) });
      });
      child.on('close', (code: number) => { send({ type: 'closed', message: `Process ended (${code})` }); controller.close(); });
      child.on('error', (err: Error) => { send({ type: 'error', message: err.message }); controller.close(); });
      request.signal.addEventListener('abort', () => { child.kill(); controller.close(); });
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
  });
}
