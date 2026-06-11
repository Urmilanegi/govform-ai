import fs from 'fs';
import os from 'os';
import path from 'path';

export function isServerlessRuntime() {
  return Boolean(
    process.env.GOVFORM_SERVERLESS === '1' ||
    process.env.VERCEL ||
    process.env.RENDER ||
    process.env.AWS_LAMBDA_FUNCTION_VERSION ||
    process.env.LAMBDA_TASK_ROOT
  );
}

export function getGovformDataDir() {
  const baseDir =
    process.env.GOVFORM_DATA_DIR ||
    (isServerlessRuntime()
      ? path.join(os.tmpdir(), 'govform')
      : path.join(os.homedir(), '.govform'));

  fs.mkdirSync(baseDir, { recursive: true });
  return baseDir;
}

export function getGovformProfileDir(profileName: string) {
  const profileDir = path.join(getGovformDataDir(), profileName);
  fs.mkdirSync(profileDir, { recursive: true });
  return profileDir;
}

export function getGovformCredsFile() {
  const credsFile = path.join(getGovformDataDir(), 'credentials.json');
  fs.mkdirSync(path.dirname(credsFile), { recursive: true });
  return credsFile;
}
