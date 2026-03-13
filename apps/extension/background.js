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
// Rate limiting — stored daily in chrome.storage.local
// ============================================================================
async function getDailyCounts() {
    const today = new Date().toISOString().split('T')[0];
    const result = await chrome.storage.local.get(['rateLimitDate', 'inviteCount', 'messageCount']);

    if (result.rateLimitDate !== today) {
        await chrome.storage.local.set({
            rateLimitDate: today,
            inviteCount: 0,
            messageCount: 0,
        });
        return { inviteCount: 0, messageCount: 0 };
    }

    return {
        inviteCount: result.inviteCount || 0,
        messageCount: result.messageCount || 0,
    };
}

async function incrementCount(type) {
    const counts = await getDailyCounts();
    if (type === 'invite' || type === 'invitation') {
        await chrome.storage.local.set({ inviteCount: counts.inviteCount + 1 });
    } else if (type === 'message') {
        await chrome.storage.local.set({ messageCount: counts.messageCount + 1 });
    }
}

async function canPerformAction(type) {
    const counts = await getDailyCounts();
    if ((type === 'invite' || type === 'invitation') && counts.inviteCount >= 80) return false;
    if (type === 'message' && counts.messageCount >= 100) return false;
    return true;
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
let pollInterval = null;

// ============================================================================
// Automation polling — polls queue every 60 seconds
// ============================================================================
async function startPolling() {
    if (pollInterval) return;
    console.log('[Wassel] Starting automation polling...');
    pollInterval = setInterval(processQueue, 60000);
    processQueue();
    startConnectionChecker();
}

function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
    isProcessing = false;
    isPaused = false;
    stopConnectionChecker();
    console.log('[Wassel] Stopped automation polling.');
}

async function processQueue() {
    if (isProcessing || isPaused) return;

    const config = await getConfig();
    if (!config.apiToken || !config.activeCampaignId) return;

    isProcessing = true;

    try {
        const today = new Date().toISOString().split('T')[0];
        const { lastSnapshotDate } = await chrome.storage.local.get('lastSnapshotDate');
        if (lastSnapshotDate !== today && config.activeCampaignId) {
            try {
                await apiCall(`/sequence/campaigns/${config.activeCampaignId}/snapshot`, { method: 'POST' });
                await chrome.storage.local.set({ lastSnapshotDate: today });
                console.log('[Wassel] Daily snapshot saved for', today);
            } catch (e) { /* silent */ }
        }

        const result = await apiCall(`/sequence/campaigns/${config.activeCampaignId}/queue`);

        if (!result.success || !result.data || result.data.length === 0) {
            isProcessing = false;
            return;
        }

        const item = result.data[0];

        if (!(await canPerformAction(item.stepType))) {
            console.log(`[Wassel] Rate limit reached for ${item.stepType}. Skipping.`);
            isProcessing = false;
            return;
        }

        console.log(`[Wassel] Processing: ${item.stepType} for ${item.prospectName}`);

        const tabs = await chrome.tabs.query({ url: '*://www.linkedin.com/*' });

        if (tabs.length === 0) {
            console.log('[Wassel] No LinkedIn tab found. Opening one...');
            isProcessing = false;
            return;
        }

        const linkedInTab = tabs[0];

        try {
            const response = await chrome.tabs.sendMessage(linkedInTab.id, {
                type: 'EXECUTE_STEP',
                data: item,
            });

            if (response && response.success) {
                await apiCall('/sequence/step/complete', {
                    method: 'POST',
                    body: JSON.stringify({
                        prospectStepId: item.prospectStepId,
                        status: 'completed',
                    }),
                });

                await incrementCount(item.stepType);
                console.log(`[Wassel] ✓ Completed: ${item.stepType} for ${item.prospectName}`);
                chrome.action.setBadgeText({ text: '✓' });
                chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
            } else {
                if (response && response.linkedinRestriction) {
                    console.error('[Wassel] ⚠ LinkedIn restriction detected! Pausing campaign.');
                    isPaused = true;
                    await apiCall('/sequence/campaigns/pause', {
                        method: 'POST',
                        body: JSON.stringify({
                            campaignId: config.activeCampaignId,
                            reason: response.error || 'LinkedIn restriction detected',
                        }),
                    });
                    chrome.action.setBadgeText({ text: '!' });
                    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
                } else {
                    await apiCall('/sequence/step/complete', {
                        method: 'POST',
                        body: JSON.stringify({
                            prospectStepId: item.prospectStepId,
                            status: 'failed',
                            errorMessage: response?.error || 'Unknown error',
                        }),
                    });
                }
            }
        } catch (sendError) {
            console.error('[Wassel] Error sending to content script:', sendError);
        }

        await delayBetweenActions();

    } catch (e) {
        console.error('[Wassel] Queue processing error:', e);
    } finally {
        isProcessing = false;
    }
}

// ============================================================================
// Connection Status Checker — polls every 10 minutes
// ============================================================================
let connectionCheckInterval = null;
let isCheckingConnections = false;

function startConnectionChecker() {
    if (connectionCheckInterval) return;
    console.log('[Wassel] Starting connection status checker (every 10 min)...');
    connectionCheckInterval = setInterval(connectionCheckLoop, 600000);
    connectionCheckLoop();
}

function stopConnectionChecker() {
    if (connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
        connectionCheckInterval = null;
    }
    isCheckingConnections = false;
}

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
        const { clientId, campaignId, sourceUrl, prospects } = message;
        apiCall('/ext/import', {
            method: 'POST',
            body: JSON.stringify({
                client_id: clientId,
                campaign_id: campaignId,
                source_url: sourceUrl,
                prospects,
            }),
        }).then(sendResponse);
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
                isPolling: !!pollInterval,
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

// When extension is installed, sync token automatically
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ apiUrl: API_BASE });
    console.log('[Wassel] Extension installed. Auto-syncing token...');
    // Give the browser a moment to settle, then sync
    setTimeout(syncTokenFromDashboard, 2000);
});
