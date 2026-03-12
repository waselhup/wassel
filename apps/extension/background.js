// Wassel Extension — Background Service Worker
// Handles communication, automation polling, and rate limiting

const API_BASE = 'https://wassel-alpha.vercel.app/api';

// ============================================================================
// Storage helpers
// ============================================================================
async function getConfig() {
    const result = await chrome.storage.local.get(['apiToken', 'clientId', 'apiUrl', 'activeCampaignId']);
    return {
        apiToken: result.apiToken || '',
        clientId: result.clientId || '',
        apiUrl: result.apiUrl || API_BASE,
        activeCampaignId: result.activeCampaignId || '',
    };
}

async function setConfig(config) {
    await chrome.storage.local.set(config);
}

// ============================================================================
// Rate limiting — stored daily in chrome.storage.local
// ============================================================================
async function getDailyCounts() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const result = await chrome.storage.local.get(['rateLimitDate', 'inviteCount', 'messageCount']);

    // Reset if new day
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
        return { error: 'Not authenticated. Open extension popup and sign in.' };
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

// Between actions: 30-90 seconds
function delayBetweenActions() {
    return randomDelay(30000, 90000);
}

// Within action: 2-8 seconds
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
    if (pollInterval) return; // Already polling

    console.log('[Wassel] Starting automation polling...');
    pollInterval = setInterval(processQueue, 60000);

    // Also process immediately
    processQueue();
}

function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
    isProcessing = false;
    isPaused = false;
    console.log('[Wassel] Stopped automation polling.');
}

async function processQueue() {
    if (isProcessing || isPaused) return;

    const config = await getConfig();
    if (!config.apiToken || !config.activeCampaignId) return;

    isProcessing = true;

    try {
        // Fetch queue
        const result = await apiCall(`/sequence/campaigns/${config.activeCampaignId}/queue`);

        if (!result.success || !result.data || result.data.length === 0) {
            isProcessing = false;
            return;
        }

        // Process one item at a time
        const item = result.data[0];

        // Check rate limits
        if (!(await canPerformAction(item.stepType))) {
            console.log(`[Wassel] Rate limit reached for ${item.stepType}. Skipping.`);
            isProcessing = false;
            return;
        }

        console.log(`[Wassel] Processing: ${item.stepType} for ${item.prospectName}`);

        // Send to content script for execution
        const tabs = await chrome.tabs.query({ url: '*://www.linkedin.com/*' });

        if (tabs.length === 0) {
            console.log('[Wassel] No LinkedIn tab found. Opening one...');
            // Will be picked up on next poll after user opens LinkedIn
            isProcessing = false;
            return;
        }

        const linkedInTab = tabs[0];

        // Execute the action via content script
        try {
            const response = await chrome.tabs.sendMessage(linkedInTab.id, {
                type: 'EXECUTE_STEP',
                data: item,
            });

            if (response && response.success) {
                // Mark step as completed
                await apiCall('/sequence/step/complete', {
                    method: 'POST',
                    body: JSON.stringify({
                        prospectStepId: item.prospectStepId,
                        status: 'completed',
                    }),
                });

                // Increment rate limit counter
                await incrementCount(item.stepType);

                console.log(`[Wassel] ✓ Completed: ${item.stepType} for ${item.prospectName}`);

                // Update badge
                chrome.action.setBadgeText({ text: '✓' });
                chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
            } else {
                // Check if it's a LinkedIn restriction
                if (response && response.linkedinRestriction) {
                    console.error('[Wassel] ⚠ LinkedIn restriction detected! Pausing campaign.');
                    isPaused = true;

                    // Pause campaign on server
                    await apiCall('/sequence/campaigns/pause', {
                        method: 'POST',
                        body: JSON.stringify({
                            campaignId: config.activeCampaignId,
                            reason: response.error || 'LinkedIn restriction detected',
                        }),
                    });

                    // Red warning badge
                    chrome.action.setBadgeText({ text: '!' });
                    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
                } else {
                    // Regular failure
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

        // Random delay before next processing
        await delayBetweenActions();

    } catch (e) {
        console.error('[Wassel] Queue processing error:', e);
    } finally {
        isProcessing = false;
    }
}

// ============================================================================
// Also run acceptance checks periodically (every 6 hours = 21600000ms)
// ============================================================================
setInterval(async () => {
    const config = await getConfig();
    if (!config.apiToken) return;

    try {
        const result = await apiCall('/sequence/check-acceptances', { method: 'POST' });
        if (result.success) {
            console.log(`[Wassel] Acceptance check: unlocked=${result.unlocked}, expired=${result.expired}, deferred=${result.deferred}`);
        }
    } catch (e) {
        // Silent fail for background check
    }
}, 21600000); // 6 hours

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

// When extension is installed, set default config
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ apiUrl: API_BASE });
    console.log('[Wassel] Extension installed. API:', API_BASE);
});
