import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@sparticuz/chromium',
    'playwright',
    'playwright-core',
    'tar-fs',
    'tar-stream',
    'streamx',
    'b4a',
    'fast-fifo',
    'events-universal',
    'text-decoder',
    'pump',
    'end-of-stream',
    'once',
    'wrappy',
    'sharp',
    'tesseract.js',
  ],
  outputFileTracingIncludes: {
    '/*': [
      './scripts/**/*',
      './chrome-extension/**/*',
      './node_modules/playwright/**/*',
      './node_modules/playwright-core/**/*',
      './node_modules/@sparticuz/chromium/**/*',
      './node_modules/tar-fs/**/*',
      './node_modules/tar-stream/**/*',
      './node_modules/pump/**/*',
      './node_modules/streamx/**/*',
      './node_modules/b4a/**/*',
      './node_modules/fast-fifo/**/*',
      './node_modules/events-universal/**/*',
      './node_modules/text-decoder/**/*',
      './node_modules/end-of-stream/**/*',
      './node_modules/once/**/*',
      './node_modules/wrappy/**/*',
    ],
  },
};

export default nextConfig;
