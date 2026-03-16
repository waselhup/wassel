try {
  const m = await import('./dist/api/index.js');
  console.log('OK:', Object.keys(m));
} catch (e) {
  console.error('FAIL:', e.message);
  console.error(e.stack);
}
