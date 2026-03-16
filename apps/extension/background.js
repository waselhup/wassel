// Wassel Extension — Background Service Worker v3
// Handles: token sync, automation queue polling, action execution, rate limiting

const API_BASE = 'https://wassel-alpha.vercel.app/api';
const DASHBOARD_ORIGIN = 'https://wassel-alpha.vercel.app';

console.log('[Wassel] 🚀 Background loaded!', new Date().toLocaleTimeString());

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
    await sleep(5000);

    // Click Connect button
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const allBtns = Array.from(document.querySelectorAll('button'));
        const connectBtn = allBtns.find(b => {
          const text = (b.innerText || '').trim();
          const label = b.getAttribute('aria-label') || '';
          return text === 'Connect' || label.includes('Connect') || text.includes('Connect');
        });
        if (connectBtn) { connectBtn.click(); return { found: true }; }
        // Try "More" dropdown first
        const moreBtn = allBtns.find(b => (b.innerText || '').trim() === 'More');
        if (moreBtn) { moreBtn.click(); return { found: false, moreClicked: true }; }
        return { found: false, buttons: allBtns.slice(0, 10).map(b => (b.innerText || '').trim()).filter(Boolean) };
      },
    });

    let r = result?.[0]?.result;
    console.log('[Wassel] Connect click result:', JSON.stringify(r));

    // If "More" was clicked, wait and try Connect again from dropdown
    if (r?.moreClicked) {
      await sleep(1500);
      const retry = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const items = Array.from(document.querySelectorAll('[role="menuitem"], button, li'));
          const connectItem = items.find(el => (el.innerText || '').trim().includes('Connect'));
          if (connectItem) { connectItem.click(); return { found: true }; }
          return { found: false };
        },
      });
      r = retry?.[0]?.result;
      console.log('[Wassel] Retry Connect from More:', JSON.stringify(r));
    }

    if (!r?.found) {
      await updateStepStatus(stepId, 'failed', 'Connect button not found');
      return;
    }

    await sleep(2000);

    // Click Send (with or without note)
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const btns = Array.from(document.querySelectorAll('button'));
        const sendBtn = btns.find(b => {
          const text = (b.innerText || '').trim();
          return text.includes('Send') || text.includes('without');
        });
        if (sendBtn) sendBtn.click();
      },
    });

    await sleep(2000);
    await incrementLimit('invites');
    await updateStepStatus(stepId, 'completed');
    console.log(`[Wassel] ✅ Invite sent to: ${name}`);
  } catch (e) {
    console.error(`[Wassel] Invite error for ${name}:`, e.message);
    await updateStepStatus(stepId, 'failed', e.message);
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
    await sleep(5000);

    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: (msgText) => {
        const btns = Array.from(document.querySelectorAll('button'));
        const msgBtn = btns.find(b => {
          const text = (b.innerText || '').trim();
          return text === 'Message' || text.includes('Message');
        });
        if (!msgBtn) return { success: false, error: 'Message button not found' };
        msgBtn.click();
        return { success: true };
      },
      args: [message],
    });

    const r = result?.[0]?.result;
    if (!r?.success) {
      await updateStepStatus(stepId, 'failed', r?.error || 'Message button not found');
      return;
    }

    await sleep(2000);

    // Type message in the messaging box
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (msgText) => {
        const box = document.querySelector('[role="textbox"]') ||
                    document.querySelector('.msg-form__contenteditable') ||
                    document.querySelector('[contenteditable="true"]');
        if (box) {
          box.focus();
          box.innerHTML = `<p>${msgText}</p>`;
          box.dispatchEvent(new Event('input', { bubbles: true }));
        }
      },
      args: [message],
    });

    await sleep(1500);

    // Click Send
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const btns = Array.from(document.querySelectorAll('button'));
        const send = btns.find(b => (b.innerText || '').trim() === 'Send' || b.getAttribute('type') === 'submit');
        if (send) send.click();
      },
    });

    await sleep(2000);
    await incrementLimit('messages');
    await updateStepStatus(stepId, 'completed');
    console.log(`[Wassel] ✅ Message sent to: ${name}`);
  } catch (e) {
    console.error(`[Wassel] Message error for ${name}:`, e.message);
    await updateStepStatus(stepId, 'failed', e.message);
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
  const url = item.linkedin_url || item.linkedinUrl;
  const message = item.message || item.message_template || '';
  const name = item.name || 'Unknown';

  console.log(`[Wassel] 🎯 Executing: ${stepType} for ${name}`);
  await updateStepStatus(stepId, 'in_progress');

  try {
    if (stepType === 'visit') {
      await doVisit(url, stepId, name);
    } else if (stepType === 'invitation' || stepType === 'invite' || stepType === 'connection_request') {
      const limits = await getDailyLimits();
      if (limits.invites >= 20) {
        console.log('[Wassel] 🛑 Daily invite limit (20) reached');
        await updateStepStatus(stepId, 'pending');
        return;
      }
      await doInvite(url, message, stepId, name);
    } else if (stepType === 'message' || stepType === 'follow' || stepType === 'follow_up') {
      await doMessage(url, message, stepId, name);
    } else {
      console.log(`[Wassel] ⚠️ Unknown step type: ${stepType}`);
      await updateStepStatus(stepId, 'failed', `Unknown: ${stepType}`);
    }
  } catch (err) {
    console.error(`[Wassel] ❌ Execute failed:`, err.message);
    await updateStepStatus(stepId, 'failed', err.message);
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

  const token = await getToken();
  if (!token) {
    console.log('[Wassel] ❌ No token — open Wassel dashboard to sync');
    return;
  }

  isProcessing = true;

  try {
    const res = await fetch(`${API_BASE}/sequence/queue/active`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

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
