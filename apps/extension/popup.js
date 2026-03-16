// Wassel Extension — Popup Script (Dual-View: Scan + Connected)
document.addEventListener('DOMContentLoaded', async () => {
    const statusBox = document.getElementById('status-box');
    const statusText = document.getElementById('status-text');
    const headerBadge = document.getElementById('header-badge');
    const loginSection = document.getElementById('login-section');
    const connectedSection = document.getElementById('connected-section');
    const scanSection = document.getElementById('scan-section');

    // Login elements
    const openDashboardBtn = document.getElementById('open-dashboard-btn');
    const retrySyncBtn = document.getElementById('retry-sync-btn');

    // Connected elements
    const testBtn = document.getElementById('test-btn');
    const openLinkedinBtn = document.getElementById('open-linkedin-btn');
    const dashboardBtn = document.getElementById('dashboard-btn');
    const resyncBtn = document.getElementById('resync-btn');

    // Scan elements
    const scanBtn = document.getElementById('scan-btn');
    const scanResults = document.getElementById('scan-results');
    const prospectList = document.getElementById('prospect-list');
    const selectedCountEl = document.getElementById('selected-count');
    const selectAllBtn = document.getElementById('select-all-btn');
    const importBtn = document.getElementById('import-btn');
    const importResultEl = document.getElementById('import-result');
    const scanDashboardBtn = document.getElementById('scan-dashboard-btn');
    const scanRescanBtn = document.getElementById('scan-rescan-btn');

    let prospects = [];
    let selected = new Set();

    // ── Helpers ──
    function setStatus(type, text) {
        statusBox.className = `status ${type}`;
        const dotClass = type === 'ok' ? 'green' : type === 'err' ? 'red' : type === 'syncing' ? 'purple' : type === 'found' ? 'green' : 'yellow';
        statusBox.querySelector('.dot').className = `dot ${dotClass}`;
        statusText.textContent = text;
    }

    function hideAll() {
        loginSection.classList.add('hidden');
        connectedSection.classList.add('hidden');
        scanSection.classList.add('hidden');
    }

    function showConnected() {
        hideAll();
        connectedSection.classList.remove('hidden');
        setStatus('ok', '✅ Connected to Wassel');
    }

    function showNotConnected(reason) {
        hideAll();
        loginSection.classList.remove('hidden');
        if (reason === 'no_tab') {
            setStatus('pending', 'Open Wassel dashboard to connect');
        } else if (reason === 'no_token') {
            setStatus('pending', 'Please log in to Wassel dashboard first');
        } else {
            setStatus('err', 'Could not connect — ' + (reason || 'unknown'));
        }
    }

    function showScanView() {
        hideAll();
        scanSection.classList.remove('hidden');
        headerBadge.textContent = 'LinkedIn';
        headerBadge.classList.remove('hidden');
        setStatus('ok', '✅ Ready to scan this page');
    }

    function updateSelection() {
        const count = selected.size;
        selectedCountEl.textContent = `${count} selected`;
        importBtn.textContent = `📥 Import Selected (${count})`;
        importBtn.disabled = count === 0;

        // Update checkboxes
        document.querySelectorAll('.prospect-item').forEach(item => {
            const id = item.dataset.id;
            const checkbox = item.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = selected.has(id);
            item.classList.toggle('selected', selected.has(id));
        });
    }

    function renderProspects() {
        prospectList.innerHTML = '';
        prospects.forEach((p, i) => {
            const id = p.linkedin_url || p.linkedinUrl || `prospect-${i}`;
            const item = document.createElement('div');
            item.className = `prospect-item ${selected.has(id) ? 'selected' : ''}`;
            item.dataset.id = id;
            item.innerHTML = `
                <input type="checkbox" ${selected.has(id) ? 'checked' : ''}>
                <div class="prospect-info">
                    <div class="prospect-name">${p.name || 'Unknown'}</div>
                    <div class="prospect-detail">${p.title || p.headline || ''} ${p.company ? '· ' + p.company : ''}</div>
                </div>
            `;
            item.addEventListener('click', (e) => {
                if (e.target.tagName === 'INPUT') return;
                if (selected.has(id)) {
                    selected.delete(id);
                } else {
                    selected.add(id);
                }
                updateSelection();
            });
            item.querySelector('input').addEventListener('change', () => {
                if (selected.has(id)) {
                    selected.delete(id);
                } else {
                    selected.add(id);
                }
                updateSelection();
            });
            prospectList.appendChild(item);
        });
    }

    // ── Scanning ──
    async function scanPage() {
        scanBtn.disabled = true;
        scanBtn.textContent = '⏳ Scanning...';
        setStatus('syncing', 'Scanning LinkedIn page...');

        // Get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
            setStatus('err', 'Cannot access current tab');
            scanBtn.disabled = false;
            scanBtn.textContent = '🔍 Scan Page for Prospects';
            return;
        }

        try {
            // Inject content script scan if needed, then ask it for prospects
            const results = await chrome.tabs.sendMessage(tab.id, { type: 'SCAN_PROSPECTS' });
            if (results && results.prospects && results.prospects.length > 0) {
                prospects = results.prospects;
                selected = new Set(prospects.map((p, i) => p.linkedin_url || p.linkedinUrl || `prospect-${i}`));

                setStatus('found', `🎯 Found ${prospects.length} prospects`);
                renderProspects();
                scanResults.classList.remove('hidden');
                updateSelection();
            } else {
                setStatus('pending', 'No prospects found. Scroll down and try again.');
            }
        } catch (e) {
            console.error('Scan error:', e);
            // Content script may not be injected — try injecting it
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });
                // Retry scan after injection
                setTimeout(async () => {
                    try {
                        const results = await chrome.tabs.sendMessage(tab.id, { type: 'SCAN_PROSPECTS' });
                        if (results && results.prospects && results.prospects.length > 0) {
                            prospects = results.prospects;
                            selected = new Set(prospects.map((p, i) => p.linkedin_url || p.linkedinUrl || `prospect-${i}`));
                            setStatus('found', `🎯 Found ${prospects.length} prospects`);
                            renderProspects();
                            scanResults.classList.remove('hidden');
                            updateSelection();
                        } else {
                            setStatus('pending', 'No prospects found. Try scrolling down first.');
                        }
                    } catch (e2) {
                        setStatus('err', 'Content script not responding. Refresh the page.');
                    }
                }, 500);
            } catch (injectErr) {
                setStatus('err', 'Cannot scan this page. Make sure you are on LinkedIn search.');
            }
        }

        scanBtn.disabled = false;
        scanBtn.textContent = '🔍 Scan Page for Prospects';
    }

    // ── Import ──
    async function importSelected() {
        if (selected.size === 0) return;

        importBtn.disabled = true;
        importBtn.textContent = '⏳ Importing...';
        importResultEl.classList.add('hidden');

        const selectedProspects = prospects.filter((p, i) => {
            const id = p.linkedin_url || p.linkedinUrl || `prospect-${i}`;
            return selected.has(id);
        });

        // Get API token from background
        chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, async (config) => {
            if (!config || !config.apiToken) {
                importResultEl.innerHTML = '<div class="import-result error">Not connected to Wassel. Please sync first.</div>';
                importResultEl.classList.remove('hidden');
                importBtn.disabled = false;
                importBtn.textContent = `📥 Import Selected (${selected.size})`;
                return;
            }

            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                const apiBase = config.apiBase || 'https://wassel-alpha.vercel.app/api';
                const res = await fetch(`${apiBase}/ext/import`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${config.apiToken}`,
                    },
                    body: JSON.stringify({
                        prospects: selectedProspects,
                        source_url: tab?.url || 'linkedin_search',
                    }),
                });

                const data = await res.json();

                if (res.ok) {
                    const count = data.imported || data.count || selectedProspects.length;
                    importResultEl.innerHTML = `<div class="import-result success">✅ ${count} prospects imported successfully!</div>`;

                    // Trigger CSV download
                    downloadCSV(selectedProspects);
                } else {
                    const errMsg = data.error || 'Import failed';
                    importResultEl.innerHTML = `<div class="import-result error">❌ ${errMsg}</div>`;
                }
            } catch (e) {
                importResultEl.innerHTML = `<div class="import-result error">❌ Network error: ${e.message}</div>`;
            }

            importResultEl.classList.remove('hidden');
            importBtn.disabled = false;
            importBtn.textContent = `📥 Import Selected (${selected.size})`;
        });
    }

    // ── CSV Download ──
    function downloadCSV(prospects) {
        const headers = ['Name', 'Title', 'Company', 'LinkedIn URL', 'Imported At'];
        const rows = prospects.map(p => [
            p.name || '',
            p.title || p.headline || '',
            p.company || '',
            p.linkedin_url || p.linkedinUrl || '',
            new Date().toLocaleDateString(),
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
        ].join('\n');

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        chrome.downloads.download({
            url: url,
            filename: `wassel-prospects-${new Date().toISOString().slice(0, 10)}.csv`,
            saveAs: false,
        });
    }

    // ── Event Listeners ──
    scanBtn.addEventListener('click', scanPage);
    scanRescanBtn.addEventListener('click', scanPage);

    selectAllBtn.addEventListener('click', () => {
        if (selected.size === prospects.length) {
            selected.clear();
        } else {
            prospects.forEach((p, i) => {
                selected.add(p.linkedin_url || p.linkedinUrl || `prospect-${i}`);
            });
        }
        updateSelection();
        renderProspects();
    });

    importBtn.addEventListener('click', importSelected);

    scanDashboardBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://wassel-alpha.vercel.app/app' });
    });

    // Connected view buttons
    openLinkedinBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://www.linkedin.com/search/results/people/' });
    });

    dashboardBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://wassel-alpha.vercel.app/app' });
    });

    openDashboardBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://wassel-alpha.vercel.app/login' });
    });

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

    retrySyncBtn.addEventListener('click', () => {
        setStatus('syncing', 'Syncing...');
        chrome.runtime.sendMessage({ type: 'SYNC_TOKEN' }, (result) => {
            if (result && result.synced) {
                detectAndShow();
            } else {
                showNotConnected(result?.reason || 'unknown');
            }
        });
    });

    resyncBtn.addEventListener('click', () => {
        setStatus('syncing', 'Refreshing session...');
        chrome.runtime.sendMessage({ type: 'SYNC_TOKEN' }, (result) => {
            if (result && result.synced) {
                detectAndShow();
            } else {
                showNotConnected(result?.reason || 'unknown');
            }
        });
    });

    // ── Main Logic: Detect URL and show appropriate view ──
    async function detectAndShow() {
        // Check if we have a token
        chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, async (config) => {
            if (!config || !config.apiToken) {
                // Try syncing first
                chrome.runtime.sendMessage({ type: 'SYNC_TOKEN' }, async (result) => {
                    if (result && result.synced) {
                        await showCorrectView();
                    } else {
                        showNotConnected(result?.reason || 'unknown');
                    }
                });
                return;
            }
            await showCorrectView();
        });
    }

    async function showCorrectView() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const url = tab?.url || '';
            const isLinkedIn = url.includes('linkedin.com/search') || url.includes('linkedin.com/in/');

            if (isLinkedIn) {
                showScanView();
            } else {
                showConnected();
            }
        } catch (e) {
            showConnected();
        }
    }

    // Initialize
    detectAndShow();
});
