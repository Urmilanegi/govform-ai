import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getGovformCredsFile } from '@/lib/govform-runtime';

const CREDS_FILE = getGovformCredsFile();
const CREDS_DIR = path.dirname(CREDS_FILE);

function load(): Record<string, Record<string, string>> {
  try {
    fs.mkdirSync(CREDS_DIR, { recursive: true });
    if (!fs.existsSync(CREDS_FILE)) return {};
    return JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
  } catch { return {}; }
}

function save(data: Record<string, Record<string, string>>) {
  fs.mkdirSync(CREDS_DIR, { recursive: true });
  fs.writeFileSync(CREDS_FILE, JSON.stringify(data, null, 2));
}

// GET /api/credentials?exam=rrb
export async function GET(req: NextRequest) {
  const exam = req.nextUrl.searchParams.get('exam');
  const all  = load();
  if (exam) return NextResponse.json({ creds: all[exam] || null });
  return NextResponse.json({ creds: all });
}

// POST /api/credentials  body: { exam, ...fields }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { exam, ...fields } = body;
  if (!exam) return NextResponse.json({ ok: false, error: 'exam required' }, { status: 400 });
  const all = load();
  all[exam] = { ...(all[exam] || {}), ...fields };
  save(all);
  return NextResponse.json({ ok: true });
}

// DELETE /api/credentials?exam=rrb
export async function DELETE(req: NextRequest) {
  const exam = req.nextUrl.searchParams.get('exam');
  const all  = load();
  if (exam) delete all[exam];
  else Object.keys(all).forEach(k => delete all[k]);
  save(all);
  return NextResponse.json({ ok: true });
}
