const https = require('https');

https.get('https://wassel-alpha.vercel.app/assets/index-Ddijk1tE.js', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    // Find supabase URLs
    const matches = data.match(/[a-z0-9]+\.supabase\.co/g);
    if (matches) {
      const unique = [...new Set(matches)];
      console.log('Supabase URLs found in client bundle:');
      unique.forEach(m => console.log('  ' + m));
    } else {
      console.log('No supabase URLs found');
    }
  });
}).on('error', e => console.error(e));
