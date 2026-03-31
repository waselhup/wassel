// ============================================================
// WASSEL EXTENSION — DEVELOPER NOTICE
// Before committing any changes to this file or any file in
// apps/extension/, run: npm run ext:version
// This bumps the version in manifest.json and logs the change.
// ============================================================

// Wassel Extension — Background Service Worker v3
// Handles: token sync, automation queue polling, action execution, rate limiting

const API_BASE = 'https://wassel-alpha.vercel.app/api';
const DASHBOARD_ORIGIN = 'https://wassel-alpha.vercel.app';

console.log('[Wassel] 🚀 Background loaded!', new Date().toLocaleTimeString());

// ============================================================================
// SAFE MESSAGE SENDING — prevents "Receiving end does not exist" crashes
// ============================================================================
async function safeSendMessage(tabId, message) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab) return null;
    // Only send to LinkedIn or Wassel tabs — ignore all others
    if (!tab.url?.includes('linkedin.com') &&
        !tab.url?.includes('wassel-alpha.vercel.app')) {
      return null;
    }
    if (tab.status !== 'complete') {
      // Wait for tab to finish loading
      await new Promise((resolve) => {
        const listener = (id, changeInfo) => {
          if (id === tabId && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
        // Timeout after 10 seconds
        setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }, 10000);
      });
    }
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    // Content script not available on this tab — safe to ignore
    // Do NOT log as error — this is expected for tabs without content.js
    return null;
  }
}

async function isContentScriptReady(tabId) {
  try {
    // Use safeSendMessage to avoid 'Receiving end does not exist' errors
    const response = await safeSendMessage(tabId, { type: 'PING' });
    return response?.status === 'alive';
  } catch {
    return false;
  }
}

async function ensureContentScript(tabId) {
  const ready = await isContentScriptReady(tabId);
  if (!ready) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
      // Wait 1 second for content.js to initialize
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (injectError) {
      console.warn('[Wassel] Could not inject content script:', injectError.message);
    }
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
      return { synced: true, source };
    }

    return { synced: false, reason: 'no_token' };
  } catch (e) {
    console.error('[Wassel] Token sync error:', e.message);
    return { synced: false, reason: e.message };
  }
}

// ============================================================================
// RATE LIMITING — Daily limits stored in chrome.storage
// ============================================================================
const DAILY_LIMITS = {
  visit: 80,
  connect: 20,
  message: 30
};

async function checkDailyLimit(actionType) {
  const today = new Date().toDateString();
  const key = 'daily_' + actionType;
  const stored = await chrome.storage.local.get([key, key + '_date']);

  if (stored[key + '_date'] !== today) {
    await chrome.storage.local.set({ [key]: 0, [key + '_date']: today });
    return true;
  }

  const count = stored[key] || 0;
  const limit = DAILY_LIMITS[actionType] || 50;

  if (count >= limit) {
    console.warn('[Wassel] Daily limit reached for:', actionType, count + '/' + limit);
    return false;
  }

  await chrome.storage.local.set({ [key]: count + 1 });
  return true;
}

async function getDailyLimits() {
  const d = await chrome.storage.local.get('dailyLimits');
  const today = new Date().toDateString();
  const limits = d.dailyLimits;
  if (!limits || limits.date !== today) {
    const fresh = { date: today, visits: 0, invites: 0, messages: 0 };
    await chrome.storage.local.set({ dailyLimits: fresh });
    return fresh;
  }
  return limits;
}

async function incrementLimit(type) {
  const limits = await getDailyLimits();
  limits.date = new Date().toDateString();
  limits[type] = (limits[type] || 0) + 1;
  await chrome.storage.local.set({ dailyLimits: limits });
  console.log(`[Wassel] 📊 Daily ${type}: ${limits[type]}`);
}

function isGoodTime() {
  const h = new Date().getHours();
  return h >= 8 && h < 20;
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
// STEP STATUS UPDATE — reports completion/failure to backend
// ============================================================================
async function updateStepStatus(id, status, errorMsg) {
  const token = await getToken();
  if (!token || !id) return;

  try {
    const res = await fetch(`${API_BASE}/sequence/step/complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prospectStepId: id,
        status: status,
        errorMessage: errorMsg || null,
      }),
    });
    const data = await res.json();
    console.log(`[Wassel] Step ${id.slice(0, 8)}… → ${status}`, data.success ? '✓' : data.error);
  } catch (e) {
    console.error('[Wassel] updateStep failed:', e.message);
  }
}

// ============================================================================
// ACTION EXECUTION — visit, invite, message
// ============================================================================
async function doVisit(url, stepId, name) {
  console.log(`[Wassel] 👁 Visiting: ${name} — ${url}`);
  let tabId = null;
  try {
    const tab = await chrome.tabs.create({ url, active: false });
    tabId = tab.id;
    console.log(`[Wassel] 📂 Tab opened: ${tabId}`);
    const wait = 5000 + Math.random() * 3000;
    await sleep(wait);
    await updateStepStatus(stepId, 'completed');
    console.log(`[Wassel] ✅ Visit done: ${name}`);
  } catch (e) {
    console.error(`[Wassel] Visit error for ${name}:`, e.message);
    await updateStepStatus(stepId, 'failed', e.message);
  } finally {
    if (tabId) { try { await chrome.tabs.remove(tabId); } catch {} }
  }
}

async function doInvite(url, note, stepId, name) {
  console.log(`[Wassel] 🤝 Inviting: ${name} — ${url}`);
  let tabId = null;
  try {
    const tab = await chrome.tabs.create({ url, active: true });
    tabId = tab.id;

    // Wait for page to fully load (up to 15s)
    await new Promise(resolve => {
      const listener = (id, changeInfo) => {
        if (id === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, 15000);
    });

    await ensureContentScript(tabId);

    // Delegate to content.js which has robust multi-method Connect detection
    const result = await chrome.tabs.sendMessage(tabId, { type: 'SEND_INVITE', note: note || '' });
    console.log('[Wassel] SEND_INVITE result:', JSON.stringify(result));

    if (result?.ok) {
      await incrementLimit('invites');
      await updateStepStatus(stepId, 'completed');
      console.log(`[Wassel] ✅ Invite sent to: ${name}`);
      return { ok: true };
    } else {
      const errMsg = result?.error || 'Connect button not found';
      await updateStepStatus(stepId, 'failed', errMsg);
      console.warn(`[Wassel] ⚠️ Invite failed for ${name}:`, errMsg);
      return { ok: false, error: errMsg };
    }
  } catch (e) {
    console.error(`[Wassel] Invite error for ${name}:`, e.message);
    await updateStepStatus(stepId, 'failed', e.message);
    return { ok: false, error: e.message };
  } finally {
    await sleep(1000);
    if (tabId) { try { await chrome.tabs.remove(tabId); } catch {} }
  }
}

async function doMessage(url, message, stepId, name) {
  console.log(`[Wassel] 💬 Messaging: ${name} — ${url}`);
  let tabId = null;
  try {
    const tab = await chrome.tabs.create({ url, active: true });
    tabId = tab.id;

    // Wait for page to fully load (up to 15s)
    await new Promise(resolve => {
      const listener = (id, changeInfo) => {
        if (id === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, 15000);
    });

    await ensureContentScript(tabId);

    // Delegate to content.js which handles clicking Message, typing, and sending
    const result = await chrome.tabs.sendMessage(tabId, { type: 'SEND_MESSAGE', content: message });
    console.log('[Wassel] SEND_MESSAGE result:', JSON.stringify(result));

    if (result?.ok) {
      await incrementLimit('messages');
      await updateStepStatus(stepId, 'completed');
      console.log(`[Wassel] ✅ Message sent to: ${name}`);
      return { ok: true };
    } else {
      const errMsg = result?.error || 'Message failed';
      await updateStepStatus(stepId, 'failed', errMsg);
      return { ok: false, error: errMsg };
    }
  } catch (e) {
    console.error(`[Wassel] Message error for ${name}:`, e.message);
    await updateStepStatus(stepId, 'failed', e.message);
    return { ok: false, error: e.message };
  } finally {
    await sleep(1000);
    if (tabId) { try { await chrome.tabs.remove(tabId); } catch {} }
  }
}

// ============================================================================
// EXECUTE ACTION — dispatcher
// ============================================================================
async function executeAction(item) {
  const stepId = item.prospectStepId || item.id;
  const stepType = item.step_type || item.stepType;
  let url = item.linkedin_url || item.linkedinUrl;
  const message = item.message || item.message_template || '';
  const name = item.name || 'Unknown';

  // ── URL validation & normalization ──────────────────────────
  // If url is undefined/null/empty, fail immediately
  if (!url || typeof url !== 'string' || url.trim() === '') {
    console.error(`[Wassel] ❌ No LinkedIn URL for ${name} — skipping`);
    await updateStepStatus(stepId, 'failed', 'Missing LinkedIn URL');
    return;
  }

  url = url.trim();

  // Normalize relative paths like "/in/john" → full LinkedIn URL
  if (url.startsWith('/in/') || url.startsWith('/in?')) {
    url = 'https://www.linkedin.com' + url;
    console.log(`[Wassel] 🔧 Normalized relative URL → ${url}`);
  }

  // Ensure URL starts with https:// (reject chrome-extension://, file://, etc.)
  if (!url.startsWith('https://')) {
    console.error(`[Wassel] ❌ Invalid URL for ${name}: ${url}`);
    await updateStepStatus(stepId, 'failed', `Invalid URL: ${url}`);
    return;
  }
  // ────────────────────────────────────────────────────────────

  console.log(`[Wassel] 🎯 Executing: ${stepType} for ${name}`);
  await updateStepStatus(stepId, 'in_progress');

  let actionStatus = 'success';
  let actionError = null;

  try {
    if (stepType === 'visit') {
      const allowed = await checkDailyLimit('visit');
      if (!allowed) {
        console.warn('[Wassel] Skipping visit - daily limit reached (' + DAILY_LIMITS.visit + ')');
        await updateStepStatus(stepId, 'pending');
        actionStatus = 'skipped';
        actionError = 'Daily visit limit reached';
      } else {
        await doVisit(url, stepId, name);
      }
    } else if (stepType === 'invitation' || stepType === 'invite' || stepType === 'connection_request') {
      const allowed = await checkDailyLimit('connect');
      if (!allowed) {
        console.warn('[Wassel] Skipping invite - daily limit reached (' + DAILY_LIMITS.connect + ')');
        await updateStepStatus(stepId, 'pending');
        actionStatus = 'skipped';
        actionError = 'Daily invite limit reached';
      } else {
        const inviteResult = await doInvite(url, message, stepId, name);
        if (!inviteResult?.ok) { actionStatus = 'failed'; actionError = inviteResult?.error || 'Invite failed'; }
      }
    } else if (stepType === 'message' || stepType === 'follow' || stepType === 'follow_up') {
      const allowed = await checkDailyLimit('message');
      if (!allowed) {
        console.warn('[Wassel] Skipping message - daily limit reached (' + DAILY_LIMITS.message + ')');
        await updateStepStatus(stepId, 'pending');
        actionStatus = 'skipped';
        actionError = 'Daily message limit reached';
      } else {
        const msgResult = await doMessage(url, message, stepId, name);
        if (!msgResult?.ok) { actionStatus = 'failed'; actionError = msgResult?.error || 'Message failed'; }
      }
    } else {
      console.log(`[Wassel] ⚠️ Unknown step type: ${stepType}`);
      await updateStepStatus(stepId, 'failed', `Unknown: ${stepType}`);
      actionStatus = 'failed';
      actionError = `Unknown step type: ${stepType}`;
    }
  } catch (err) {
    console.error(`[Wassel] ❌ Execute failed:`, err.message);
    await updateStepStatus(stepId, 'failed', err.message);
    actionStatus = 'failed';
    actionError = err.message;
  }

  // ── Log activity to server for dashboard feed ──
  try {
    const tokenData = await chrome.storage.local.get(['wasselToken', 'authToken', 'token', 'wassel_token']);
    const token = tokenData.wasselToken || tokenData.authToken || tokenData.token || tokenData.wassel_token;
    console.log('[Wassel] 📝 Activity log — token found:', !!token, '| action:', stepType, '| status:', actionStatus);
    if (token) {
      const resp = await fetch('https://wassel-alpha.vercel.app/api/activity-log', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: stepType === 'invitation' || stepType === 'invite' || stepType === 'connection_request' ? 'connect' : stepType,
          status: actionStatus,
          prospect_name: name,
          linkedin_url: url,
          campaign_id: item.campaign_id || item.campaignId || null,
          error_message: actionError
        })
      });
      const result = await resp.json().catch(() => ({}));
      console.log('[Wassel] 📝 Activity logged:', resp.status, result);
    } else {
      console.warn('[Wassel] ⚠️ Activity log skipped — no auth token in storage');
    }
  } catch (logErr) {
    console.warn('[Wassel] Activity log failed (non-fatal):', logErr.message);
  }
}

// ============================================================================
// PROCESS QUEUE — main automation loop
// ============================================================================
let isProcessing = false;

async function processQueue() {
  if (isProcessing) {
    console.log('[Wassel] ⏳ Already processing, skip');
    return;
  }

  console.log('[Wassel] 🔄 Queue check:', new Date().toLocaleTimeString());

  if (!isGoodTime()) {
    console.log('[Wassel] ⏰ Outside hours (8am-8pm)');
    return;
  }

  let token = await getToken();

  // No token — try syncing from dashboard
  if (!token) {
    console.log('[Wassel] ❌ No token — attempting sync');
    const syncResult = await syncTokenFromDashboard();
    if (!syncResult?.synced) {
      console.log('[Wassel] ❌ Sync failed:', syncResult?.reason);
      return;
    }
    token = await getToken();
    if (!token) return;
  }

  isProcessing = true;

  try {
    let res;
    try {
      res = await fetch(`${API_BASE}/sequence/queue/active`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (fetchErr) {
      // Service worker wake-up can cause "Failed to fetch" — retry once after 3s
      console.warn('[Wassel] ⚠️ Fetch failed, retrying in 3s...', fetchErr.message);
      await new Promise(r => setTimeout(r, 3000));
      res = await fetch(`${API_BASE}/sequence/queue/active`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    }

    // Handle 401 — token expired, resync and retry once
    if (res.status === 401) {
      console.log('[Wassel] ⚠️ Token expired (401) — resyncing...');
      await chrome.storage.local.remove('wasselToken');
      const syncResult = await syncTokenFromDashboard();
      if (!syncResult?.synced) {
        console.log('[Wassel] ❌ Resync failed — open dashboard');
        return;
      }
      token = await getToken();
      if (!token) return;

      // Retry with fresh token
      res = await fetch(`${API_BASE}/sequence/queue/active`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.status === 401) {
        console.log('[Wassel] ❌ Still 401 after resync — token invalid');
        return;
      }
    }

    if (!res.ok) {
      const text = await res.text();
      console.error(`[Wassel] ❌ Queue API error: ${res.status}`, text.substring(0, 200));
      return;
    }

    const data = await res.json();
    const queue = data.queue || [];

    console.log(`[Wassel] 📋 Queue items: ${queue.length}`);

    if (!queue.length) {
      console.log('[Wassel] 📭 Queue empty — no pending actions');
      return;
    }

    const item = queue[0];
    console.log(`[Wassel] ▶ Next: ${item.step_type} for ${item.name} | ${item.linkedin_url}`);

    await executeAction(item);

    // Random delay before next (45-90s)
    const delay = 45000 + Math.random() * 45000;
    console.log(`[Wassel] ⏱ Next check in ${Math.round(delay / 1000)}s`);

  } catch (err) {
    console.error('[Wassel] ❌ Queue error:', err.message);
  } finally {
    isProcessing = false;
  }
}

// ============================================================================
// PROSPECT EXTRACTION — injected into LinkedIn pages
// ============================================================================
function extractProspects() {
  const prospects = [];
  const seen = new Set();

  // Helper to extract name from a container element
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

  // Helper to add a prospect
  function addProspect(name, linkedinUrl, container) {
    if (!name || name.length < 2 || !linkedinUrl || !linkedinUrl.includes('/in/')) return;
    const cleanUrl = linkedinUrl.split('?')[0];
    if (seen.has(cleanUrl)) return;
    const slug = cleanUrl.split('/in/')[1];
    if (!slug || slug.replace(/\//g, '').length < 3) return;
    seen.add(cleanUrl);

    // Title: job title / headline
    const titleEl = container?.querySelector(
      '.entity-result__primary-subtitle, ' +
      '.artdeco-entity-lockup__subtitle, ' +
      '[data-anonymize="title"], ' +
      '.entity-result__summary, ' +
      '[class*="primary-subtitle"]'
    );
    // Company: secondary subtitle
    const companyEl = container?.querySelector(
      '.entity-result__secondary-subtitle, ' +
      '[class*="secondary-subtitle"]'
    );
    // Location: tertiary subtitle or location field
    const locationEl = container?.querySelector(
      '.entity-result__tertiary-subtitle, ' +
      '.entity-result__location, ' +
      '[data-anonymize="location"], ' +
      '[class*="tertiary-subtitle"], ' +
      '[class*="location"]'
    );
    const photoEl = container?.querySelector(
      'img.presence-entity__image, img.EntityPhoto-circle-3, ' +
      'img[class*="profile-photo"], .ivm-image-view-model img, ' +
      'img.ivm-view-attr__img--centered, img'
    );
    const photoSrc = photoEl?.src || '';
    const photoUrl = (photoSrc.includes('media') || photoSrc.includes('profile')) ? photoSrc : null;

    prospects.push({
      name: name,
      title: (titleEl?.innerText?.trim() || '').substring(0, 150),
      company: (companyEl?.innerText?.trim() || '').substring(0, 100),
      location: (locationEl?.innerText?.trim() || '').substring(0, 100),
      linkedin_url: cleanUrl,
      photo_url: photoUrl,
    });
  }

  // ── Strategy 1: data-view-name attribute (newest LinkedIn) ──
  let cards = document.querySelectorAll('[data-view-name="search-entity-result-universal-template"]');
  if (cards.length === 0) {
    // Strategy 2: search-results-container li
    cards = document.querySelectorAll('.search-results-container ul > li');
  }
  if (cards.length === 0) {
    // Strategy 3: reusable-search / entity-result classes
    cards = document.querySelectorAll('.reusable-search__result-container, .entity-result');
  }
  if (cards.length === 0) {
    // Strategy 4: any li with /in/ links
    cards = Array.from(document.querySelectorAll('li')).filter(li => li.querySelector('a[href*="/in/"]'));
  }

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

  // ── Strategy 5: fallback — scrape all /in/ links on the page ──
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
// MULTI-PAGE COLLECTION — collects prospects across multiple LinkedIn pages
// ============================================================================
let stopCollection = false;

async function collectMultiPageProspects(targetCount, tabId) {
  let allProspects = [];
  let pageNum = 1;
  const maxPages = Math.ceil(targetCount / 10) + 2;
  stopCollection = false;

  console.log(`[Wassel] 🎯 Starting collection: ${targetCount} prospects`);

  while (allProspects.length < targetCount && pageNum <= maxPages && !stopCollection) {
    console.log(`[Wassel] 📄 Scanning page ${pageNum}...`);

    // Send progress to content script sidebar and popup
    if (tabId) await safeSendMessage(tabId, { type: 'PROGRESS_UPDATE', collected: allProspects.length, target: targetCount, page: pageNum });
    try {
      chrome.runtime.sendMessage({ type: 'PROGRESS_UPDATE', collected: allProspects.length, target: targetCount, page: pageNum });
    } catch (e) { /* popup may be closed */ }

    // Scan current page
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: extractProspects,
      });

      const pageProspects = results?.[0]?.result || [];
      console.log(`[Wassel] Found on page ${pageNum}: ${pageProspects.length}`);

      // Add unique prospects
      pageProspects.forEach(p => {
        if (!allProspects.find(e => e.linkedin_url === p.linkedin_url)) {
          allProspects.push(p);
        }
      });

      console.log(`[Wassel] Total collected: ${allProspects.length}`);
    } catch (e) {
      console.error(`[Wassel] Scan error on page ${pageNum}:`, e.message);
      break;
    }

    if (allProspects.length >= targetCount || stopCollection) break;

    // Navigate to next page
    try {
      // Scroll to bottom first so pagination is visible
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => { window.scrollTo(0, document.body.scrollHeight); },
      });
      await sleep(1500);

      const prevCount = allProspects.length;

      const nextResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const nextBtn = document.querySelector(
            'button[aria-label="Next"], ' +
            'button[aria-label="التالي"], ' +
            '.artdeco-pagination__button--next, ' +
            'button[aria-label*="next" i], ' +
            'li.artdeco-pagination__indicator--number.active + li button'
          );
          if (nextBtn && !nextBtn.disabled) {
            nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            nextBtn.click();
            return true;
          }
          // Fallback: try page number link
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

      const hasNext = nextResult?.[0]?.result;
      if (!hasNext) {
        console.log('[Wassel] No more pages available');
        break;
      }

      // Wait for next page to load — minimum 4 seconds + random jitter
      await sleep(4000 + Math.random() * 2000);

      // Wait for new results to appear (up to 10 seconds)
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          return new Promise(resolve => {
            let checks = 0;
            const interval = setInterval(() => {
              checks++;
              const results = document.querySelectorAll(
                '[data-view-name="search-entity-result-universal-template"], ' +
                '.search-results-container ul > li, ' +
                '.entity-result'
              );
              if (results.length > 0 || checks >= 20) {
                clearInterval(interval);
                resolve(true);
              }
            }, 500);
          });
        },
      });

      pageNum++;
    } catch (e) {
      console.error('[Wassel] Navigation error:', e.message);
      break;
    }
  }

  // Trim to target count
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
    console.log(`[Wassel] 📥 Collection requested: ${targetCount} from tab ${tabId}`);
    collectMultiPageProspects(targetCount, tabId).then(async (prospects) => {
      // Send to the content script tab (sidebar is in the tab, not the popup)
      if (tabId) {
        await ensureContentScript(tabId);
        await safeSendMessage(tabId, { type: 'COLLECTION_COMPLETE', prospects });
      }
      // Also broadcast to popup if open
      try {
        chrome.runtime.sendMessage({ type: 'COLLECTION_COMPLETE', prospects });
      } catch (e) { /* popup may be closed */ }
    });
    sendResponse({ started: true });
    return true;
  }

  if (message.type === 'STOP_COLLECTION') {
    stopCollection = true;
    console.log('[Wassel] ⏹ Collection stop requested');
    sendResponse({ stopped: true });
    return true;
  }

  if (message.type === 'IMPORT_PROSPECTS') {
    const { campaignId, sourceUrl, prospects } = message;
    console.log('[Wassel] Import request:', prospects?.length, 'prospects');
    fetch(`${API_BASE}/ext/import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${message.token || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ campaign_id: campaignId || null, source_url: sourceUrl, prospects }),
    })
      .then(r => r.json())
      .then(response => {
        if (response?.success) downloadProspectsCSV(prospects);
        sendResponse(response);
      })
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
    getDailyLimits().then(limits => {
      sendResponse({ isProcessing, limits });
    });
    return true;
  }
});

// ============================================================================
// ALARMS — reliable polling that survives service worker suspension
// ============================================================================
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'poll') {
    await processQueue();
  }
  if (alarm.name === 'tokenSync') {
    await syncTokenFromDashboard();
  }
});

// ============================================================================
// STARTUP — set up alarms and run immediately
// ============================================================================
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Wassel] Extension installed');
  chrome.storage.local.set({ apiUrl: API_BASE });

  // Set up alarms
  chrome.alarms.create('poll', { periodInMinutes: 1 });
  chrome.alarms.create('tokenSync', { periodInMinutes: 30 });

  await syncTokenFromDashboard();
  setTimeout(processQueue, 3000);
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('[Wassel] Chrome started');
  chrome.alarms.create('poll', { periodInMinutes: 1 });
  chrome.alarms.create('tokenSync', { periodInMinutes: 30 });

  await syncTokenFromDashboard();
  setTimeout(processQueue, 3000);
});

// Fallback: also start on service worker wake
(async () => {
  await sleep(2000);
  const token = await getToken();
  if (token) {
    console.log('[Wassel] Service worker wake — starting automation');
    chrome.alarms.create('poll', { periodInMinutes: 1 });
    setTimeout(processQueue, 3000);
  } else {
    console.log('[Wassel] No token on wake — sync first');
    await syncTokenFromDashboard();
    const t2 = await getToken();
    if (t2) {
      chrome.alarms.create('poll', { periodInMinutes: 1 });
      setTimeout(processQueue, 5000);
    }
  }
})();

// ─── PUBLISH_POST: Forward from web app to content.js on LinkedIn tab ───
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PUBLISH_POST' && message.content) {
    console.log('[Wassel] 📝 PUBLISH_POST received in background, forwarding to LinkedIn tab');

    (async () => {
      try {
        // Find an open LinkedIn feed tab
        const tabs = await chrome.tabs.query({ url: '*://*.linkedin.com/*' });
        let targetTab = tabs.find(t => t.url && t.url.includes('/feed'));
        if (!targetTab && tabs.length > 0) targetTab = tabs[0];

        if (targetTab && targetTab.id) {
          await ensureContentScript(targetTab.id);
          // Use DO_LINKEDIN_POST to avoid triggering this same handler on the content side
          const r = await safeSendMessage(targetTab.id, {
            type: 'DO_LINKEDIN_POST',
            content: message.content,
            postId: message.postId,
          });
          sendResponse({ ok: true, tabId: targetTab.id, result: r });
        } else {
          // No LinkedIn tab open — create one (safeSendMessage waits for load)
          const newTab = await chrome.tabs.create({ url: 'https://www.linkedin.com/feed/' });
          await ensureContentScript(newTab.id);
          const r = await safeSendMessage(newTab.id, {
            type: 'DO_LINKEDIN_POST',
            content: message.content,
            postId: message.postId,
          });
          sendResponse({ ok: true, tabId: newTab.id, result: r });
        }
      } catch (err) {
        console.error('[Wassel] PUBLISH_POST forward error:', err);
        sendResponse({ ok: false, error: err.message });
      }
    })();

    return true; // async
  }
});

// ─── SEND_MESSAGE_TO_PROSPECT: Open profile and send direct message ───
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SEND_MESSAGE_TO_PROSPECT' && message.profileUrl) {
    console.log('[Wassel] 📨 SEND_MESSAGE_TO_PROSPECT:', message.profileUrl);

    (async () => {
      try {
        const tab = await chrome.tabs.create({ url: message.profileUrl, active: true });
        // Wait for page load
        await new Promise(resolve => {
          const listener = (id, changeInfo) => {
            if (id === tab.id && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
          setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, 15000);
        });
        await ensureContentScript(tab.id);
        const r = await chrome.tabs.sendMessage(tab.id, {
          type: 'SEND_DIRECT_MESSAGE',
          profileUrl: message.profileUrl,
          message: message.message,
        });
        sendResponse({ ok: true, result: r });
      } catch (err) {
        console.error('[Wassel] SEND_MESSAGE_TO_PROSPECT error:', err);
        sendResponse({ ok: false, error: err.message });
      }
    })();

    return true;
  }
});
