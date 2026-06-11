export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getGovformDataDir, getGovformProfileDir } from '@/lib/govform-runtime';

const OTP_FILE     = '/tmp/govform_otp.txt';
const CAPTCHA_FILE = '/tmp/govform_captcha.txt';
const COMMAND_FILE = '/tmp/sso_command.txt';

// POST — submit OTP / CAPTCHA / COMMAND
export async function POST(request: NextRequest) {
  const body = await request.json();
  if (body.otp)      fs.writeFileSync(OTP_FILE,     String(body.otp));
  if (body.captcha)  fs.writeFileSync(CAPTCHA_FILE, String(body.captcha));
  if (body.solution) fs.writeFileSync(CAPTCHA_FILE, String(body.solution));
  if (body.command)  fs.writeFileSync(COMMAND_FILE,  String(body.command));
  return NextResponse.json({ ok: true });
}

// GET — SSE stream: spawn sso-browse script
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const govformDataDir = getGovformDataDir();

  // Kill any existing sso-browse process + clear profile locks
  try {
    const { execSync } = require('child_process');
    execSync("pkill -9 -f 'sso-browse' 2>/dev/null || true");
    const profileDir = getGovformProfileDir('sso-profile');
    ['SingletonLock', 'SingletonCookie', 'SingletonSocket'].forEach((f: string) => {
      try { require('fs').unlinkSync(profileDir + '/' + f); } catch {}
    });
  } catch {}

  const student = {
    SSO_ID:       p.get('ssoId')    || '',
    SSO_PASS:     p.get('ssoPass')  || '',
    FULL_NAME:    p.get('name')     || '',
    FATHER_NAME:  p.get('father')   || '',
    MOTHER_NAME:  p.get('mother')   || '',
    MOBILE:       p.get('mobile')   || '',
    EMAIL:        p.get('email')    || '',
    DOB:          p.get('dob')      || '',
    GENDER:       p.get('gender')   || '',
    AADHAAR:      p.get('aadhaar')  || '',
    CATEGORY:     p.get('category') || '',
    ADDRESS:      p.get('address')  || '',
    DISTRICT:     p.get('district') || '',
    PIN:          p.get('pin')      || '',
    PHOTO_PATH:   p.get('photo')    || '',
    SIGN_PATH:    p.get('sign')     || '',
    QUAL_DEGREE:  p.get('qualDegree')     || '',
    QUAL_COLLEGE: p.get('qualCollege')    || '',
    QUAL_UNIV:    p.get('qualUniversity') || '',
    QUAL_YEAR:    p.get('qualYear')       || '',
    QUAL_PERCENT: p.get('qualPercent')    || '',
    BANK_ACCOUNT: p.get('bankAccount')    || '',
    BANK_IFSC:    p.get('bankIfsc')       || '',
    BANK_NAME:    p.get('bankName')       || '',
  };

  const encoder = new TextEncoder();
  const stream  = new ReadableStream({
    start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      send({ type: 'start', message: '🔐 SSO login shuru ho rahi hai...' });

      const envKey    = ['GOVFORM', 'SCRIPTS', 'DIR'].join('_');
      const scriptsDir = (process.env[envKey] as string | undefined) || path.join(process.cwd(), 'scripts');
      const scriptPath = scriptsDir + path.sep + 'sso-browse.cjs';
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
