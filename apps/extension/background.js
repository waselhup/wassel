// ============================================================
// WASSEL EXTENSION v6.0.0 — Background Service Worker
// HYBRID: Extension executes LinkedIn Voyager API from browser
// (user's real IP, native cookies) — no LinkedIn tab needed.
// Server provides pending actions, extension reports results.
// ============================================================

const API_BASE = 'https://wassel-alpha.vercel.app/api';
const DASHBOARD_ORIGIN = 'https://wassel-alpha.vercel.app';
const POLL_INTERVAL_MINUTES = 1; // Poll every 1 minute
const MIN_DELAY_MS = 3000;  // Min delay between actions
const MAX_DELAY_MS = 8000;  // Max delay between actions

console.log('[Wassel] 🚀 Background v6.1.0 loaded (extension-execution)', new Date().toLocaleTimeString());

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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
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
    const wasselTab = tabs.find(t =>
      t.url && t.url.includes('wassel-alpha.vercel.app') && t.status === 'complete'
    );

    if (!wasselTab || !wasselTab.id) {
      console.log('[Wassel] No ready dashboard tab found');
      return { synced: false, reason: 'no_tab' };
    }

    // Method 1: Try sending message to content script (wassel_detect.js)
    try {
      const response = await chrome.tabs.sendMessage(wasselTab.id, { type: 'GET_SUPABASE_TOKEN' });
      if (response?.token) {
        await chrome.storage.local.set({ wasselToken: response.token });
        console.log(`[Wassel] ✅ Token synced via content script (${response.source})`);
        extractAndStoreCookies();
        return { synced: true, source: response.source };
      }
    } catch (msgErr) {
      console.log('[Wassel] Content script msg failed, trying executeScript:', msgErr.message);
    }

    // Method 2: Fallback to executeScript (requires host_permissions)
    try {
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
        console.log(`[Wassel] ✅ Token synced via executeScript (${source})`);
        extractAndStoreCookies();
        return { synced: true, source };
      }
    } catch (scriptErr) {
      console.warn('[Wassel] executeScript failed:', scriptErr.message);
    }

    return { synced: false, reason: 'no_token' };
  } catch (e) {
    console.error('[Wassel] Token sync error:', e.message);
    return { synced: false, reason: e.message };
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
// LINKEDIN VOYAGER API — executed FROM the extension service worker
// Uses chrome.cookies API to manually build Cookie header (service workers
// can't use credentials:'include'). Requests come from user's real IP.
// No LinkedIn tab needed.
// ============================================================================

async function getLinkedInCookies() {
  const cookies = await chrome.cookies.getAll({ domain: '.linkedin.com' });
  const liAt = cookies.find(c => c.name === 'li_at')?.value || '';
  const jsessionId = cookies.find(c => c.name === 'JSESSIONID')?.value?.replace(/"/g, '') || '';
  return { liAt, jsessionId };
}

function getVoyagerHeaders(liAt, jsessionId) {
  return {
    'cookie': `li_at=${liAt}; JSESSIONID="${jsessionId}"`,
    'csrf-token': jsessionId,
    'accept': 'application/vnd.linkedin.normalized+json+2.1',
    'x-restli-protocol-version': '2.0.0',
    'x-li-lang': 'en_US',
    'x-li-track': JSON.stringify({
      clientVersion: '1.13.8806',
      mpVersion: '1.13.8806',
      osName: 'web',
      timezoneOffset: 3,
      timezone: 'Asia/Riyadh',
      deviceFormFactor: 'DESKTOP',
      mpName: 'voyager-web',
    }),
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  };
}

function isSessionExpired(status, locationHeader, setCookieHeader, res) {
  if (setCookieHeader && setCookieHeader.includes('li_at=delete me')) return true;
  if (status === 401 || status === 403) return true;
  // With redirect:'follow' (default), check if we were redirected to a login page
  if (res && res.redirected && res.url) {
    const url = res.url.toLowerCase();
    if (url.includes('login') || url.includes('authwall') || url.includes('checkpoint') || url.includes('uas/login')) return true;
  }
  if (status >= 300 && status < 400 && locationHeader) {
    const loc = locationHeader.toLowerCase();
    if (loc.includes('login') || loc.includes('authwall') || loc.includes('checkpoint') || loc.includes('uas/login')) return true;
  }
  return false;
}

/**
 * Visit a LinkedIn profile to get profileId (entity URN).
 * Uses BOTH endpoints — dash first (modern), fallback to legacy.
 */
async function linkedinVisitProfile(slug) {
  const { liAt, jsessionId } = await getLinkedInCookies();
  if (!liAt) return { success: false, error: 'no_li_at_cookie' };

  let tabId;
  try { tabId = await getLinkedInTab(); } catch (e) {
    return { success: false, error: 'no_linkedin_tab' };
  }

  const fetchHeaders = {
    'csrf-token': jsessionId,
    'accept': 'application/vnd.linkedin.normalized+json+2.1',
    'x-restli-protocol-version': '2.0.0',
  };

  // Method 1: Modern dash endpoint (from LinkedIn tab context)
  try {
    const dashUrl = `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(slug)}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.WebTopCardCore-16`;
    const res = await executeInLinkedInContext(tabId, dashUrl, {
      method: 'GET', headers: fetchHeaders, credentials: 'include',
    });

    if (res.error) {
      console.warn('[Wassel] Dash visit error:', res.error);
    } else if (res.status === 401 || res.status === 403) {
      return { success: false, error: `session_expired: ${res.status}` };
    } else if (res.ok && res.body) {
      const data = res.body;
      const profile = data?.elements?.[0] || data?.included?.find(i => i.$type?.includes('Profile')) || data;
      const entityUrn = profile?.entityUrn || profile?.objectUrn || '';
      const profileId = entityUrn.replace('urn:li:fsd_profile:', '').replace('urn:li:fs_profile:', '');
      const firstName = profile?.firstName || '';
      const lastName = profile?.lastName || '';
      const name = `${firstName} ${lastName}`.trim();

      if (profileId) {
        return { success: true, profileId, name, entityUrn };
      }

      if (data?.included?.length) {
        for (const item of data.included) {
          if (item.entityUrn && (item.entityUrn.includes('fsd_profile') || item.entityUrn.includes('fs_profile'))) {
            const pid = item.entityUrn.replace('urn:li:fsd_profile:', '').replace('urn:li:fs_profile:', '');
            const n = `${item.firstName || ''} ${item.lastName || ''}`.trim();
            return { success: true, profileId: pid, name: n, entityUrn: item.entityUrn };
          }
        }
      }
    }
  } catch (e) {
    console.warn('[Wassel] Dash profile endpoint error:', e.message);
  }

  // Method 2: Legacy endpoint
  try {
    const legacyUrl = `https://www.linkedin.com/voyager/api/identity/profiles/${encodeURIComponent(slug)}`;
    const res = await executeInLinkedInContext(tabId, legacyUrl, {
      method: 'GET', headers: fetchHeaders, credentials: 'include',
    });

    if (res.error) {
      return { success: false, error: `visit_error: ${res.error}` };
    }
    if (res.status === 401 || res.status === 403) {
      return { success: false, error: `session_expired: ${res.status}` };
    }
    if (res.ok && res.body) {
      const data = res.body;
      const entityUrn = data?.entityUrn || '';
      const profileId = entityUrn.split(':').pop() || slug;
      const name = `${data?.firstName || ''} ${data?.lastName || ''}`.trim();
      return { success: true, profileId, name, entityUrn };
    }

    return { success: false, error: `visit_failed_${res.status}` };
  } catch (e) {
    return { success: false, error: `visit_error: ${e.message}` };
  }
}

/**
 * Get or create a LinkedIn tab for executing actions.
 * Uses existing LinkedIn tab or creates a hidden one.
 */
async function getLinkedInTab() {
  const tabs = await chrome.tabs.query({});
  const liTab = tabs.find(t => t.url && t.url.includes('linkedin.com') && t.status === 'complete');
  if (liTab) return liTab.id;

  // Create a LinkedIn tab (will be used for API calls from page context)
  const newTab = await chrome.tabs.create({ url: 'https://www.linkedin.com/feed/', active: false });
  // Wait for it to load
  await new Promise(resolve => {
    const listener = (tabId, changeInfo) => {
      if (tabId === newTab.id && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, 15000);
  });
  return newTab.id;
}

/**
 * Execute a fetch call from within a LinkedIn tab's page context.
 * This ensures cookies are sent automatically and LinkedIn sees a real browser origin.
 */
async function executeInLinkedInContext(tabId, url, options) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (fetchUrl, fetchOptions) => {
        try {
          const res = await fetch(fetchUrl, fetchOptions);
          let body = null;
          try { body = await res.json(); } catch {}
          return { status: res.status, ok: res.ok, body, redirected: res.redirected, url: res.url };
        } catch (e) {
          return { error: e.message };
        }
      },
      args: [url, options],
    });
    return results?.[0]?.result || { error: 'no_result' };
  } catch (e) {
    return { error: `script_inject_failed: ${e.message}` };
  }
}

/**
 * Send a connection invite to a profile.
 * The ENTIRE fetch runs inside the LinkedIn tab in MAIN world —
 * the page reads its own CSRF token, sends its own cookies.
 * Zero chance of CSRF mismatch.
 */
async function linkedinSendInvite(profileId, message) {
  const { liAt } = await getLinkedInCookies();
  if (!liAt) return { success: false, error: 'no_li_at_cookie' };

  const cleanId = profileId.replace('urn:li:fsd_profile:', '').replace('urn:li:fs_profile:', '');

  let tabId;
  try { tabId = await getLinkedInTab(); } catch (e) {
    return { success: false, error: 'no_linkedin_tab' };
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',  // Run in page's JS context — full access to LinkedIn's cookies/CSRF
      func: async (pid, msg) => {
        // Read CSRF token directly from LinkedIn's cookie in the page
        function getCsrf() {
          const m = document.cookie.match(/JSESSIONID="?([^";]+)/);
          return m ? m[1] : '';
        }

        const csrf = getCsrf();
        if (!csrf) return { error: 'no_csrf_token' };

        const headers = {
          'csrf-token': csrf,
          'accept': 'application/vnd.linkedin.normalized+json+2.1',
          'x-restli-protocol-version': '2.0.0',
          'content-type': 'application/json; charset=UTF-8',
          'x-li-lang': 'en_US',
          'x-li-track': JSON.stringify({
            clientVersion: '1.13.8806', mpVersion: '1.13.8806',
            osName: 'web', timezoneOffset: 3, timezone: 'Asia/Riyadh',
            deviceFormFactor: 'DESKTOP', mpName: 'voyager-web',
          }),
        };

        const entityUrn = `urn:li:fsd_profile:${pid}`;
        let lastError = '';

        // Method 1: Modern dash verifyQuotaAndCreate
        try {
          const body = { invitee: { inviteeUnion: { memberProfile: entityUrn } } };
          if (msg && msg.trim()) body.customMessage = msg.trim().substring(0, 300);

          const res = await fetch(
            'https://www.linkedin.com/voyager/api/voyagerRelationshipsDashMemberRelationships?action=verifyQuotaAndCreate',
            { method: 'POST', headers, credentials: 'include', body: JSON.stringify(body) }
          );

          if (res.status === 429) return { error: 'rate_limited', status: 429 };
          if (res.status === 401 || res.status === 403) return { error: 'session_expired', status: res.status };
          if (res.ok) return { success: true, method: 'dash', status: res.status };
          // 422 = already invited or already connected — treat as success
          if (res.status === 422) return { success: true, method: 'dash_already_invited', status: 422 };

          let detail = '';
          try { detail = JSON.stringify(await res.json()).substring(0, 300); } catch {}
          lastError = `dash_${res.status}: ${detail}`;
        } catch (e) {
          lastError = `dash_err: ${e.message}`;
        }

        // Method 2: Legacy normInvitations
        try {
          const body = {
            invitee: {
              'com.linkedin.voyager.growth.invitation.InviteeProfile': { profileId: pid },
            },
          };
          if (msg && msg.trim()) body.message = msg.trim().substring(0, 280);

          const res = await fetch(
            'https://www.linkedin.com/voyager/api/growth/normInvitations',
            { method: 'POST', headers, credentials: 'include', body: JSON.stringify(body) }
          );

          if (res.status === 429) return { error: 'rate_limited', status: 429 };
          if (res.status === 401 || res.status === 403) return { error: 'session_expired', status: res.status };
          if (res.ok || res.status === 201) return { success: true, method: 'growth', status: res.status };
          // 422 = already invited — treat as success
          if (res.status === 422) return { success: true, method: 'growth_already_invited', status: 422 };

          let detail = '';
          try { detail = JSON.stringify(await res.json()).substring(0, 300); } catch {}
          lastError = `growth_${res.status}: ${detail}`;
        } catch (e) {
          lastError = `growth_err: ${e.message}`;
        }

        // Method 3: Direct relationships invitation
        try {
          const body = {
            invitee: { inviteeUnion: { memberProfile: entityUrn } },
          };
          if (msg && msg.trim()) body.customMessage = msg.trim().substring(0, 300);

          const res = await fetch(
            'https://www.linkedin.com/voyager/api/voyagerRelationshipsDashMemberRelationships',
            { method: 'POST', headers, credentials: 'include', body: JSON.stringify(body) }
          );

          if (res.ok || res.status === 201) return { success: true, method: 'rel', status: res.status };

          let detail = '';
          try { detail = JSON.stringify(await res.json()).substring(0, 300); } catch {}
          lastError = `rel_${res.status}: ${detail}`;
        } catch (e) {
          lastError = `rel_err: ${e.message}`;
        }

        return { error: lastError || 'all_methods_failed' };
      },
      args: [cleanId, message || ''],
    });

    const res = results?.[0]?.result;
    if (!res) return { success: false, error: 'script_no_result' };

    console.log(`[Wassel] Invite result:`, JSON.stringify(res).substring(0, 200));

    if (res.success) {
      console.log(`[Wassel] ✅ Invite sent via ${res.method} (status ${res.status})`);
      return { success: true };
    }

    if (res.error?.includes('rate_limited')) return { success: false, error: 'rate_limited' };
    if (res.error?.includes('session_expired')) return { success: false, error: `session_expired_${res.status}` };
    return { success: false, error: res.error || 'unknown' };
  } catch (e) {
    console.error('[Wassel] Invite script error:', e.message);
    return { success: false, error: `inject_error: ${e.message}` };
  }
}

/**
 * Send a message to a connected profile.
 * Executes from LinkedIn tab context for proper cookie handling.
 */
async function linkedinSendMessage(profileUrn, message) {
  const { jsessionId } = await getLinkedInCookies();
  if (!profileUrn.startsWith('urn:')) profileUrn = `urn:li:fsd_profile:${profileUrn}`;

  let tabId;
  try { tabId = await getLinkedInTab(); } catch (e) {
    return { success: false, error: 'no_linkedin_tab' };
  }

  const fetchHeaders = {
    'csrf-token': jsessionId,
    'accept': 'application/vnd.linkedin.normalized+json+2.1',
    'x-restli-protocol-version': '2.0.0',
    'content-type': 'application/json; charset=UTF-8',
  };

  // Method 1: Modern messaging
  try {
    const body = {
      message: { body: { text: message } },
      mailboxUrn: 'urn:li:fsd_profile:me',
      trackingId: crypto.randomUUID().replace(/-/g, '').substring(0, 16),
      dedupeByClientGeneratedToken: false,
      hostRecipientUrns: [profileUrn],
    };
    const res = await executeInLinkedInContext(tabId,
      'https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerMessages?action=createMessage',
      { method: 'POST', headers: fetchHeaders, credentials: 'include', body: JSON.stringify(body) }
    );
    if (res.status === 401 || res.status === 403) return { success: false, error: 'session_expired' };
    if (res.status === 429) return { success: false, error: 'rate_limited' };
    if (res.ok || res.status === 201) return { success: true };
  } catch (e) {
    console.warn('[Wassel] Modern messaging failed:', e.message);
  }

  // Method 2: Legacy conversations
  try {
    const body = {
      keyVersion: 'LEGACY_INBOX',
      conversationCreate: {
        eventCreate: { value: { 'com.linkedin.voyager.messaging.create.MessageCreate': { attributedBody: { text: message, attributes: [] }, attachments: [] } } },
        recipients: [profileUrn], subtype: 'MEMBER_TO_MEMBER',
      },
    };
    const res = await executeInLinkedInContext(tabId,
      'https://www.linkedin.com/voyager/api/messaging/conversations',
      { method: 'POST', headers: fetchHeaders, credentials: 'include', body: JSON.stringify(body) }
    );
    if (res.status === 401 || res.status === 403) return { success: false, error: 'session_expired' };
    if (res.ok || res.status === 201) return { success: true };
    return { success: false, error: `message_failed_${res.status}` };
  } catch (e) {
    return { success: false, error: `message_error: ${e.message}` };
  }
}

/**
 * Follow a LinkedIn profile.
 */
async function linkedinFollowProfile(slug) {
  const profile = await linkedinVisitProfile(slug);
  if (!profile.success || !profile.profileId) {
    return { success: false, error: profile.error || 'profile_not_found' };
  }

  const { jsessionId } = await getLinkedInCookies();
  const entityUrn = profile.entityUrn || `urn:li:fsd_profile:${profile.profileId}`;

  let tabId;
  try { tabId = await getLinkedInTab(); } catch (e) {
    return { success: false, error: 'no_linkedin_tab' };
  }

  const fetchHeaders = {
    'csrf-token': jsessionId,
    'accept': 'application/vnd.linkedin.normalized+json+2.1',
    'x-restli-protocol-version': '2.0.0',
    'content-type': 'application/json; charset=UTF-8',
  };

  try {
    const res = await executeInLinkedInContext(tabId,
      'https://www.linkedin.com/voyager/api/voyagerRelationshipsDashFollows?action=followByEntityUrn',
      { method: 'POST', headers: fetchHeaders, credentials: 'include', body: JSON.stringify({ entityUrn }) }
    );
    if (res.status === 401 || res.status === 403) return { success: false, error: 'session_expired' };
    if (res.ok || res.status === 200 || res.status === 201) return { success: true };
  } catch (e) {
    console.warn('[Wassel] Follow failed:', e.message);
  }

  try {
    const res = await executeInLinkedInContext(tabId,
      'https://www.linkedin.com/voyager/api/feed/follows',
      { method: 'POST', headers: fetchHeaders, credentials: 'include', body: JSON.stringify({ urn: entityUrn }) }
    );
    if (res.ok || res.status === 201) return { success: true };
    return { success: false, error: `follow_failed_${res.status}` };
  } catch (e) {
    return { success: false, error: `follow_error: ${e.message}` };
  }
}

// ============================================================================
// CAMPAIGN EXECUTION ENGINE — polls server, executes actions, reports back
// ============================================================================

let isExecuting = false;
let executionStats = {
  lastPoll: null,
  lastAction: null,
  actionsToday: 0,
  errors: 0,
  consecutiveErrors: 0,
};

async function pollAndExecute() {
  if (isExecuting) {
    console.log('[Wassel] ⏳ Already executing, skipping poll');
    return;
  }

  const token = await getToken();
  if (!token) {
    console.log('[Wassel] No token — skipping execution poll');
    return;
  }

  // Check LinkedIn cookies exist
  const { liAt } = await getLinkedInCookies();
  if (!liAt) {
    console.log('[Wassel] No li_at cookie — user not logged into LinkedIn');
    return;
  }

  isExecuting = true;
  executionStats.lastPoll = new Date().toISOString();

  try {
    // 1. Poll server for pending action
    // Send both JWT token AND li_at prefix for fallback auth
    const { liAt: pollLiAt } = await getLinkedInCookies();
    const pollHeaders = { 'Authorization': `Bearer ${token}` };
    if (pollLiAt) {
      pollHeaders['X-LI-AT'] = pollLiAt.substring(0, 16);
    }
    const res = await fetch(`${API_BASE}/ext/pending-actions`, {
      headers: pollHeaders,
    });

    if (!res.ok) {
      console.warn('[Wassel] Poll failed:', res.status);
      executionStats.errors++;
      executionStats.consecutiveErrors++;
      return;
    }

    const data = await res.json();

    if (!data.action) {
      // No pending actions — that's fine
      if (data.reason && data.reason !== 'no_pending_actions') {
        console.log('[Wassel] No action:', data.reason);
      }
      executionStats.consecutiveErrors = 0;
      return;
    }

    const action = data.action;
    console.log(`[Wassel] 🎯 Got action: ${action.actionType} for ${action.prospectName} (${action.slug})`);

    // 2. Human-like random delay before executing
    const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
    await sleep(delay);

    // 3. Execute the LinkedIn action
    let result = { success: false, error: 'unknown_action' };

    switch (action.actionType) {
      case 'visit': {
        result = await linkedinVisitProfile(action.slug);
        break;
      }

      case 'connect': {
        // Visit first to get profileId
        const profile = await linkedinVisitProfile(action.slug);
        if (!profile.success || !profile.profileId) {
          result = { success: false, error: profile.error || 'profile_not_found' };
          break;
        }

        // Human delay between visit and invite
        await sleep(1500 + Math.random() * 2500);

        result = await linkedinSendInvite(profile.profileId, action.message || '');
        break;
      }

      case 'message': {
        // Visit first to get profileId
        const profile = await linkedinVisitProfile(action.slug);
        if (!profile.success || !profile.profileId) {
          result = { success: false, error: profile.error || 'profile_not_found' };
          break;
        }

        // Human delay
        await sleep(1500 + Math.random() * 2500);

        const profileUrn = `urn:li:fsd_profile:${profile.profileId}`;
        result = await linkedinSendMessage(profileUrn, action.message || '');
        break;
      }

      case 'follow': {
        result = await linkedinFollowProfile(action.slug);
        break;
      }

      default:
        result = { success: false, error: `unknown_action_type: ${action.actionType}` };
    }

    console.log(`[Wassel] ${result.success ? '✅' : '❌'} ${action.actionType} ${action.prospectName}: ${result.success ? 'OK' : result.error}`);

    // 4. Report result back to server
    const reportHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    const { liAt: reportLiAt } = await getLinkedInCookies();
    if (reportLiAt) {
      reportHeaders['X-LI-AT'] = reportLiAt.substring(0, 16);
    }
    await fetch(`${API_BASE}/ext/report-action`, {
      method: 'POST',
      headers: reportHeaders,
      body: JSON.stringify({
        pssId: action.pssId,
        campaignId: action.campaignId,
        prospectId: action.prospectId,
        actionType: action.actionType,
        success: result.success,
        error: result.error || null,
        prospectName: action.prospectName,
        linkedinUrl: action.linkedinUrl,
      }),
    });

    executionStats.lastAction = {
      time: new Date().toISOString(),
      type: action.actionType,
      prospect: action.prospectName,
      success: result.success,
    };

    if (result.success) {
      executionStats.actionsToday++;
      executionStats.consecutiveErrors = 0;
    } else {
      executionStats.errors++;
      executionStats.consecutiveErrors++;

      // If session expired, stop polling until cookies refresh
      if (result.error?.includes('session_expired') || result.error?.includes('401')) {
        console.log('[Wassel] 🛑 Session expired — stopping execution until re-login');
        // Try to refresh cookies from browser
        await extractAndStoreCookies();
      }
    }

    // If too many consecutive errors, back off
    if (executionStats.consecutiveErrors >= 5) {
      console.log('[Wassel] ⚠️ Too many errors — backing off for 10 minutes');
      // The alarm will still fire, but isExecuting guard prevents overlap
    }

  } catch (e) {
    console.error('[Wassel] Execution error:', e.message);
    executionStats.errors++;
    executionStats.consecutiveErrors++;
  } finally {
    isExecuting = false;
  }
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
    sendResponse({
      isProcessing: isExecuting,
      mode: 'extension',
      stats: executionStats,
    });
    return true;
  }

  if (message.type === 'EXTRACT_COOKIES') {
    extractAndStoreCookies().then(result => sendResponse(result));
    return true;
  }

  // Manual trigger for execution (from popup)
  if (message.type === 'FORCE_POLL') {
    pollAndExecute().then(() => sendResponse({ ok: true, stats: executionStats }));
    return true;
  }
});

// ============================================================================
// ALARMS — campaign execution, cookie refresh, token sync
// ============================================================================
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'campaignExecutor') {
    // Skip if too many consecutive errors (back off)
    if (executionStats.consecutiveErrors >= 5) {
      // Reset after 10 minutes of backing off
      const lastErr = executionStats.lastAction?.time;
      if (lastErr && (Date.now() - new Date(lastErr).getTime()) > 600000) {
        executionStats.consecutiveErrors = 0;
      } else {
        return;
      }
    }
    await pollAndExecute();
  }
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
  console.log('[Wassel] Extension installed (v6.1.0 extension-execution)');
  chrome.storage.local.set({ apiUrl: API_BASE });

  // Campaign executor: every 1 minute
  chrome.alarms.create('campaignExecutor', { periodInMinutes: POLL_INTERVAL_MINUTES });
  // Token sync every 30 minutes
  chrome.alarms.create('tokenSync', { periodInMinutes: 30 });
  // Cookie refresh every 4 hours (also syncs to server)
  chrome.alarms.create('cookieRefresh', { periodInMinutes: 240 });

  await syncTokenFromDashboard();
  setTimeout(extractAndStoreCookies, 5000);
  // First execution poll after 15s
  setTimeout(pollAndExecute, 15000);
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('[Wassel] Chrome started (v6.1.0 extension-execution)');

  chrome.alarms.create('campaignExecutor', { periodInMinutes: POLL_INTERVAL_MINUTES });
  chrome.alarms.create('tokenSync', { periodInMinutes: 30 });
  chrome.alarms.create('cookieRefresh', { periodInMinutes: 240 });

  await syncTokenFromDashboard();
  setTimeout(extractAndStoreCookies, 3000);
  setTimeout(pollAndExecute, 10000);
});

// Service worker wake fallback — ALWAYS ensure alarms exist
(async () => {
  await sleep(2000);

  // Ensure alarms exist on every wake (they may be lost after SW restarts)
  const existing = await chrome.alarms.getAll();
  const alarmNames = existing.map(a => a.name);
  if (!alarmNames.includes('campaignExecutor')) {
    chrome.alarms.create('campaignExecutor', { periodInMinutes: POLL_INTERVAL_MINUTES });
    console.log('[Wassel] Re-created campaignExecutor alarm');
  }
  if (!alarmNames.includes('tokenSync')) {
    chrome.alarms.create('tokenSync', { periodInMinutes: 30 });
  }
  if (!alarmNames.includes('cookieRefresh')) {
    chrome.alarms.create('cookieRefresh', { periodInMinutes: 240 });
  }

  const token = await getToken();
  if (!token) {
    await syncTokenFromDashboard();
  }
  setTimeout(extractAndStoreCookies, 5000);
  // Auto-poll on wake
  setTimeout(pollAndExecute, 8000);
})();
