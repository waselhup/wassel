// Wassel Extension — Background Service Worker
// Handles communication between content script, popup, and Wassel API

const API_BASE = 'https://wassel-alpha.vercel.app/api';

// Storage helpers
async function getConfig() {
    const result = await chrome.storage.local.get(['apiToken', 'clientId', 'apiUrl']);
    return {
        apiToken: result.apiToken || '',
        clientId: result.clientId || '',
        apiUrl: result.apiUrl || API_BASE,
    };
}

async function setConfig(config) {
    await chrome.storage.local.set(config);
}

// API helpers
async function apiCall(endpoint, options = {}) {
    const config = await getConfig();
    if (!config.apiToken) {
        return { error: 'Not authenticated. Open extension popup and sign in.' };
    }

    const url = `${config.apiUrl}${endpoint}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiToken}`,
            ...(options.headers || {}),
        },
    });
    return res.json();
}

// Message handler
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
