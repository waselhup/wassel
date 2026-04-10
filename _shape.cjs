const TOKEN='apify_api_CWdZMugTbgkgRByDMhsYDTAmCzez3g4EZ4S9';
const URL='https://www.linkedin.com/in/ali-alhashim-b786b626a';
(async () => {
  const r = await fetch(`https://api.apify.com/v2/acts/dev_fusion~Linkedin-Profile-Scraper/run-sync-get-dataset-items?token=${TOKEN}`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ profileUrls:[URL] })
  });
  const t = await r.text();
  console.log('STATUS', r.status);
  console.log('LEN', t.length);
  console.log('BODY', t.slice(0, 6000));
})();
