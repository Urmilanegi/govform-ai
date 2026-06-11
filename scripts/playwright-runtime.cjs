const fs = require('fs');
const os = require('os');
const path = require('path');

function isServerlessRuntime() {
  return Boolean(
    process.env.GOVFORM_SERVERLESS === '1' ||
    process.env.VERCEL ||
    process.env.RENDER ||
    process.env.AWS_LAMBDA_FUNCTION_VERSION ||
    process.env.LAMBDA_TASK_ROOT
  );
}

function getGovformDataDir() {
  const baseDir =
    process.env.GOVFORM_DATA_DIR ||
    (isServerlessRuntime()
      ? path.join(os.tmpdir(), 'govform')
      : path.join(os.homedir(), '.govform'));

  fs.mkdirSync(baseDir, { recursive: true });
  return baseDir;
}

function getGovformProfileDir(profileName) {
  const profileDir = path.join(getGovformDataDir(), profileName);
  fs.mkdirSync(profileDir, { recursive: true });
  return profileDir;
}

function getGovformCredsFile() {
  const credsFile = path.join(getGovformDataDir(), 'credentials.json');
  fs.mkdirSync(path.dirname(credsFile), { recursive: true });
  return credsFile;
}

async function loadChromiumRuntime() {
  if (isServerlessRuntime()) {
    const { chromium } = require('playwright-core');
    const chromiumBundle = require('@sparticuz/chromium');

    return {
      chromium,
      launchOptions: {
        executablePath: await chromiumBundle.executablePath(),
        headless: true,
        args: chromiumBundle.args,
      },
    };
  }

  const { chromium } = require('playwright');
  return {
    chromium,
    launchOptions: {},
  };
}

async function ensureCamY4m(camFile) {
  // Chromium fake camera ko ek VALID y4m chahiye launch ke time pe (warna woh
  // default green test-pattern dikha deta hai jise SSC "blurry" reject karta hai).
  // Agar user ki photo pehle se hai to usi se banao, warna plain placeholder.
  if (fs.existsSync(camFile)) return;
  const { spawnSync } = require('child_process');
  const photo = path.join(os.tmpdir(), 'govform_photo.jpg');
  try {
    if (fs.existsSync(photo)) {
      spawnSync('ffmpeg', ['-y', '-loop', '1', '-i', photo, '-t', '5',
        '-vf', 'scale=480:640:force_original_aspect_ratio=decrease,pad=480:640:(ow-iw)/2:(oh-ih)/2:white,format=yuv420p',
        '-r', '25', '-pix_fmt', 'yuv420p', camFile], { stdio: 'ignore' });
    } else {
      // plain white 480x640 frame
      spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=white:s=480x640:d=1',
        '-frames:v', '1', '-pix_fmt', 'yuv420p', camFile], { stdio: 'ignore' });
    }
  } catch { /* ffmpeg na ho to flag skip ho jayega niche */ }
}

async function launchPersistentContext(profileDir, options = {}) {
  const { chromium, launchOptions } = await loadChromiumRuntime();
  // Fake webcam: SSC "Capture Live Photo" ko user ki khinchi photo (govform_cam.y4m)
  // dikhao. Flag HAMESHA lagao (file pehle se bana do) — warna default test-pattern aata hai.
  const camFile = path.join(os.tmpdir(), 'govform_cam.y4m');
  await ensureCamY4m(camFile);
  const fakeCamArgs = [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream', // camera permission auto-allow
  ];
  if (fs.existsSync(camFile)) fakeCamArgs.push(`--use-file-for-fake-video-capture=${camFile}`);
  const mergedArgs = [...new Set([...(launchOptions.args || []), ...fakeCamArgs, ...(options.args || [])])];
  const finalOptions = {
    ...options,
    ...launchOptions,
    args: mergedArgs,
  };

  if (isServerlessRuntime()) {
    delete finalOptions.channel;
    finalOptions.headless = true;
    finalOptions.viewport = finalOptions.viewport || { width: 1280, height: 900 };
  }

  fs.mkdirSync(profileDir, { recursive: true });
  return chromium.launchPersistentContext(profileDir, finalOptions);
}

module.exports = {
  getGovformCredsFile,
  getGovformDataDir,
  getGovformProfileDir,
  isServerlessRuntime,
  launchPersistentContext,
};

