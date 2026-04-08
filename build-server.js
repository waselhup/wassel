import { build } from 'esbuild';

build({
  entryPoints: ['server/_core/vercel.ts'],
  platform: 'node',
  bundle: true,
  format: 'cjs',
  outfile: 'api/index.js',
  external: ['@supabase/supabase-js'],
}).catch(() => process.exit(1));