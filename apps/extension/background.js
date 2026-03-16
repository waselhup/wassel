// Wassel Extension — Background Service Worker
// Handles auto-auth, communication, automation polling, and rate limiting

const API_BASE = 'https://wassel-alpha.vercel.app/api';
const DASHBOARD_ORIGIN = 'https://wassel-alpha.vercel.app';

// ============================================================================
// Storage helpers
// ============================================================================
async function getConfig() {
    const result = await chrome.storage.local.get(['wasselToken', 'clientId', 'apiUrl', 'activeCampaignId']);
    return {
        apiToken: result.wasselToken || '',
        clientId: result.clientId || '',
        apiUrl: result.apiUrl || API_BASE,
        activeCampaignId: result.activeCampaignId || '',
    };
}

async function setConfig(config) {
    await chrome.storage.local.set(config);
}

// ============================================================================
// AUTO-SYNC TOKEN — reads Supabase session from dashboard tab
// ============================================================================
async function syncTokenFromDashboard() {
    try {
        const tabs = await chrome.tabs.query({});
        const wasselTab = tabs.find(t =>
            t.url && t.url.includes('wassel-alpha.vercel.app')
        );

        if (!wasselTab || !wasselTab.id) {
            console.log('[Wassel] No dashboard tab found for token sync.');
            return { synced: false, reason: 'no_tab' };
        }

        const results = await chrome.scripting.executeScript({
            target: { tabId: wasselTab.id },
            func: () => {
                // Find Supabase auth token in localStorage
                const keys = Object.keys(localStorage);

                // Strategy 1: Look for supabase_token (set by AuthContext)
                const directToken = localStorage.getItem('supabase_token');
                if (directToken) return { token: directToken, source: 'supabase_token' };

                // Strategy 2: Look for sb-*-auth-token key (Supabase SDK format)
                const sbKey = keys.find(k =>
                    k.startsWith('sb-') && k.endsWith('-auth-token')
                );
                if (sbKey) {
                    try {
                        const raw = localStorage.getItem(sbKey);
                        const parsed = JSON.parse(raw);
                        const accessToken = parsed?.access_token || parsed?.currentSession?.access_token;
                        if (accessToken) return { token: accessToken, source: sbKey };
                    } catch {}
                }

                // Strategy 3: Find any key with supabase + auth
                const fallbackKey = keys.find(k =>
                    k.toLowerCase().includes('supabase') &&
                    k.toLowerCase().includes('auth')
                );
                if (fallbackKey) {
                    try {
                        const raw = localStorage.getItem(fallbackKey);
                        const parsed = JSON.parse(raw);
                        const accessToken = parsed?.access_token || parsed?.currentSession?.access_token;
                        if (accessToken) return { token: accessToken, source: fallbackKey };
                    } catch {}
                }

                return null;
            },
        });

        if (results && results[0] && results[0].result) {
            const { token, source } = results[0].result;
            await chrome.storage.local.set({ wasselToken: token });
            console.log(`[Wassel] ✅ Token synced from dashboard (source: ${source})`);
            return { synced: true, source };
        }

        console.log('[Wassel] Dashboard tab found but no token in localStorage.');
        return { synced: false, reason: 'no_token' };
    } catch (e) {
        console.error('[Wassel] Token sync error:', e);
        return { synced: false, reason: e.message };
    }
}

// Auto-sync on startup and periodically
chrome.runtime.onStartup.addListener(() => {
    syncTokenFromDashboard();
});

// Sync every 30 minutes to refresh token
setInterval(syncTokenFromDashboard, 30 * 60 * 1000);

// ============================================================================
// CSV Auto-Download — saves prospects to user's PC after import
// ============================================================================
function downloadProspectsCSV(prospects) {
    try {
        const headers = ['Name', 'Title', 'Company', 'LinkedIn URL', 'Imported At'];
        const today = new Date().toLocaleDateString();

        const rows = prospects.map(p => [
            p.name || '',
            p.title || p.job_title || p.jobTitle || '',
            p.company || '',
            p.linkedin_url || p.linkedinUrl || '',
            today,
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row =>
                row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
            ),
        ].join('\n');

        // UTF-8 BOM for Arabic name support
        const bom = '\uFEFF';
        const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
        const reader = new FileReader();

        reader.onload = () => {
            const timestamp = new Date().toISOString().slice(0, 10);
            chrome.downloads.download({
                url: reader.result,
                filename: `wassel-prospects-${timestamp}.csv`,
                saveAs: false,
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    console.error('[Wassel] CSV download error:', chrome.runtime.lastError.message);
                } else {
                    console.log(`[Wassel] ✅ CSV downloaded (${prospects.length} prospects), downloadId=${downloadId}`);
                }
            });
        };

        reader.readAsDataURL(blob);
    } catch (e) {
        console.error('[Wassel] CSV download error:', e);
    }
}

// ============================================================================
// Rate limiting — stored daily in chrome.storage.local
// Conservative limits to protect LinkedIn account
// ============================================================================
const DAILY_LIMITS = {
    visit: 80,
    invitation: 20,   // 20/day × 30 = 600/month — under LinkedIn's 800/month
    message: 40,
    follow: 20,
};

async function getDailyCounts() {
    const today = new Date().toISOString().split('T')[0];
    const result = await chrome.storage.local.get(['rateLimitDate', 'visitCount', 'inviteCount', 'messageCount', 'followCount']);

    if (result.rateLimitDate !== today) {
        await chrome.storage.local.set({
            rateLimitDate: today,
            visitCount: 0,
            inviteCount: 0,
            messageCount: 0,
            followCount: 0,
        });
        return { visitCount: 0, inviteCount: 0, messageCount: 0, followCount: 0 };
    }

    return {
        visitCount: result.visitCount || 0,
        inviteCount: result.inviteCount || 0,
        messageCount: result.messageCount || 0,
        followCount: result.followCount || 0,
    };
}

async function incrementCount(type) {
    const counts = await getDailyCounts();
    if (type === 'visit') {
        await chrome.storage.local.set({ visitCount: counts.visitCount + 1 });
    } else if (type === 'invite' || type === 'invitation') {
        await chrome.storage.local.set({ inviteCount: counts.inviteCount + 1 });
    } else if (type === 'message') {
        await chrome.storage.local.set({ messageCount: counts.messageCount + 1 });
    } else if (type === 'follow') {
        await chrome.storage.local.set({ followCount: counts.followCount + 1 });
    }
}

async function canPerformAction(type) {
    const counts = await getDailyCounts();
    if (type === 'visit' && counts.visitCount >= DAILY_LIMITS.visit) return false;
    if ((type === 'invite' || type === 'invitation') && counts.inviteCount >= DAILY_LIMITS.invitation) return false;
    if (type === 'message' && counts.messageCount >= DAILY_LIMITS.message) return false;
    if (type === 'follow' && counts.followCount >= DAILY_LIMITS.follow) return false;
    return true;
}

// Time-aware automation: only run 8am - 8pm local time
function isGoodTime() {
    const h = new Date().getHours();
    return h >= 8 && h < 20;
}

// Human-like delays per step type
const STEP_DELAYS = {
    visit:      { min: 30000,  max: 60000  },
    invitation: { min: 60000,  max: 120000 },
    message:    { min: 45000,  max: 90000  },
    follow:     { min: 45000,  max: 90000  },
};

function getStepDelay(type) {
    const d = STEP_DELAYS[type] || STEP_DELAYS.message;
    return d.min + Math.random() * (d.max - d.min);
}

// ============================================================================
// API helpers
// ============================================================================
async function apiCall(endpoint, options = {}) {
    const config = await getConfig();
    if (!config.apiToken) {
        return { error: 'Not authenticated. Open Wassel dashboard and sign in.' };
    }

    const url = `${config.apiUrl}${endpoint}`;
    try {
        const res = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiToken}`,
                ...(options.headers || {}),
            },
        });
        return res.json();
    } catch (e) {
        return { error: e.message };
    }
}

// ============================================================================
// Random delay utilities
// ============================================================================
function randomDelay(minMs, maxMs) {
    return new Promise(resolve => {
        const delay = Math.floor(Math.random() * (maxMs - minMs)) + minMs;
        setTimeout(resolve, delay);
    });
}

function delayBetweenActions() {
    return randomDelay(30000, 90000);
}

function delayWithinAction() {
    return randomDelay(2000, 8000);
}

// ============================================================================
// Automation state
// ============================================================================
let isProcessing = false;
let isPaused = false;
let isPollingActive = false;

// ============================================================================
// Automation polling — uses chrome.alarms (survives service worker suspension)
// ============================================================================
async function startPolling() {
    if (isPollingActive) return;
    isPollingActive = true;
    console.log('[Wassel] Starting automation polling via chrome.alarms...');
    
    // Keep service worker alive every 25 seconds
    chrome.alarms.create('keepAlive', { periodInMinutes: 0.4 });
    // Main automation loop every 1 minute
    chrome.alarms.create('automationLoop', { periodInMinutes: 1 });
    // Connection checker every 10 minutes
    chrome.alarms.create('connectionCheck', { periodInMinutes: 10 });
    // Token sync every 30 minutes
    chrome.alarms.create('tokenSync', { periodInMinutes: 30 });
    
    // Run immediately
    processQueue();
    connectionCheckLoop();
}

function stopPolling() {
    isPollingActive = false;
    isProcessing = false;
    isPaused = false;
    chrome.alarms.clear('automationLoop');
    chrome.alarms.clear('connectionCheck');
    console.log('[Wassel] Stopped automation polling.');
}

// Chrome alarms handler — runs even after service worker suspension
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'keepAlive') {
        // Just keeping the service worker alive, no action needed
        return;
    }
    if (alarm.name === 'automationLoop') {
        await processQueue();
    }
    if (alarm.name === 'connectionCheck') {
        await connectionCheckLoop();
    }
    if (alarm.name === 'tokenSync') {
        console.log('[Wassel] Auto-refreshing token...');
        await syncTokenFromDashboard();
    }
});

async function processQueue() {
    if (isProcessing || isPaused) return;

    // Time-aware: only run 8am-8pm
    if (!isGoodTime()) {
        console.log('[Wassel] Outside working hours (8am-8pm), skipping');
        return;
    }

    const config = await getConfig();
    if (!config.apiToken) return;

    isProcessing = true;

    try {
        // Use global queue endpoint — fetches pending actions across ALL active campaigns
        const result = await apiCall('/sequence/queue/active');

        if (!result.success || !result.queue || result.queue.length === 0) {
            console.log('[Wassel] No pending queue items');
            isProcessing = false;
            return;
        }

        const item = result.queue[0];

        if (!(await canPerformAction(item.step_type))) {
            const counts = await getDailyCounts();
            console.log(`[Wassel] ⚠️ Daily limit reached for ${item.step_type}. Counts:`, counts);
            isProcessing = false;
            return;
        }

        console.log(`[Wassel] Processing: ${item.step_type} for ${item.name} (${item.linkedin_url})`);

        // Execute actions directly from background script
        try {
            if (item.step_type === 'visit') {
                await executeVisitAction(item);
            } else if (item.step_type === 'invitation') {
                await executeViaContentScript(item);
            } else if (item.step_type === 'message' || item.step_type === 'follow') {
                await executeViaContentScript(item);
            } else {
                console.log(`[Wassel] Unknown step_type: ${item.step_type}, marking complete`);
                await markStepComplete(item.prospectStepId, 'completed');
            }

            await incrementCount(item.step_type);
            const counts = await getDailyCounts();
            console.log(`[Wassel] ✓ Completed: ${item.step_type} for ${item.name} | Today: ${counts.inviteCount}/${DAILY_LIMITS.invitation} invites, ${counts.visitCount}/${DAILY_LIMITS.visit} visits`);
            chrome.action.setBadgeText({ text: '✓' });
            chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
            setTimeout(() => chrome.action.setBadgeText({ text: '' }), 5000);
        } catch (actionError) {
            console.error(`[Wassel] ✗ Failed: ${item.step_type} for ${item.name}:`, actionError.message);
            await markStepComplete(item.prospectStepId, 'failed', actionError.message);
        }

        // Human-like delay based on step type
        const delay = getStepDelay(item.step_type);
        console.log(`[Wassel] Next action in ${Math.round(delay / 1000)}s`);
        await new Promise(r => setTimeout(r, delay));

    } catch (e) {
        console.error('[Wassel] Queue processing error:', e);
    } finally {
        isProcessing = false;
    }
}

// Helper to mark step complete/failed via API
async function markStepComplete(prospectStepId, status, errorMessage) {
    await apiCall('/sequence/step/complete', {
        method: 'POST',
        body: JSON.stringify({ prospectStepId, status, errorMessage: errorMessage || null }),
    });
}

// Execute Visit — open profile tab, wait, close
async function executeVisitAction(item) {
    console.log(`[Wassel] 👁 Visiting ${item.linkedin_url}`);
    const tab = await chrome.tabs.create({ url: item.linkedin_url, active: false });
    const waitTime = 4000 + Math.random() * 3000; // 4-7 seconds
    await new Promise(r => setTimeout(r, waitTime));
    try { await chrome.tabs.remove(tab.id); } catch (e) { /* tab may already be closed */ }
    await markStepComplete(item.prospectStepId, 'completed');
}

// Execute Invite/Message via content script on the profile page
async function executeViaContentScript(item) {
    console.log(`[Wassel] 🔗 Opening ${item.linkedin_url} for ${item.step_type}`);
    
    // Open profile tab
    const tab = await chrome.tabs.create({ url: item.linkedin_url, active: true });
    
    // Wait for page to load
    await new Promise(r => setTimeout(r, 4000 + Math.random() * 2000));
    
    // Send action to content script
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, {
            type: 'EXECUTE_STEP',
            data: item,
        }, async (response) => {
            try {
                if (chrome.runtime.lastError) {
                    // Content script not ready — retry once
                    console.log('[Wassel] Content script not ready, retrying...');
                    await new Promise(r => setTimeout(r, 3000));
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'EXECUTE_STEP',
                        data: item,
                    }, async (retryResponse) => {
                        await new Promise(r => setTimeout(r, 2000));
                        try { await chrome.tabs.remove(tab.id); } catch (e) {}
                        if (retryResponse?.success) {
                            await markStepComplete(item.prospectStepId, 'completed');
                            resolve();
                        } else {
                            await markStepComplete(item.prospectStepId, 'failed', retryResponse?.error || 'Content script failed');
                            reject(new Error(retryResponse?.error || 'Content script failed'));
                        }
                    });
                    return;
                }
                
                await new Promise(r => setTimeout(r, 2000));
                try { await chrome.tabs.remove(tab.id); } catch (e) {}
                
                if (response?.linkedinRestriction) {
                    isPaused = true;
                    chrome.action.setBadgeText({ text: '!' });
                    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
                    await markStepComplete(item.prospectStepId, 'failed', 'LinkedIn restriction');
                    reject(new Error('LinkedIn restriction'));
                } else if (response?.success) {
                    await markStepComplete(item.prospectStepId, 'completed');
                    resolve();
                } else {
                    await markStepComplete(item.prospectStepId, 'failed', response?.error || 'Unknown error');
                    reject(new Error(response?.error || 'Action failed'));
                }
            } catch (err) {
                try { await chrome.tabs.remove(tab.id); } catch (e) {}
                reject(err);
            }
        });
    });
}

// ============================================================================
// Connection Status Checker
// ============================================================================
let isCheckingConnections = false;

async function connectionCheckLoop() {
    if (isCheckingConnections || isPaused) return;

    const config = await getConfig();
    if (!config.apiToken) return;

    isCheckingConnections = true;

    try {
        const result = await apiCall('/sequence/pending-acceptance-checks');

        if (!result.success || !result.data || result.data.length === 0) {
            isCheckingConnections = false;
            return;
        }

        console.log(`[Wassel] Checking ${result.data.length} connection(s)...`);

        const tabs = await chrome.tabs.query({ url: '*://www.linkedin.com/*' });
        if (tabs.length === 0) {
            console.log('[Wassel] No LinkedIn tab found for connection checks.');
            isCheckingConnections = false;
            return;
        }

        const linkedInTab = tabs[0];

        for (const check of result.data) {
            if (!check.linkedinUrl) continue;

            try {
                const response = await chrome.tabs.sendMessage(linkedInTab.id, {
                    type: 'CHECK_CONNECTION_STATUS',
                    data: {
                        linkedinUrl: check.linkedinUrl,
                        prospectName: check.prospectName,
                    },
                });

                if (response && response.status) {
                    await apiCall('/sequence/update-connection-status', {
                        method: 'POST',
                        body: JSON.stringify({
                            prospectId: check.prospectId,
                            status: response.status,
                            jobId: check.jobId,
                        }),
                    });

                    const emoji = response.status === 'accepted' ? '✅' : response.status === 'withdrawn' ? '❌' : '⏳';
                    console.log(`[Wassel] ${emoji} ${check.prospectName}: ${response.status}`);

                    if (response.status === 'accepted') {
                        chrome.action.setBadgeText({ text: '✓' });
                        chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
                        setTimeout(() => chrome.action.setBadgeText({ text: '' }), 5000);
                    }
                }
            } catch (msgError) {
                console.error(`[Wassel] Error checking ${check.prospectName}:`, msgError);
            }

            await randomDelay(5000, 15000);
        }
    } catch (e) {
        console.error('[Wassel] Connection check error:', e);
    } finally {
        isCheckingConnections = false;
    }
}

// ============================================================================
// Message handler — from popup and content scripts
// ============================================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_CONFIG') {
        getConfig().then(sendResponse);
        return true;
    }

    if (message.type === 'SET_CONFIG') {
        setConfig(message.config).then(() => sendResponse({ ok: true }));
        return true;
    }

    if (message.type === 'SYNC_TOKEN') {
        syncTokenFromDashboard().then(sendResponse);
        return true;
    }

    if (message.type === 'GET_CAMPAIGNS') {
        apiCall('/ext/campaigns').then(sendResponse);
        return true;
    }

    if (message.type === 'IMPORT_PROSPECTS') {
        const { campaignId, sourceUrl, prospects } = message;
        console.log('[Wassel] Import request:', prospects?.length, 'prospects');
        console.log('[Wassel] Sample prospect:', JSON.stringify(prospects?.[0]));
        apiCall('/ext/import', {
            method: 'POST',
            body: JSON.stringify({
                campaign_id: campaignId || null,
                source_url: sourceUrl,
                prospects,
            }),
        }).then(response => {
            if (!response?.success) {
                console.error('[Wassel] Import failed:', JSON.stringify(response));
            } else {
                console.log('[Wassel] Import success:', response.imported, 'imported');
                // Auto-download CSV after successful import
                downloadProspectsCSV(prospects);
            }
            sendResponse(response);
        });
        return true;
    }

    if (message.type === 'START_AUTOMATION') {
        setConfig({ activeCampaignId: message.campaignId }).then(() => {
            startPolling();
            sendResponse({ ok: true, message: 'Automation started' });
        });
        return true;
    }

    if (message.type === 'STOP_AUTOMATION') {
        stopPolling();
        chrome.action.setBadgeText({ text: '' });
        sendResponse({ ok: true, message: 'Automation stopped' });
        return true;
    }

    if (message.type === 'GET_AUTOMATION_STATUS') {
        getDailyCounts().then(counts => {
            sendResponse({
                isPolling: isPollingActive,
                isProcessing,
                isPaused,
                ...counts,
            });
        });
        return true;
    }

    if (message.type === 'TEST_CONNECTION') {
        fetch(`${API_BASE}/health`)
            .then(r => r.json())
            .then(data => sendResponse({ ok: true, data }))
            .catch(e => sendResponse({ ok: false, error: e.message }));
        return true;
    }
});

// When extension is installed, set up alarms and start
chrome.runtime.onInstalled.addListener(async () => {
    chrome.storage.local.set({ apiUrl: API_BASE });
    console.log('[Wassel] Extension installed. Setting up...');
    
    // Sync token
    await syncTokenFromDashboard();
    
    // Start automation if token exists
    const config = await getConfig();
    if (config.apiToken) {
        console.log('[Wassel] Token found, starting campaign automation...');
        startPolling();
    }
});

// When Chrome starts (after restart), re-sync and restart
chrome.runtime.onStartup.addListener(async () => {
    console.log('[Wassel] Chrome started. Re-syncing token...');
    await syncTokenFromDashboard();
    
    const config = await getConfig();
    if (config.apiToken) {
        console.log('[Wassel] Token found on startup, starting automation...');
        startPolling();
    }
});

// Also auto-start when service worker wakes up (fallback)
(async () => {
    await new Promise(r => setTimeout(r, 2000));
    const config = await getConfig();
    if (config.apiToken && !isPollingActive) {
        console.log('[Wassel] Service worker wake-up: starting automation...');
        startPolling();
    }
})();
