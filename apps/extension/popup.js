// Wassel Extension — Popup Script (Auto-Auth)
document.addEventListener('DOMContentLoaded', async () => {
    const statusBox = document.getElementById('status-box');
    const statusText = document.getElementById('status-text');
    const loginSection = document.getElementById('login-section');
    const connectedSection = document.getElementById('connected-section');
    const openDashboardBtn = document.getElementById('open-dashboard-btn');
    const retrySyncBtn = document.getElementById('retry-sync-btn');
    const testBtn = document.getElementById('test-btn');
    const openLinkedinBtn = document.getElementById('open-linkedin-btn');
    const dashboardBtn = document.getElementById('dashboard-btn');
    const resyncBtn = document.getElementById('resync-btn');

    function setStatus(type, text) {
        statusBox.className = `status ${type}`;
        const dotClass = type === 'ok' ? 'green' : type === 'err' ? 'red' : type === 'syncing' ? 'purple' : 'yellow';
        statusBox.querySelector('.dot').className = `dot ${dotClass}`;
        statusText.textContent = text;
    }

    function showConnected() {
        loginSection.classList.add('hidden');
        connectedSection.classList.remove('hidden');
        setStatus('ok', '✅ Connected to Wassel');
    }

    function showNotConnected(reason) {
        connectedSection.classList.add('hidden');
        loginSection.classList.remove('hidden');
        if (reason === 'no_tab') {
            setStatus('pending', 'Open Wassel dashboard to connect');
        } else if (reason === 'no_token') {
            setStatus('pending', 'Please log in to Wassel dashboard first');
        } else {
            setStatus('err', 'Could not connect — ' + (reason || 'unknown'));
        }
    }

    // Auto-sync on popup open
    async function autoSync() {
        setStatus('syncing', 'Connecting to dashboard...');

        // First check if we already have a token
        chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, (config) => {
            if (config && config.apiToken) {
                // Already have a token — verify it's still valid
                showConnected();
                return;
            }

            // No token — try to sync from dashboard tab
            chrome.runtime.sendMessage({ type: 'SYNC_TOKEN' }, (result) => {
                if (result && result.synced) {
                    showConnected();
                } else {
                    showNotConnected(result?.reason || 'unknown');
                }
            });
        });
    }

    // Run auto-sync immediately
    autoSync();

    // Sync button
    retrySyncBtn.addEventListener('click', () => {
        setStatus('syncing', 'Syncing...');
        chrome.runtime.sendMessage({ type: 'SYNC_TOKEN' }, (result) => {
            if (result && result.synced) {
                showConnected();
            } else {
                showNotConnected(result?.reason || 'unknown');
            }
        });
    });

    // Resync (refresh session)
    resyncBtn.addEventListener('click', () => {
        setStatus('syncing', 'Refreshing session...');
        chrome.runtime.sendMessage({ type: 'SYNC_TOKEN' }, (result) => {
            if (result && result.synced) {
                showConnected();
            } else {
                showNotConnected(result?.reason || 'unknown');
            }
        });
    });

    // Test connection
    testBtn.addEventListener('click', () => {
        setStatus('syncing', 'Testing connection...');
        testBtn.disabled = true;
        chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' }, (response) => {
            testBtn.disabled = false;
            if (response && response.ok) {
                setStatus('ok', '✅ Backend reachable');
            } else {
                setStatus('err', 'Connection failed: ' + (response?.error || 'Unknown'));
            }
        });
    });

    // Open LinkedIn
    openLinkedinBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://www.linkedin.com/search/results/people/' });
    });

    // Open Dashboard
    dashboardBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://wassel-alpha.vercel.app/app' });
    });

    // Open Dashboard (login prompt)
    openDashboardBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://wassel-alpha.vercel.app/login' });
    });
});
