export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getGovformDataDir } from '@/lib/govform-runtime';

const CAPTCHA_FILE = '/tmp/ssc_captcha_solution.txt';

// POST — submit captcha solution
export async function POST(request: NextRequest) {
  const { solution } = await request.json();
  fs.writeFileSync(CAPTCHA_FILE, solution);
  return NextResponse.json({ ok: true });
}

// GET — SSE stream for live progress
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const govformDataDir = getGovformDataDir();
  const student = {
    MOTHER_NAME:  p.get('mother')   || process.env.MOTHER_NAME || '',
    MOBILE:       p.get('mobile')   || process.env.MOBILE      || '',
    EMAIL:        p.get('email')    || process.env.EMAIL       || '',
    PHOTO_PATH:   p.get('photo')    || process.env.PHOTO_PATH || '',
    SIGN_PATH:    p.get('sign')     || process.env.SIGN_PATH  || '',
    FULL_NAME:    p.get('name')     || 'SUMIT KUMAR MINA',
    FATHER_NAME:  p.get('father')   || 'HARKESH MEENA',
    DOB:          p.get('dob')      || '07/07/2000',
    GENDER:       p.get('gender')   || 'Male',
    AADHAAR:      p.get('aadhaar')  || '201227964504',
    CATEGORY:     p.get('category') || 'ST',
    ADDRESS:      p.get('address')  || '',
    STATE:        p.get('state')    || 'Rajasthan',
    DISTRICT:     p.get('district') || 'Sawai Madhopur',
    PIN:          p.get('pin')      || '322214',
    VISIBLE_MARK: p.get('mark')     || 'Mole on right hand',
    REG_NO:       p.get('regNo')    || '10031303171',
    PASSWORD:     p.get('password') || 'Sumit@123',
  };

  const encoder = new TextEncoder();
  const stream  = new ReadableStream({
    start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: 'start', message: '🚀 SSC automation shuru ho rahi hai...' });

      const envKey = ['GOVFORM', 'SCRIPTS', 'DIR'].join('_');
      const scriptsDir = (process.env[envKey] as string | undefined) || path.join(process.cwd(), 'scripts');
      const scriptPath = scriptsDir + path.sep + 'ssc-fill.cjs';
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

      let buffer = '';
      child.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            send(parsed);
          } catch {
            send({ type: 'log', message: line });
          }
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        const msg = chunk.toString().trim();
        if (msg && !msg.includes('ExperimentalWarning')) {
          send({ type: 'log', message: msg.substring(0, 200) });
        }
      });

      child.on('close', (code: number) => {
        send({ type: 'closed', message: `Process ended (${code})` });
        controller.close();
      });

      child.on('error', (err: Error) => {
        send({ type: 'error', message: err.message });
        controller.close();
      });

      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        child.kill();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  });
}
