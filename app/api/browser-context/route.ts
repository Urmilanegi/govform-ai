import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';

const CONTEXT_FILE = '/tmp/govform-browser-context.json';

function normalizeProfile(profile: Record<string, unknown> | null) {
  if (!profile || typeof profile !== 'object') return profile;

  const normalizedProfile = { ...profile } as Record<string, unknown>;

  for (const key of ['class10Board', 'class12Board']) {
    const value = String(normalizedProfile[key] || '').trim();
    if (/board of secondary education[, ]+(rajasthan|ajmer)/i.test(value)) {
      normalizedProfile[key] = 'Board of Secondary Education, Rajasthan';
    }
  }

  return normalizedProfile;
}

export async function GET() {
  try {
    const raw = await readFile(CONTEXT_FILE, 'utf8');
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ success: false, profile: null, portal: null, filledForm: null });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = {
      success: true,
      savedAt: Date.now(),
      profile: normalizeProfile(body.profile || null),
      portal: body.portal || null,
      filledForm: body.filledForm || null,
    };

    await writeFile(CONTEXT_FILE, JSON.stringify(payload), 'utf8');
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to save browser context', details: String(error) },
      { status: 500 }
    );
  }
}
