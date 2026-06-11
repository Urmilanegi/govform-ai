import { NextRequest, NextResponse } from 'next/server';
import { mkdtemp, readdir, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PORTAL_CONTEXT_PREFIX = 'govform-context=';
const EXTENSION_ID = 'ljopjbbejmcjdfmmppgmgonidfikecil';

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

function encodePortalContext(payload: unknown) {
  const raw = encodeURIComponent(JSON.stringify(payload));
  return `${PORTAL_CONTEXT_PREFIX}${Buffer.from(raw, 'utf8').toString('base64')}`;
}

function appendPortalContextToUrl(targetUrl: string, payload: unknown) {
  const url = new URL(targetUrl);
  url.hash = encodePortalContext(payload);
  return url.toString();
}

function getActiveBrowserContexts() {
  const globalState = globalThis as typeof globalThis & {
    __govformActiveBrowserContexts?: Set<{ close: () => Promise<void> }>;
  };

  if (!globalState.__govformActiveBrowserContexts) {
    globalState.__govformActiveBrowserContexts = new Set();
  }

  return globalState.__govformActiveBrowserContexts;
}

async function detectStoredContext(userDataDir: string) {
  try {
    const settingsDir = join(
      userDataDir,
      'Default',
      'Local Extension Settings',
      EXTENSION_ID
    );
    const files = await readdir(settingsDir);

    for (const file of files) {
      if (!file.endsWith('.log')) continue;
      const raw = await readFile(join(settingsDir, file));
      if (raw.includes(Buffer.from('govform_profile'))) {
        return true;
      }
    }
  } catch {}

  return false;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const targetUrl = body.targetUrl || body.portal?.loginUrl || body.portal?.registerUrl || body.portal?.applyUrl;

    if (!targetUrl) {
      return NextResponse.json(
        { success: false, error: 'Portal URL missing hai.' },
        { status: 400 }
      );
    }

    const extensionDir = join(process.cwd(), 'chrome-extension');
    const userDataDir = await mkdtemp(join(tmpdir(), 'govform-managed-chromium-'));
    const normalizedProfile = normalizeProfile(body.profile || null);
    const contextualUrl = appendPortalContextToUrl(targetUrl, {
      profile: normalizedProfile,
      portal: body.portal || null,
      credentials: body.credentials || null,
      filledForm: body.filledForm || null,
      autoActive: body.autoActive !== false,
    });

    const { chromium } = await import('playwright');
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: false,
      viewport: null,
      args: [
        `--disable-extensions-except=${extensionDir}`,
        `--load-extension=${extensionDir}`,
      ],
    });

    const activeContexts = getActiveBrowserContexts();
    activeContexts.add(context);
    context.on('close', () => {
      activeContexts.delete(context);
    });

    const page = context.pages()[0] || await context.newPage();
    await page.goto(contextualUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.bringToFront();
    await page.waitForTimeout(1800);

    const finalUrl = page.url();
    const hydrated = await detectStoredContext(userDataDir);

    return NextResponse.json({
      success: true,
      launchedAt: Date.now(),
      url: finalUrl,
      hydrated,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Helper browser launch nahi hua.',
        details: String(error),
      },
      { status: 500 }
    );
  }
}
