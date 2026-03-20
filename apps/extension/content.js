// ============================================================
// WASSEL EXTENSION — DEVELOPER NOTICE
// Before committing any changes to this file or any file in
// apps/extension/, run: npm run ext:version
// This bumps the version in manifest.json and logs the change.
// ============================================================

// Wassel Extension — Content Script
// Injected on LinkedIn search result pages
// Adds a floating "Import to Wassel" sidebar

(function () {
    'use strict';

    // Prevent double injection
    if (document.getElementById('wassel-sidebar-root')) return;

    // Set detection attribute for the web app
    document.documentElement.setAttribute('data-wassel-extension', 'true');
    window.postMessage({ type: 'WASSEL_EXTENSION_INSTALLED', version: '1.1.0' }, '*');

    // Marker for detection by the web app
    const marker = document.createElement('div');
    marker.id = 'wassel-extension-marker';
    marker.style.display = 'none';
    document.body.appendChild(marker);

    // State
    let isOpen = false;
    let selectedProspects = [];
    let allProspects = [];
    let importing = false;
    let importResult = null;

    // Create floating button
    const fab = document.createElement('button');
    fab.id = 'wassel-fab';
    fab.innerHTML = '⚡';
    fab.title = 'Wassel — Import Prospects';
    document.body.appendChild(fab);

    // Create sidebar container
    const sidebar = document.createElement('div');
    sidebar.id = 'wassel-sidebar-root';
    sidebar.innerHTML = `
    <div id="wassel-sidebar" class="wassel-closed">
      <div class="wassel-header">
        <span class="wassel-logo">⚡ Wassel</span>
        <button id="wassel-close" class="wassel-close-btn">✕</button>
      </div>
      <div class="wassel-body">
        <div id="wassel-status" class="wassel-status wassel-status-info">
          Select a count and click "Start Collecting", or scan the current page.
        </div>
        <div class="wassel-collect-section">
          <select id="wassel-count-select" class="wassel-select">
            <option value="25">25 prospects</option>
            <option value="50">50 prospects</option>
            <option value="100">100 prospects</option>
            <option value="200">200 prospects</option>
            <option value="500">500 prospects</option>
          </select>
          <button id="wassel-collect" class="wassel-btn wassel-btn-primary">🚀 Start Collecting</button>
        </div>
        <div id="wassel-progress" class="wassel-hidden wassel-status wassel-status-info"></div>
        <div class="wassel-actions">
          <button id="wassel-scan" class="wassel-btn wassel-btn-secondary">🔍 Scan Page</button>
          <button id="wassel-select-all" class="wassel-btn wassel-btn-secondary wassel-hidden">☑ Select All</button>
        </div>
        <div id="wassel-prospects" class="wassel-prospects"></div>
        <div id="wassel-import-section" class="wassel-hidden">
          <button id="wassel-import" class="wassel-btn wassel-btn-success" disabled>📥 Import Selected (0)</button>
        </div>
        <div id="wassel-result" class="wassel-hidden"></div>
      </div>
    </div>
  `;
    document.body.appendChild(sidebar);

    // Get elements
    const sidebarEl = document.getElementById('wassel-sidebar');
    const closeBtn = document.getElementById('wassel-close');
    const scanBtn = document.getElementById('wassel-scan');
    const selectAllBtn = document.getElementById('wassel-select-all');
    const prospectsEl = document.getElementById('wassel-prospects');
    const importSection = document.getElementById('wassel-import-section');
    const importBtn = document.getElementById('wassel-import');
    const statusEl = document.getElementById('wassel-status');
    const resultEl = document.getElementById('wassel-result');
    const collectBtn = document.getElementById('wassel-collect');
    const countSelect = document.getElementById('wassel-count-select');
    const progressEl = document.getElementById('wassel-progress');

    // Toggle sidebar
    fab.addEventListener('click', () => {
        isOpen = !isOpen;
        sidebarEl.className = isOpen ? 'wassel-open' : 'wassel-closed';
        fab.style.display = isOpen ? 'none' : 'flex';
    });

    closeBtn.addEventListener('click', () => {
        isOpen = false;
        sidebarEl.className = 'wassel-closed';
        fab.style.display = 'flex';
    });

    // Auto-scroll to load lazy-rendered LinkedIn results
    function scrollToLoadAll() {
        return new Promise((resolve) => {
            statusEl.textContent = 'Scrolling to load results...';
            let scrollCount = 0;
            const maxScrolls = 15;
            const interval = setInterval(() => {
                window.scrollBy(0, 600);
                scrollCount++;
                if (scrollCount >= maxScrolls || window.scrollY + window.innerHeight >= document.body.scrollHeight - 200) {
                    clearInterval(interval);
                    // Scroll back to top so user sees the sidebar
                    window.scrollTo(0, 0);
                    setTimeout(resolve, 800);
                }
            }, 350);
        });
    }

    // "Start Collecting" — multi-page auto-scroll via background.js
    collectBtn.addEventListener('click', () => {
        const targetCount = parseInt(countSelect.value) || 25;
        collectBtn.disabled = true;
        collectBtn.textContent = '⏳ Collecting...';
        allProspects = [];
        selectedProspects = [];
        prospectsEl.innerHTML = '';
        selectAllBtn.classList.add('wassel-hidden');
        importSection.classList.add('wassel-hidden');
        progressEl.textContent = `Collecting ${targetCount} prospects... 0 / ${targetCount}`;
        progressEl.classList.remove('wassel-hidden');
        statusEl.className = 'wassel-status wassel-status-info';

        chrome.runtime.sendMessage({
            type: 'START_COLLECTION',
            targetCount,
        }, (response) => {
            if (!response?.started) {
                progressEl.textContent = 'Failed to start collection.';
                collectBtn.disabled = false;
                collectBtn.textContent = '🚀 Start Collecting';
            }
        });
    });

    // Scan page for prospects — 5-strategy fallback
    scanBtn.addEventListener('click', async () => {
        statusEl.textContent = 'Scrolling to load results...';
        statusEl.className = 'wassel-status wassel-status-info';
        await scrollToLoadAll();
        statusEl.textContent = 'Scanning...';
        statusEl.className = 'wassel-status wassel-status-info';
        allProspects = [];
        selectedProspects = [];

        console.log('[Wassel] Starting smart scan...');

        // Strategy 1: data-view-name attribute (newest LinkedIn)
        let resultCards = document.querySelectorAll(
            '[data-view-name="search-entity-result-universal-template"]'
        );
        console.log('[Wassel] Strategy 1 (data-view-name):', resultCards.length);

        // Strategy 2: search-results-container li
        if (resultCards.length === 0) {
            resultCards = document.querySelectorAll(
                '.search-results-container ul > li'
            );
            console.log('[Wassel] Strategy 2 (search-results li):', resultCards.length);
        }

        // Strategy 3: reusable-search / entity-result classes
        if (resultCards.length === 0) {
            resultCards = document.querySelectorAll(
                '.reusable-search__result-container, .entity-result'
            );
            console.log('[Wassel] Strategy 3 (reusable-search):', resultCards.length);
        }

        // Strategy 4: find ALL list items that contain profile links
        if (resultCards.length === 0) {
            const allLi = document.querySelectorAll('li');
            resultCards = Array.from(allLi).filter(li => {
                return li.querySelector('a[href*="/in/"]');
            });
            console.log('[Wassel] Strategy 4 (li with /in/ links):', resultCards.length);
        }

        // Strategy 5: Direct link approach — build from profile links
        if (resultCards.length === 0) {
            const profileLinks = document.querySelectorAll('a[href*="/in/"]');
            console.log('[Wassel] Strategy 5 (direct links):', profileLinks.length);

            if (profileLinks.length > 0) {
                const seen = new Set();
                let idx = 0;
                profileLinks.forEach(link => {
                    const href = link.href;
                    if (!href || !href.includes('/in/')) return;
                    const cleanUrl = href.split('?')[0];
                    if (seen.has(cleanUrl)) return;
                    seen.add(cleanUrl);

                    const container = link.closest('li') || link.parentElement;
                    const nameEl = container?.querySelector(
                        '.entity-result__title-text, [aria-hidden="true"], ' +
                        '.artdeco-entity-lockup__title, span[dir="ltr"]'
                    );
                    const titleEl = container?.querySelector(
                        '.entity-result__primary-subtitle, ' +
                        '.artdeco-entity-lockup__subtitle'
                    );
                    const companyEl = container?.querySelector(
                        '.entity-result__secondary-subtitle'
                    );

                    const name = nameEl?.innerText?.trim() || link.innerText?.trim() || '';
                    if (!name || name.length < 2) return;

                    // Profile photo
                    const photoEl = container?.querySelector(
                        'img.presence-entity__image, img.EntityPhoto-circle-3, ' +
                        'img[class*="profile-photo"], .ivm-image-view-model img, ' +
                        'img.ivm-view-attr__img--centered'
                    );
                    const photoUrl = photoEl?.src || null;

                    allProspects.push({
                        id: idx++,
                        name,
                        linkedin_url: cleanUrl,
                        title: titleEl?.innerText?.trim() || '',
                        company: companyEl?.innerText?.trim() || '',
                        location: '',
                        photo_url: photoUrl,
                        selected: true,
                    });
                });
                console.log('[Wassel] Strategy 5 extracted:', allProspects.length);
            }
        }

        // Extract from cards (strategies 1–4)
        if (allProspects.length === 0 && resultCards.length > 0) {
            resultCards.forEach((card, i) => {
                try {
                    // Name — try multiple selectors
                    const nameEl = card.querySelector(
                        '.entity-result__title-text a span[aria-hidden="true"], ' +
                        '.entity-result__title-line a span[dir="ltr"] span[aria-hidden="true"], ' +
                        '.app-aware-link span[aria-hidden="true"], ' +
                        '.artdeco-entity-lockup__title span, ' +
                        '[data-anonymize="person-name"]'
                    );
                    const name = nameEl ? nameEl.textContent.trim() : '';

                    // Profile URL
                    const linkEl = card.querySelector(
                        'a[href*="/in/"], a.app-aware-link[href*="/in/"]'
                    );
                    const linkedinUrl = linkEl ? linkEl.href.split('?')[0] : '';

                    // Title / headline
                    const titleEl = card.querySelector(
                        '.entity-result__primary-subtitle, ' +
                        '.entity-result__summary, ' +
                        '.artdeco-entity-lockup__subtitle'
                    );
                    const title = titleEl ? titleEl.textContent.trim() : '';

                    // Company
                    const companyEl = card.querySelector('.entity-result__secondary-subtitle');
                    const company = companyEl ? companyEl.textContent.trim() : '';

                    // Location
                    const locationEl = card.querySelector(
                        '.entity-result__simple-insight, .entity-result__content-summary'
                    );
                    const location = locationEl ? locationEl.textContent.trim() : '';

                    if (name && linkedinUrl) {
                        // Profile photo
                        const photoEl = card.querySelector(
                            'img.presence-entity__image, img.EntityPhoto-circle-3, ' +
                            'img[class*="profile-photo"], .ivm-image-view-model img, ' +
                            'img.ivm-view-attr__img--centered'
                        );
                        const photoUrl = photoEl ? photoEl.src : null;

                        allProspects.push({
                            id: i,
                            name,
                            linkedin_url: linkedinUrl,
                            title,
                            company,
                            location,
                            photo_url: photoUrl,
                            selected: true,
                        });
                    }
                } catch (e) {
                    console.warn('[Wassel] Failed to parse card:', e);
                }
            });
        }

        console.log('[Wassel] Total prospects found:', allProspects.length);

        if (allProspects.length === 0) {
            statusEl.textContent = 'No prospects found. Make sure you are on a LinkedIn People search page and scroll down to load results.';
            statusEl.className = 'wassel-status wassel-status-warn';
            // Log DOM debug info
            console.log('[Wassel] DEBUG — body classes:', document.body.className);
            console.log('[Wassel] DEBUG — main HTML:', document.querySelector('main')?.innerHTML?.substring(0, 500));
            return;
        }

        selectedProspects = [...allProspects];
        statusEl.textContent = `Found ${allProspects.length} prospects`;
        statusEl.className = 'wassel-status wassel-status-ok';
        selectAllBtn.classList.remove('wassel-hidden');
        importSection.classList.remove('wassel-hidden');
        updateImportBtn();
        renderProspects();
    });

    function renderProspects() {
        prospectsEl.innerHTML = allProspects.map(p => `
      <div class="wassel-prospect ${p.selected ? 'wassel-selected' : ''}" data-id="${p.id}">
        <input type="checkbox" ${p.selected ? 'checked' : ''} class="wassel-checkbox">
        <div class="wassel-prospect-info">
          <div class="wassel-prospect-name">${escapeHtml(p.name)}</div>
          ${p.title ? `<div class="wassel-prospect-title">${escapeHtml(p.title)}</div>` : ''}
          ${p.company ? `<div class="wassel-prospect-company">${escapeHtml(p.company)}</div>` : ''}
        </div>
      </div>
    `).join('');

        // Add click handlers
        prospectsEl.querySelectorAll('.wassel-prospect').forEach(el => {
            el.addEventListener('click', (e) => {
                const id = parseInt(el.dataset.id);
                const prospect = allProspects.find(p => p.id === id);
                if (prospect) {
                    prospect.selected = !prospect.selected;
                    selectedProspects = allProspects.filter(p => p.selected);
                    updateImportBtn();
                    renderProspects();
                }
            });
        });
    }

    function updateImportBtn() {
        const count = selectedProspects.length;
        importBtn.textContent = `📥 Import Selected (${count})`;
        importBtn.disabled = count === 0 || importing;
    }

    // Select all toggle
    selectAllBtn.addEventListener('click', () => {
        const allSelected = allProspects.every(p => p.selected);
        allProspects.forEach(p => p.selected = !allSelected);
        selectedProspects = allProspects.filter(p => p.selected);
        selectAllBtn.textContent = allSelected ? '☑ Select All' : '☐ Deselect All';
        updateImportBtn();
        renderProspects();
    });

    // Import
    importBtn.addEventListener('click', async () => {
        if (importing || selectedProspects.length === 0) return;
        importing = true;
        importBtn.disabled = true;
        importBtn.textContent = '⏳ Importing...';

        chrome.runtime.sendMessage({
            type: 'GET_CONFIG',
        }, (config) => {
            if (!config || !config.apiToken) {
                showResult('error', 'Not connected. Open wassel-alpha.vercel.app, log in, then click the extension popup to sync.');
                importing = false;
                updateImportBtn();
                return;
            }

            chrome.runtime.sendMessage({
                type: 'IMPORT_PROSPECTS',
                token: config.apiToken,
                campaignId: null,
                sourceUrl: window.location.href,
                prospects: selectedProspects.map(p => ({
                    linkedin_url: p.linkedin_url,
                    name: p.name || '',
                    title: p.title || '',
                    company: p.company || '',
                    location: p.location || '',
                })),
            }, (response) => {
                importing = false;
                if (response && response.success) {
                    showResult('success', `✅ ${response.imported} prospects imported successfully!`);
                    selectedProspects.forEach(p => p.selected = false);
                    selectedProspects = [];
                    updateImportBtn();
                    renderProspects();
                } else {
                    showResult('error', `❌ Import failed: ${response?.error || 'Unknown error'}`);
                    updateImportBtn();
                }
            });
        });
    });

    function showResult(type, message) {
        resultEl.className = `wassel-result wassel-result-${type}`;
        resultEl.textContent = message;
        resultEl.classList.remove('wassel-hidden');
        setTimeout(() => resultEl.classList.add('wassel-hidden'), 8000);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ========================================================================
    // AUTOMATION: Listen for messages from background.js
    // ========================================================================
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'EXECUTE_STEP') {
            const { data } = message;
            // Normalize field names (global queue uses snake_case, per-campaign uses camelCase)
            const normalized = {
                ...data,
                stepType: data.stepType || data.step_type,
                linkedinUrl: data.linkedinUrl || data.linkedin_url,
                prospectName: data.prospectName || data.name,
                messageTemplate: data.messageTemplate || data.message_template || '',
            };
            console.log('[Wassel] Executing step:', normalized.stepType, normalized.prospectName);

            executeStep(normalized)
                .then(result => sendResponse(result))
                .catch(err => sendResponse({ success: false, error: err.message }));

            return true; // async response
        }

        if (message.type === 'CHECK_CONNECTION_STATUS') {
            const { data } = message;
            console.log('[Wassel] Checking connection:', data.prospectName);

            checkConnectionStatus(data)
                .then(result => sendResponse(result))
                .catch(err => sendResponse({ status: 'pending', error: err.message }));

            return true; // async response
        }

        // Progress update from background during multi-page collection
        if (message.type === 'PROGRESS_UPDATE') {
            progressEl.textContent = `Collecting... ${message.collected} / ${message.target} (page ${message.page})`;
            progressEl.classList.remove('wassel-hidden');
            return false;
        }

        // Collection complete — populate sidebar with collected prospects
        if (message.type === 'COLLECTION_COMPLETE') {
            const collected = message.prospects || [];
            allProspects = collected.map((p, i) => ({ ...p, id: i, selected: true }));
            selectedProspects = [...allProspects];

            collectBtn.disabled = false;
            collectBtn.textContent = '🚀 Start Collecting';
            progressEl.classList.add('wassel-hidden');

            if (allProspects.length === 0) {
                statusEl.textContent = 'No prospects found. Make sure you are on a LinkedIn People search page.';
                statusEl.className = 'wassel-status wassel-status-warn';
            } else {
                statusEl.textContent = `Collected ${allProspects.length} prospects`;
                statusEl.className = 'wassel-status wassel-status-ok';
                selectAllBtn.classList.remove('wassel-hidden');
                importSection.classList.remove('wassel-hidden');
                updateImportBtn();
                renderProspects();
            }
            return false;
        }

        return false;
    });

    // CHECK_CONNECTION_STATUS: Navigate to profile, detect button state
    async function checkConnectionStatus(data) {
        try {
            if (!data.linkedinUrl) {
                return { status: 'pending', error: 'No LinkedIn URL' };
            }

            // Navigate to profile if not already there
            const profileSlug = data.linkedinUrl.split('/in/')[1]?.replace(/\/$/, '');
            if (!profileSlug || !window.location.href.includes(profileSlug)) {
                window.location.href = data.linkedinUrl;
                await new Promise(resolve => {
                    const checkLoaded = setInterval(() => {
                        if (document.readyState === 'complete') {
                            clearInterval(checkLoaded);
                            resolve();
                        }
                    }, 500);
                });
                // Wait for LinkedIn to fully render
                await randomDelay(3000, 5000);
            }

            // Check for restrictions first
            const restriction = checkForRestrictions();
            if (restriction) {
                return { status: 'pending', error: `Restriction: ${restriction}` };
            }

            // Detect connection status from profile buttons
            const buttons = document.querySelectorAll('button, a[role="button"]');
            let hasMessageBtn = false;
            let hasPendingBtn = false;
            let hasConnectBtn = false;

            for (const btn of buttons) {
                const btnText = (btn.textContent || '').trim().toLowerCase();
                const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();

                // "Message" button = connected (accepted)
                if (btnText === 'message' || ariaLabel.includes('message')) {
                    hasMessageBtn = true;
                }

                // "Pending" button = invite sent, not yet accepted
                if (btnText === 'pending' || btnText.includes('pending') || ariaLabel.includes('pending')) {
                    hasPendingBtn = true;
                }

                // "Connect" button = not connected (withdrawn or never invited)
                if (btnText === 'connect' || ariaLabel.includes('connect')) {
                    // Ignore "Connect with" type links
                    if (!btnText.includes('connected') && !ariaLabel.includes('connected')) {
                        hasConnectBtn = true;
                    }
                }
            }

            // Determine status based on button priority
            if (hasMessageBtn) {
                console.log(`[Wassel] ✅ ${data.prospectName}: Message button found → accepted`);
                return { status: 'accepted' };
            }

            if (hasPendingBtn) {
                console.log(`[Wassel] ⏳ ${data.prospectName}: Pending button found → still waiting`);
                return { status: 'pending' };
            }

            if (hasConnectBtn) {
                console.log(`[Wassel] ❌ ${data.prospectName}: Connect button found → withdrawn`);
                return { status: 'withdrawn' };
            }

            // Fallback: can't determine, assume still pending
            console.log(`[Wassel] ❓ ${data.prospectName}: Could not determine status, assuming pending`);
            return { status: 'pending' };

        } catch (e) {
            console.error('[Wassel] Connection check error:', e);
            return { status: 'pending', error: e.message };
        }
    }

    // Random delay helper
    function randomDelay(minMs, maxMs) {
        return new Promise(resolve => {
            const delay = Math.floor(Math.random() * (maxMs - minMs)) + minMs;
            setTimeout(resolve, delay);
        });
    }

    // Check for LinkedIn restriction signals
    function checkForRestrictions() {
        const pageText = document.body.innerText || '';
        const restrictionSignals = [
            'you\'ve reached the weekly invitation limit',
            'restriction',
            'temporarily restricted',
            'unusual activity',
            'verify your identity',
            'security verification',
            'captcha',
        ];

        for (const signal of restrictionSignals) {
            if (pageText.toLowerCase().includes(signal)) {
                return signal;
            }
        }
        return null;
    }

    // Execute the appropriate step
    async function executeStep(data) {
        const stepType = data.stepType || data.step_type;
        switch (stepType) {
            case 'visit':
                return await executeVisit(data);
            case 'invite':
            case 'invitation':
                return await executeInvite(data);
            case 'message':
            case 'follow':
                return await executeMessage(data);
            default:
                return { success: false, error: `Unknown step type: ${stepType}` };
        }
    }

    // VISIT: Navigate to profile, wait, return
    async function executeVisit(data) {
        try {
            if (!data.linkedinUrl) {
                return { success: false, error: 'No LinkedIn URL' };
            }

            // Navigate to profile
            window.location.href = data.linkedinUrl;

            // Wait for page to load
            await new Promise(resolve => {
                const checkLoaded = setInterval(() => {
                    if (document.readyState === 'complete') {
                        clearInterval(checkLoaded);
                        resolve();
                    }
                }, 500);
            });

            // Check for restrictions
            const restriction = checkForRestrictions();
            if (restriction) {
                return { success: false, linkedinRestriction: true, error: `Restriction: ${restriction}` };
            }

            // Wait random 4-7 seconds (simulate browsing)
            await randomDelay(4000, 7000);

            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    // INVITE: Navigate to profile, click Connect, optionally add note
    async function executeInvite(data) {
        try {
            if (!data.linkedinUrl) {
                return { success: false, error: 'No LinkedIn URL' };
            }

            // Navigate to profile if not already there
            if (!window.location.href.includes(data.linkedinUrl.split('/in/')[1])) {
                window.location.href = data.linkedinUrl;
                await new Promise(resolve => {
                    const checkLoaded = setInterval(() => {
                        if (document.readyState === 'complete') {
                            clearInterval(checkLoaded);
                            resolve();
                        }
                    }, 500);
                });
                await randomDelay(2000, 4000);
            }

            // Check for restrictions
            const restriction = checkForRestrictions();
            if (restriction) {
                return { success: false, linkedinRestriction: true, error: `Restriction: ${restriction}` };
            }

            // Find and click Connect button
            const connectBtn = findButton(['Connect', 'connect', 'Se connecter']);
            if (!connectBtn) {
                // Try "More" menu first
                const moreBtn = findButton(['More', 'Plus', '...']);
                if (moreBtn) {
                    moreBtn.click();
                    await randomDelay(1000, 2000);
                    const connectInMenu = findButton(['Connect', 'connect']);
                    if (connectInMenu) {
                        connectInMenu.click();
                    } else {
                        return { success: false, error: 'Connect button not found in menu' };
                    }
                } else {
                    return { success: false, error: 'Connect button not found' };
                }
            } else {
                connectBtn.click();
            }

            await randomDelay(1500, 3000);

            // If message template exists, add a note
            if (data.messageTemplate && data.messageTemplate.trim()) {
                const addNoteBtn = findButton(['Add a note', 'Ajouter une note']);
                if (addNoteBtn) {
                    addNoteBtn.click();
                    await randomDelay(1000, 2000);

                    // Find the note textarea
                    const textarea = document.querySelector('textarea[name="message"], textarea#custom-message, textarea.connect-button-send-invite__custom-message');
                    if (textarea) {
                        // Truncate to 300 chars
                        const noteText = data.messageTemplate.substring(0, 300);
                        textarea.focus();
                        textarea.value = noteText;
                        textarea.dispatchEvent(new Event('input', { bubbles: true }));
                        await randomDelay(500, 1000);
                    }
                }
            }

            // Click Send
            await randomDelay(1000, 2000);
            const sendBtn = findButton(['Send', 'Envoyer', 'Send now']);
            if (sendBtn) {
                sendBtn.click();
                await randomDelay(1000, 2000);
                return { success: true };
            } else {
                // Try clicking the main send/connect button in dialog
                const dialogSend = document.querySelector('button[aria-label="Send now"], button[aria-label="Send invitation"]');
                if (dialogSend) {
                    dialogSend.click();
                    await randomDelay(1000, 2000);
                    return { success: true };
                }
                return { success: false, error: 'Send button not found' };
            }
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    // MESSAGE: Open messaging, paste message, send
    async function executeMessage(data) {
        try {
            if (!data.linkedinUrl) {
                return { success: false, error: 'No LinkedIn URL' };
            }

            // Navigate to messaging with this prospect
            const profileSlug = data.linkedinUrl.split('/in/')[1]?.replace(/\/$/, '');
            if (!profileSlug) {
                return { success: false, error: 'Invalid LinkedIn URL' };
            }

            // Navigate to the profile first
            window.location.href = data.linkedinUrl;
            await new Promise(resolve => {
                const checkLoaded = setInterval(() => {
                    if (document.readyState === 'complete') {
                        clearInterval(checkLoaded);
                        resolve();
                    }
                }, 500);
            });
            await randomDelay(2000, 4000);

            // Check for restrictions
            const restriction = checkForRestrictions();
            if (restriction) {
                return { success: false, linkedinRestriction: true, error: `Restriction: ${restriction}` };
            }

            // Find and click the Message button
            const messageBtn = findButton(['Message', 'Envoyer un message']);
            if (!messageBtn) {
                return { success: false, error: 'Message button not found' };
            }

            messageBtn.click();
            await randomDelay(2000, 4000);

            // Find the message input
            const messageInput = document.querySelector(
                'div.msg-form__contenteditable[contenteditable="true"], ' +
                'div[role="textbox"][contenteditable="true"], ' +
                'div.msg-form__msg-content-container div[contenteditable]'
            );

            if (!messageInput) {
                return { success: false, error: 'Message input not found' };
            }

            // Type the message
            messageInput.focus();
            await randomDelay(500, 1000);
            messageInput.innerHTML = `<p>${escapeHtml(data.messageTemplate || '')}</p>`;
            messageInput.dispatchEvent(new Event('input', { bubbles: true }));
            await randomDelay(1000, 2000);

            // Click Send
            const sendBtn = document.querySelector(
                'button.msg-form__send-button, ' +
                'button[type="submit"].msg-form__send-button'
            );

            if (sendBtn && !sendBtn.disabled) {
                sendBtn.click();
                await randomDelay(1000, 2000);
                return { success: true };
            } else {
                return { success: false, error: 'Send button not found or disabled' };
            }
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    // Helper: find a button by text content
    function findButton(textOptions) {
        const buttons = document.querySelectorAll('button, a[role="button"]');
        for (const btn of buttons) {
            const btnText = (btn.textContent || '').trim().toLowerCase();
            for (const option of textOptions) {
                if (btnText === option.toLowerCase() || btnText.includes(option.toLowerCase())) {
                    return btn;
                }
            }
        }
        return null;
    }

    // ── Message handler for popup scan requests ──
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.type === 'SCAN_PROSPECTS') {
            console.log('[Wassel] Popup requested scan...');
            const scanned = [];

            // Strategy 1: data-view-name
            let cards = document.querySelectorAll('[data-view-name="search-entity-result-universal-template"]');
            // Strategy 2: search-results li
            if (cards.length === 0) cards = document.querySelectorAll('.search-results-container ul > li');
            // Strategy 3: reusable-search
            if (cards.length === 0) cards = document.querySelectorAll('.reusable-search__result-container, .entity-result');
            // Strategy 4: li with /in/ links
            if (cards.length === 0) {
                cards = Array.from(document.querySelectorAll('li')).filter(li => li.querySelector('a[href*="/in/"]'));
            }

            // Strategy 5: direct links
            if (cards.length === 0) {
                const profileLinks = document.querySelectorAll('a[href*="/in/"]');
                const seen = new Set();
                profileLinks.forEach(link => {
                    const href = link.href;
                    if (!href || !href.includes('/in/')) return;
                    const cleanUrl = href.split('?')[0];
                    if (seen.has(cleanUrl)) return;
                    seen.add(cleanUrl);
                    const container = link.closest('li') || link.parentElement;
                    const nameEl = container?.querySelector('.entity-result__title-text, [aria-hidden="true"], .artdeco-entity-lockup__title, span[dir="ltr"]');
                    const titleEl = container?.querySelector('.entity-result__primary-subtitle, .artdeco-entity-lockup__subtitle');
                    const companyEl = container?.querySelector('.entity-result__secondary-subtitle');
                    const photoEl = container?.querySelector('img.presence-entity__image, img.EntityPhoto-circle-3, img[class*="profile-photo"], .ivm-image-view-model img, img.ivm-view-attr__img--centered');
                    const name = nameEl?.innerText?.trim() || link.innerText?.trim() || '';
                    if (name && name.length >= 2) {
                        scanned.push({
                            name,
                            linkedin_url: cleanUrl,
                            title: titleEl?.innerText?.trim() || '',
                            company: companyEl?.innerText?.trim() || '',
                            photo_url: photoEl?.src || null,
                        });
                    }
                });
            }

            // Extract from cards (strategies 1-4)
            if (scanned.length === 0 && cards.length > 0) {
                cards.forEach(card => {
                    try {
                        const nameEl = card.querySelector('.entity-result__title-text a span[aria-hidden="true"], .entity-result__title-line a span[dir="ltr"] span[aria-hidden="true"], .app-aware-link span[aria-hidden="true"], .artdeco-entity-lockup__title span, [data-anonymize="person-name"]');
                        const name = nameEl ? nameEl.textContent.trim() : '';
                        const linkEl = card.querySelector('a[href*="/in/"], a.app-aware-link[href*="/in/"]');
                        const linkedinUrl = linkEl ? linkEl.href.split('?')[0] : '';
                        const titleEl = card.querySelector('.entity-result__primary-subtitle, .entity-result__summary, .artdeco-entity-lockup__subtitle');
                        const title = titleEl ? titleEl.textContent.trim() : '';
                        const companyEl = card.querySelector('.entity-result__secondary-subtitle');
                        const company = companyEl ? companyEl.textContent.trim() : '';
                        const photoEl = card.querySelector('img.presence-entity__image, img.EntityPhoto-circle-3, img[class*="profile-photo"], .ivm-image-view-model img, img.ivm-view-attr__img--centered');
                        const photoUrl = photoEl ? photoEl.src : null;
                        if (name && linkedinUrl) {
                            scanned.push({ name, linkedin_url: linkedinUrl, title, company, photo_url: photoUrl });
                        }
                    } catch (e) { /* skip */ }
                });
            }

            console.log('[Wassel] Popup scan found:', scanned.length, 'prospects');
            sendResponse({ prospects: scanned });
            return true; // async
        }
    });
})();

