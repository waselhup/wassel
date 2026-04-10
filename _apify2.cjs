const TOKEN='apify_api_CWdZMugTbgkgRByDMhsYDTAmCzez3g4EZ4S9';
const URL='https://www.linkedin.com/in/ali-alhashim-b786b626a';
const actors = [
  'harvestapi~linkedin-profile-scraper',
  'dev_fusion~Linkedin-Profile-Scraper',
  'apimaestro~linkedin-profile-detail',
  'curious_coder~linkedin-profile-scraper',
];
(async () => {
  for (const actor of actors) {
    try {
      const r = await fetch(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${TOKEN}`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ profileUrls:[URL], urls:[URL], startUrls:[{url:URL}] })
      });
      const t = await r.text();
      console.log(`[${actor}] ${r.status} ${t.slice(0,500)}`);
    } catch(e) { console.log(`[${actor}] ERR ${e.message}`); }
  }
})();
