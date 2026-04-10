const TOKEN='apify_api_CWdZMugTbgkgRByDMhsYDTAmCzez3g4EZ4S9';
const ACTOR='harvestapi~linkedin-profile-search';
const URL='https://www.linkedin.com/in/ali-alhashim-b786b626a';
(async () => {
  const variants = [
    { tag:'searchUrls', body:{ searchUrls:[URL], maxResults:1 } },
    { tag:'profiles', body:{ profiles:[URL], maxItems:1 } },
    { tag:'urls', body:{ urls:[URL], maxItems:1 } },
    { tag:'profileUrls', body:{ profileUrls:[URL], maxItems:1 } },
    { tag:'linkedinUrls', body:{ linkedinUrls:[URL] } },
    { tag:'queries', body:{ queries:[URL] } },
  ];
  for (const v of variants) {
    try {
      const r = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${TOKEN}`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(v.body)
      });
      const t = await r.text();
      console.log(`[${v.tag}] ${r.status} ${t.slice(0,400)}`);
    } catch(e) { console.log(`[${v.tag}] ERR ${e.message}`); }
  }
})();
