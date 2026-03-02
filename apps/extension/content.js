// Wassel Extension — Content Script
// Injected on LinkedIn search result pages
// Adds a floating "Import to Wassel" sidebar

(function () {
    'use strict';

    // Prevent double injection
    if (document.getElementById('wassel-sidebar-root')) return;

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
          Click "Scan Page" to find prospects on this page.
        </div>
        <div class="wassel-actions">
          <button id="wassel-scan" class="wassel-btn wassel-btn-primary">🔍 Scan Page</button>
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

    // Scan page for prospects
    scanBtn.addEventListener('click', () => {
        statusEl.textContent = 'Scanning...';
        statusEl.className = 'wassel-status wassel-status-info';
        allProspects = [];
        selectedProspects = [];

        // Find LinkedIn search result cards
        const resultCards = document.querySelectorAll('.reusable-search__result-container, .entity-result');

        resultCards.forEach((card, i) => {
            try {
                // Name
                const nameEl = card.querySelector('.entity-result__title-text a span[aria-hidden="true"], .entity-result__title-line a span[dir="ltr"] span[aria-hidden="true"], .app-aware-link span[aria-hidden="true"]');
                const name = nameEl ? nameEl.textContent.trim() : '';

                // Profile URL
                const linkEl = card.querySelector('a.app-aware-link[href*="/in/"]');
                const linkedinUrl = linkEl ? linkEl.href.split('?')[0] : '';

                // Title / headline
                const titleEl = card.querySelector('.entity-result__primary-subtitle, .entity-result__summary');
                const title = titleEl ? titleEl.textContent.trim() : '';

                // Company  
                const companyEl = card.querySelector('.entity-result__secondary-subtitle');
                const company = companyEl ? companyEl.textContent.trim() : '';

                // Location
                const locationEl = card.querySelector('.entity-result__simple-insight, .entity-result__content-summary');
                const location = locationEl ? locationEl.textContent.trim() : '';

                if (name && linkedinUrl) {
                    allProspects.push({
                        id: i,
                        name,
                        linkedin_url: linkedinUrl,
                        title,
                        company,
                        location,
                        selected: true,
                    });
                }
            } catch (e) {
                console.warn('[Wassel] Failed to parse card:', e);
            }
        });

        if (allProspects.length === 0) {
            statusEl.textContent = 'No prospects found on this page. Try a LinkedIn People search.';
            statusEl.className = 'wassel-status wassel-status-warn';
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
                showResult('error', 'Not authenticated. Open the extension popup and enter your API token.');
                importing = false;
                updateImportBtn();
                return;
            }

            chrome.runtime.sendMessage({
                type: 'IMPORT_PROSPECTS',
                clientId: config.clientId || '',
                campaignId: null,
                sourceUrl: window.location.href,
                prospects: selectedProspects.map(p => ({
                    linkedin_url: p.linkedin_url,
                    name: p.name,
                    title: p.title,
                    company: p.company,
                    location: p.location,
                })),
            }, (response) => {
                importing = false;
                if (response && response.success) {
                    showResult('success', `✅ ${response.imported} prospects imported successfully!`);
                    // Mark imported prospects
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
})();
