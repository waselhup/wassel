import { build } from 'esbuild';

build({
  entryPoints: ['server/_core/vercel.ts'],
  platform: 'node',
  bundle: true,
  format: 'cjs',
  outfile: 'api/index.js',
  // Keep node built-in modules external
  external: [],
  // Ensure proper CJS output
  mainFields: ['module', 'main'],
  conditions: ['node', 'import', 'require'],
  target: 'node20',
}).catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
