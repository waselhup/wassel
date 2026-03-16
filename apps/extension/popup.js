// Wassel Extension — Popup (v2 — uses chrome.scripting for reliable scan)
document.addEventListener('DOMContentLoaded', () => {
  // ── Elements ──
  const statusBar  = document.getElementById('status');
  const statusText = document.getElementById('status-text');
  const badge      = document.getElementById('badge');

  const viewLogin     = document.getElementById('view-login');
  const viewConnected = document.getElementById('view-connected');
  const viewScan      = document.getElementById('view-scan');

  const scanResults   = document.getElementById('scan-results');
  const prospectList  = document.getElementById('prospect-list');
  const selCountEl    = document.getElementById('sel-count');
  const importResult  = document.getElementById('import-result');

  // ── State ──
  let prospects = [];
  let selected  = new Set();

  // ── Status helper ──
  function setStatus(type, text) {
    statusBar.className = 'status-bar ' + type;
    const dotColors = { ok:'green', err:'red', warn:'yellow', info:'purple', found:'green' };
    statusBar.querySelector('.dot').className = 'dot ' + (dotColors[type] || 'purple');
    statusText.textContent = text;
  }

  function hideAllViews() {
    viewLogin.classList.add('hidden');
    viewConnected.classList.add('hidden');
    viewScan.classList.add('hidden');
  }

  // ── Views ──
  function showLogin(reason) {
    hideAllViews();
    viewLogin.classList.remove('hidden');
    if (reason === 'no_tab') setStatus('warn', 'Open Wassel dashboard to connect');
    else if (reason === 'no_token') setStatus('warn', 'Please log in to Wassel first');
    else setStatus('err', 'Not connected — ' + (reason || 'unknown'));
  }

  function showConnected() {
    hideAllViews();
    viewConnected.classList.remove('hidden');
    badge.classList.add('hidden');
    setStatus('ok', '✅ Connected to Wassel');
  }

  function showScanView() {
    hideAllViews();
    viewScan.classList.remove('hidden');
    badge.textContent = 'LinkedIn';
    badge.classList.remove('hidden');
    setStatus('ok', '✅ Ready — click Scan Page');
  }

  // ── Token helper ──
  function getToken() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, config => {
        resolve(config?.apiToken || null);
      });
    });
  }

  function syncToken() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'SYNC_TOKEN' }, result => {
        resolve(result);
      });
    });
  }

  // ══════════════════════════════════════════
  //  SCAN — uses chrome.scripting.executeScript
  // ══════════════════════════════════════════

  // This function is serialized and injected into the LinkedIn page
  function extractProspects() {
    const prospects = [];
    const seen = new Set();

    const links = document.querySelectorAll('a[href*="/in/"]');

    links.forEach(link => {
      try {
        const href = link.href || '';
        if (!href.includes('linkedin.com/in/')) return;

        const cleanUrl = href.split('?')[0];
        if (seen.has(cleanUrl)) return;
        const slug = cleanUrl.split('/in/')[1];
        if (!slug || slug.replace(/\//g, '').length < 3) return;
        seen.add(cleanUrl);

        const li = link.closest('li');
        const container = li || link.closest('[class*="result"]') || link.parentElement;
        if (!container) return;

        // Name
        let name = '';
        const nameSelectors = [
          'span[aria-hidden="true"]',
          '[class*="title"] span',
          '[class*="name"]',
          'span.t-16',
          'span.t-bold',
        ];
        for (const sel of nameSelectors) {
          const el = container.querySelector(sel);
          const text = el?.innerText?.trim()?.split('\n')[0]?.trim();
          if (text && text.length > 1 &&
              !text.includes('·') &&
              !text.toLowerCase().includes('connect') &&
              !text.toLowerCase().includes('follow') &&
              !text.toLowerCase().includes('message') &&
              !text.toLowerCase().includes('pending')) {
            name = text;
            break;
          }
        }
        if (!name || name.length < 2) return;

        // Title
        const titleEl = container.querySelector(
          '[class*="primary-subtitle"], [class*="subtitle"]:first-of-type, .entity-result__summary'
        );

        // Company
        const companyEl = container.querySelector('[class*="secondary-subtitle"]');

        // Photo
        const photoEl = container.querySelector('img');
        const photoSrc = photoEl?.src || '';
        const photoUrl = (photoSrc.includes('media') || photoSrc.includes('profile')) ? photoSrc : null;

        prospects.push({
          name: name.substring(0, 100),
          title: (titleEl?.innerText?.trim() || '').substring(0, 150),
          company: (companyEl?.innerText?.trim() || '').substring(0, 100),
          linkedin_url: cleanUrl,
          photo_url: photoUrl,
        });
      } catch (e) { /* skip */ }
    });

    return prospects;
  }

  async function scanPage() {
    const scanBtn = document.getElementById('btn-scan');
    scanBtn.disabled = true;
    scanBtn.innerHTML = '⏳ Scanning...';
    setStatus('info', 'Scanning LinkedIn page...');
    scanResults.classList.add('hidden');
    importResult.classList.add('hidden');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        setStatus('err', 'No active tab found');
        scanBtn.disabled = false;
        scanBtn.innerHTML = '🔍 Scan Page';
        return;
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractProspects,
      });

      const found = results?.[0]?.result || [];
      console.log('[Wassel] Found:', found.length, 'prospects');

      if (found.length === 0) {
        setStatus('warn', 'No prospects found. Scroll down and try again.');
        scanBtn.disabled = false;
        scanBtn.innerHTML = '🔍 Scan Page';
        return;
      }

      prospects = found;
      selected = new Set(prospects.map((_, i) => i));

      setStatus('found', `🎯 Found ${prospects.length} prospects`);
      renderProspects();
      scanResults.classList.remove('hidden');
      updateSelection();

    } catch (err) {
      console.error('[Wassel] Scan error:', err);
      setStatus('err', 'Scan failed. Make sure you are on LinkedIn.');
    }

    scanBtn.disabled = false;
    scanBtn.innerHTML = '🔍 Scan Page';
  }

  // ── Render prospect list ──
  function renderProspects() {
    prospectList.innerHTML = '';
    prospects.forEach((p, i) => {
      const div = document.createElement('div');
      div.className = 'p-item' + (selected.has(i) ? ' sel' : '');
      div.dataset.idx = i;

      const avatarSrc = p.photo_url || 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="16" fill="#1e1b4b"/><text x="16" y="20" text-anchor="middle" fill="#c4b5fd" font-size="14" font-family="sans-serif">' + (p.name?.[0] || '?') + '</text></svg>'
      );

      div.innerHTML = `
        <input type="checkbox" ${selected.has(i) ? 'checked' : ''}>
        <img class="p-avatar" src="${avatarSrc}" onerror="this.style.display='none'">
        <div class="p-info">
          <div class="p-name">${esc(p.name)}</div>
          <div class="p-detail">${esc(p.title)}${p.company ? ' · ' + esc(p.company) : ''}</div>
        </div>
      `;

      div.addEventListener('click', e => {
        if (e.target.tagName === 'INPUT') return;
        toggleSelect(i);
      });
      div.querySelector('input').addEventListener('change', () => toggleSelect(i));

      prospectList.appendChild(div);
    });
  }

  function toggleSelect(i) {
    if (selected.has(i)) selected.delete(i); else selected.add(i);
    updateSelection();
  }

  function updateSelection() {
    selCountEl.textContent = selected.size + ' selected';
    const importBtn = document.getElementById('btn-import');
    importBtn.textContent = `📥 Import Selected (${selected.size})`;
    importBtn.disabled = selected.size === 0;

    document.querySelectorAll('.p-item').forEach(el => {
      const idx = parseInt(el.dataset.idx);
      el.classList.toggle('sel', selected.has(idx));
      el.querySelector('input').checked = selected.has(idx);
    });
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // ── Import ──
  async function importSelected() {
    const items = prospects.filter((_, i) => selected.has(i));
    if (!items.length) return;

    const importBtn = document.getElementById('btn-import');
    importBtn.disabled = true;
    importBtn.innerHTML = '⏳ Importing...';
    importResult.classList.add('hidden');
    setStatus('info', `Importing ${items.length} prospects...`);

    const token = await getToken();
    if (!token) {
      setStatus('err', 'Not connected. Click Refresh Session.');
      importBtn.disabled = false;
      importBtn.innerHTML = `📥 Import Selected (${selected.size})`;
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const res = await fetch('https://wassel-alpha.vercel.app/api/ext/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({
          prospects: items,
          source_url: tab?.url || 'linkedin_search',
        }),
      });

      const data = await res.json();

      if (res.ok) {
        const count = data.imported || data.count || items.length;
        importResult.innerHTML = `<div class="result-box success">✅ ${count} prospects imported successfully!</div>`;
        setStatus('ok', `✅ ${count} imported`);
        downloadCSV(items);
      } else {
        const errMsg = data.error || 'Import failed';
        importResult.innerHTML = `<div class="result-box error">❌ ${errMsg}</div>`;
        setStatus('err', errMsg);
      }
    } catch (e) {
      importResult.innerHTML = `<div class="result-box error">❌ Network error: ${e.message}</div>`;
      setStatus('err', 'Connection error');
    }

    importResult.classList.remove('hidden');
    importBtn.disabled = false;
    importBtn.innerHTML = `📥 Import Selected (${selected.size})`;
  }

  // ── CSV Download ──
  function downloadCSV(items) {
    const headers = ['Name','Title','Company','LinkedIn URL','Imported'];
    const rows = items.map(p => [
      p.name || '',
      p.title || '',
      p.company || '',
      p.linkedin_url || '',
      new Date().toLocaleDateString(),
    ]);
    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({
      url,
      filename: 'wassel-prospects-' + new Date().toISOString().slice(0, 10) + '.csv',
      saveAs: false,
    });
  }

  // ══════════════════════════════════════════
  //  EVENT LISTENERS
  // ══════════════════════════════════════════

  document.getElementById('btn-scan').addEventListener('click', scanPage);
  document.getElementById('btn-rescan').addEventListener('click', scanPage);

  document.getElementById('btn-select-all').addEventListener('click', () => {
    if (selected.size === prospects.length) {
      selected.clear();
    } else {
      prospects.forEach((_, i) => selected.add(i));
    }
    updateSelection();
  });

  document.getElementById('btn-import').addEventListener('click', importSelected);

  document.getElementById('btn-linkedin').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.linkedin.com/search/results/people/' });
  });

  document.getElementById('btn-dashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://wassel-alpha.vercel.app/app' });
  });

  document.getElementById('btn-scan-dash').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://wassel-alpha.vercel.app/app' });
  });

  document.getElementById('btn-open-login').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://wassel-alpha.vercel.app/login' });
  });

  document.getElementById('btn-test').addEventListener('click', () => {
    setStatus('info', 'Testing...');
    const btn = document.getElementById('btn-test');
    btn.disabled = true;
    chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' }, r => {
      btn.disabled = false;
      if (r?.ok) setStatus('ok', '✅ Backend reachable');
      else setStatus('err', 'Failed: ' + (r?.error || 'Unknown'));
    });
  });

  document.getElementById('btn-sync').addEventListener('click', async () => {
    setStatus('info', 'Syncing...');
    const result = await syncToken();
    if (result?.synced) await init();
    else showLogin(result?.reason || 'unknown');
  });

  document.getElementById('btn-resync').addEventListener('click', async () => {
    setStatus('info', 'Refreshing...');
    const result = await syncToken();
    if (result?.synced) await init();
    else showLogin(result?.reason || 'unknown');
  });

  // ══════════════════════════════════════════
  //  INIT — detect URL and show correct view
  // ══════════════════════════════════════════

  async function init() {
    setStatus('info', 'Connecting...');

    const token = await getToken();

    if (!token) {
      const result = await syncToken();
      if (!result?.synced) {
        showLogin(result?.reason || 'no_token');
        return;
      }
    }

    // We have a token — detect if on LinkedIn
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = tab?.url || '';
      const isLinkedIn = url.includes('linkedin.com/search') ||
                         url.includes('linkedin.com/in/') ||
                         url.includes('linkedin.com/mynetwork');

      if (isLinkedIn) {
        showScanView();
      } else {
        showConnected();
      }
    } catch (e) {
      showConnected();
    }
  }

  init();
});
