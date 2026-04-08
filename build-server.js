import { build } from 'esbuild';

build({
  entryPoints: ['server/_core/vercel.ts'],
  platform: 'node',
  bundle: true,
  format: 'esm',
  outfile: 'api/index.js',
  // Bundle everything — no externals for Vercel serverless
}).catch(() => process.exit(1));
