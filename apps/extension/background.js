// ============================================================
// WASSEL EXTENSION v5.0.0 — Background Service Worker
// Cloud-first: All LinkedIn actions via Voyager API on server.
// Extension role: cookie extraction, token sync, prospect collection.
// ============================================================

const API_BASE = 'https://wassel-alpha.vercel.app/api';
const DASHBOARD_ORIGIN = 'https://wassel-alpha.vercel.app';

console.log('[Wassel] 🚀 Background v5.0.0 loaded (cloud-only)', new Date().toLocaleTimeString());

// ============================================================================
// SAFE MESSAGE SENDING — prevents "Receiving end does not exist" crashes
// ============================================================================
async function safeSendMessage(tabId, message) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab) return null;
    if (!tab.url?.includes('linkedin.com') &&
        !tab.url?.includes('wassel-alpha.vercel.app')) {
      return null;
    }
    if (tab.status !== 'complete') {
      await new Promise((resolve) => {
        const listener = (id, changeInfo) => {
          if (id === tabId && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
        setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, 10000);
      });
    }
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    return null;
  }
}

async function ensureContentScript(tabId) {
  try {
    const response = await safeSendMessage(tabId, { type: 'PING' });
    if (response?.status !== 'alive') {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (e) {
    console.warn('[Wassel] Could not inject content script:', e.message);
  }
}

// ============================================================================
// LINKEDIN COOKIE EXTRACTION — sends li_at + JSESSIONID to server
// ============================================================================
async function extractAndStoreCookies() {
  try {
    const token = await getToken();
    if (!token) {
      console.log('[Wassel] No token — skipping cookie extraction');
      return { success: false, reason: 'no_token' };
    }

    const cookies = await chrome.cookies.getAll({ domain: '.linkedin.com' });
    const liAt = cookies.find(c => c.name === 'li_at');
    const jsessionId = cookies.find(c => c.name === 'JSESSIONID');

    if (!liAt?.value) {
      console.log('[Wassel] No li_at cookie — user may not be logged into LinkedIn');
      return { success: false, reason: 'no_li_at' };
    }

    const res = await fetch(`${API_BASE}/session/store`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        li_at: liAt.value,
        jsessionid: jsessionId?.value ? jsessionId.value.replace(/"/g, '') : '',
      }),
    });

    const data = await res.json();
    console.log('[Wassel] 🍪 Cookie store:', data.success ? 'OK' : (data.error || 'failed'));
    return data;
  } catch (e) {
    console.warn('[Wassel] Cookie extraction error:', e.message);
    return { success: false, reason: e.message };
  }
}

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================
async function getToken() {
  const data = await chrome.storage.local.get(['wasselToken']);
  return data.wasselToken || null;
}

async function syncTokenFromDashboard() {
  try {
    const tabs = await chrome.tabs.query({});
    const wasselTab = tabs.find(t => t.url && t.url.includes('wassel-alpha.vercel.app'));

    if (!wasselTab || !wasselTab.id) {
      console.log('[Wassel] No dashboard tab found');
      return { synced: false, reason: 'no_tab' };
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: wasselTab.id },
      func: () => {
        const keys = Object.keys(localStorage);
        const directToken = localStorage.getItem('supabase_token');
        if (directToken) return { token: directToken, source: 'supabase_token' };

        const sbKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
        if (sbKey) {
          try {
            const parsed = JSON.parse(localStorage.getItem(sbKey));
            const t = parsed?.access_token || parsed?.currentSession?.access_token;
            if (t) return { token: t, source: sbKey };
          } catch {}
        }

        const fallbackKey = keys.find(k =>
          k.toLowerCase().includes('supabase') && k.toLowerCase().includes('auth')
        );
        if (fallbackKey) {
          try {
            const parsed = JSON.parse(localStorage.getItem(fallbackKey));
            const t = parsed?.access_token || parsed?.currentSession?.access_token;
            if (t) return { token: t, source: fallbackKey };
          } catch {}
        }
        return null;
      },
    });

    if (results?.[0]?.result) {
      const { token, source } = results[0].result;
      await chrome.storage.local.set({ wasselToken: token });
      console.log(`[Wassel] ✅ Token synced (${source})`);
      // After token sync, also extract LinkedIn cookies for cloud automation
      extractAndStoreCookies();
      return { synced: true, source };
    }

    return { synced: false, reason: 'no_token' };
  } catch (e) {
    console.error('[Wassel] Token sync error:', e.message);
    return { synced: false, reason: e.message };
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ============================================================================
// CSV DOWNLOAD — saves prospects to user's PC after import
// ============================================================================
function downloadProspectsCSV(prospects) {
  try {
    const headers = ['Name', 'Title', 'Company', 'LinkedIn URL', 'Imported At'];
    const today = new Date().toLocaleDateString();
    const rows = prospects.map(p => [
      p.name || '', p.title || p.job_title || '', p.company || '',
      p.linkedin_url || p.linkedinUrl || '', today,
    ]);
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const reader = new FileReader();
    reader.onload = () => {
      chrome.downloads.download({
        url: reader.result,
        filename: `wassel-prospects-${new Date().toISOString().slice(0, 10)}.csv`,
        saveAs: false,
      });
    };
    reader.readAsDataURL(blob);
  } catch (e) {
    console.error('[Wassel] CSV error:', e);
  }
}

// ============================================================================
// PROSPECT EXTRACTION — injected into LinkedIn pages
// ============================================================================
function extractProspects() {
  const prospects = [];
  const seen = new Set();

  function extractName(container) {
    const nameSelectors = [
      '.entity-result__title-text a span[aria-hidden="true"]',
      '.entity-result__title-line a span[dir="ltr"] span[aria-hidden="true"]',
      '.app-aware-link span[aria-hidden="true"]',
      '.artdeco-entity-lockup__title span',
      '[data-anonymize="person-name"]',
      'span[aria-hidden="true"]',
      '[class*="title"] span',
      '[class*="name"]',
      'span.t-16',
      'span.t-bold',
    ];
    for (const sel of nameSelectors) {
      const el = container.querySelector(sel);
      const text = el?.innerText?.trim()?.split('\n')[0]?.trim();
      if (text && text.length > 1 && !text.includes('·') &&
          !text.toLowerCase().includes('connect') &&
          !text.toLowerCase().includes('follow') &&
          !text.toLowerCase().includes('message') &&
          !text.toLowerCase().includes('pending')) {
        return text.substring(0, 100);
      }
    }
    return '';
  }

  function addProspect(name, linkedinUrl, container) {
    if (!name || name.length < 2 || !linkedinUrl || !linkedinUrl.includes('/in/')) return;
    const cleanUrl = linkedinUrl.split('?')[0];
    if (seen.has(cleanUrl)) return;
    const slug = cleanUrl.split('/in/')[1];
    if (!slug || slug.replace(/\//g, '').length < 3) return;
    seen.add(cleanUrl);

    const titleEl = container?.querySelector(
      '.entity-result__primary-subtitle, .artdeco-entity-lockup__subtitle, [data-anonymize="title"], .entity-result__summary, [class*="primary-subtitle"]'
    );
    const companyEl = container?.querySelector(
      '.entity-result__secondary-subtitle, [class*="secondary-subtitle"]'
    );
    const locationEl = container?.querySelector(
      '.entity-result__tertiary-subtitle, .entity-result__location, [data-anonymize="location"], [class*="tertiary-subtitle"], [class*="location"]'
    );
    const photoEl = container?.querySelector(
      'img.presence-entity__image, img.EntityPhoto-circle-3, img[class*="profile-photo"], .ivm-image-view-model img, img.ivm-view-attr__img--centered, img'
    );
    const photoSrc = photoEl?.src || '';
    const photoUrl = (photoSrc.includes('media') || photoSrc.includes('profile')) ? photoSrc : null;

    prospects.push({
      name,
      title: (titleEl?.innerText?.trim() || '').substring(0, 150),
      company: (companyEl?.innerText?.trim() || '').substring(0, 100),
      location: (locationEl?.innerText?.trim() || '').substring(0, 100),
      linkedin_url: cleanUrl,
      photo_url: photoUrl,
    });
  }

  let cards = document.querySelectorAll('[data-view-name="search-entity-result-universal-template"]');
  if (cards.length === 0) cards = document.querySelectorAll('.search-results-container ul > li');
  if (cards.length === 0) cards = document.querySelectorAll('.reusable-search__result-container, .entity-result');
  if (cards.length === 0) cards = Array.from(document.querySelectorAll('li')).filter(li => li.querySelector('a[href*="/in/"]'));

  if (cards.length > 0) {
    cards.forEach(card => {
      try {
        const name = extractName(card);
        const linkEl = card.querySelector('a[href*="/in/"], a.app-aware-link[href*="/in/"]');
        const linkedinUrl = linkEl ? linkEl.href.split('?')[0] : '';
        addProspect(name, linkedinUrl, card);
      } catch (e) { /* skip */ }
    });
  }

  if (prospects.length === 0) {
    const links = document.querySelectorAll('a[href*="/in/"]');
    links.forEach(link => {
      try {
        const href = link.href || '';
        if (!href.includes('linkedin.com/in/')) return;
        const li = link.closest('li');
        const container = li || link.closest('[class*="result"]') || link.parentElement;
        if (!container) return;
        const name = extractName(container);
        addProspect(name, href, container);
      } catch (e) { /* skip */ }
    });
  }

  return prospects;
}

// ============================================================================
// MULTI-PAGE COLLECTION
// ============================================================================
let stopCollection = false;

async function collectMultiPageProspects(targetCount, tabId) {
  let allProspects = [];
  let pageNum = 1;
  const maxPages = Math.ceil(targetCount / 10) + 2;
  stopCollection = false;

  console.log(`[Wassel] 🎯 Starting collection: ${targetCount} prospects`);

  while (allProspects.length < targetCount && pageNum <= maxPages && !stopCollection) {
    if (tabId) await safeSendMessage(tabId, { type: 'PROGRESS_UPDATE', collected: allProspects.length, target: targetCount, page: pageNum });
    try {
      chrome.runtime.sendMessage({ type: 'PROGRESS_UPDATE', collected: allProspects.length, target: targetCount, page: pageNum });
    } catch (e) { /* popup may be closed */ }

    try {
      const results = await chrome.scripting.executeScript({ target: { tabId }, func: extractProspects });
      const pageProspects = results?.[0]?.result || [];
      pageProspects.forEach(p => {
        if (!allProspects.find(e => e.linkedin_url === p.linkedin_url)) {
          allProspects.push(p);
        }
      });
      console.log(`[Wassel] Page ${pageNum}: ${pageProspects.length} found, total: ${allProspects.length}`);
    } catch (e) {
      console.error(`[Wassel] Scan error on page ${pageNum}:`, e.message);
      break;
    }

    if (allProspects.length >= targetCount || stopCollection) break;

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => { window.scrollTo(0, document.body.scrollHeight); },
      });
      await sleep(1500);

      const nextResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const nextBtn = document.querySelector(
            'button[aria-label="Next"], button[aria-label="التالي"], .artdeco-pagination__button--next, button[aria-label*="next" i]'
          );
          if (nextBtn && !nextBtn.disabled) { nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' }); nextBtn.click(); return true; }
          const currentPage = document.querySelector('.artdeco-pagination__indicator--number.active button');
          const nextPageNum = currentPage ? parseInt(currentPage.textContent) + 1 : null;
          if (nextPageNum) {
            const pageBtn = Array.from(document.querySelectorAll('.artdeco-pagination__indicator--number button'))
              .find(b => parseInt(b.textContent) === nextPageNum);
            if (pageBtn) { pageBtn.click(); return true; }
          }
          return false;
        },
      });

      if (!nextResult?.[0]?.result) { console.log('[Wassel] No more pages'); break; }
      await sleep(4000 + Math.random() * 2000);

      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => new Promise(resolve => {
          let checks = 0;
          const interval = setInterval(() => {
            checks++;
            const results = document.querySelectorAll('[data-view-name="search-entity-result-universal-template"], .search-results-container ul > li, .entity-result');
            if (results.length > 0 || checks >= 20) { clearInterval(interval); resolve(true); }
          }, 500);
        }),
      });

      pageNum++;
    } catch (e) {
      console.error('[Wassel] Navigation error:', e.message);
      break;
    }
  }

  const finalProspects = allProspects.slice(0, targetCount);
  console.log(`[Wassel] ✅ Collection complete: ${finalProspects.length} prospects`);
  return finalProspects;
}

// ============================================================================
// MESSAGE HANDLER — from popup and content scripts
// ============================================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_CONFIG') {
    getToken().then(token => sendResponse({ apiToken: token, apiUrl: API_BASE }));
    return true;
  }

  if (message.type === 'SYNC_TOKEN') {
    syncTokenFromDashboard().then(sendResponse);
    return true;
  }

  if (message.type === 'START_COLLECTION') {
    const targetCount = message.targetCount;
    const tabId = message.tabId || sender.tab?.id;
    collectMultiPageProspects(targetCount, tabId).then(async (prospects) => {
      if (tabId) {
        await ensureContentScript(tabId);
        await safeSendMessage(tabId, { type: 'COLLECTION_COMPLETE', prospects });
      }
      try { chrome.runtime.sendMessage({ type: 'COLLECTION_COMPLETE', prospects }); } catch (e) {}
    });
    sendResponse({ started: true });
    return true;
  }

  if (message.type === 'STOP_COLLECTION') {
    stopCollection = true;
    sendResponse({ stopped: true });
    return true;
  }

  if (message.type === 'IMPORT_PROSPECTS') {
    const { campaignId, sourceUrl, prospects } = message;
    fetch(`${API_BASE}/ext/import`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${message.token || ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: campaignId || null, source_url: sourceUrl, prospects }),
    })
      .then(r => r.json())
      .then(response => { if (response?.success) downloadProspectsCSV(prospects); sendResponse(response); })
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === 'TEST_CONNECTION') {
    fetch(`${API_BASE}/health`)
      .then(r => r.json())
      .then(data => sendResponse({ ok: true, data }))
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (message.type === 'GET_AUTOMATION_STATUS') {
    sendResponse({ isProcessing: false, mode: 'cloud' });
    return true;
  }

  if (message.type === 'EXTRACT_COOKIES') {
    extractAndStoreCookies().then(result => sendResponse(result));
    return true;
  }
});

// ============================================================================
// ALARMS — cookie refresh and token sync
// ============================================================================
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'tokenSync') {
    await syncTokenFromDashboard();
  }
  if (alarm.name === 'cookieRefresh') {
    await extractAndStoreCookies();
  }
});

// ============================================================================
// STARTUP
// ============================================================================
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Wassel] Extension installed (v5.0.0 cloud-only)');
  chrome.storage.local.set({ apiUrl: API_BASE });

  // Cookie refresh every 12 hours, token sync every 30 minutes
  chrome.alarms.create('tokenSync', { periodInMinutes: 30 });
  chrome.alarms.create('cookieRefresh', { periodInMinutes: 720 });

  await syncTokenFromDashboard();
  setTimeout(extractAndStoreCookies, 5000);
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('[Wassel] Chrome started (v5.0.0 cloud-only)');
  chrome.alarms.create('tokenSync', { periodInMinutes: 30 });
  chrome.alarms.create('cookieRefresh', { periodInMinutes: 720 });

  await syncTokenFromDashboard();
  setTimeout(extractAndStoreCookies, 3000);
});

// Service worker wake fallback
(async () => {
  await sleep(2000);
  const token = await getToken();
  if (!token) {
    await syncTokenFromDashboard();
  }
  // Always try to refresh cookies on wake
  setTimeout(extractAndStoreCookies, 5000);
})();
