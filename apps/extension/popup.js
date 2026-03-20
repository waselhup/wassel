// Wassel Extension — Popup (v3 — multi-page collection + auth fix)
document.addEventListener('DOMContentLoaded', () => {
  // Show current version in popup footer
  const manifest = chrome.runtime.getManifest();
  const versionEl = document.getElementById('ext-version');
  if (versionEl) versionEl.textContent = manifest.version;

  // ── Elements ──
  const statusBar  = document.getElementById('status');
  const statusText = document.getElementById('status-text');
  const badge      = document.getElementById('badge');

  const viewLogin     = document.getElementById('view-login');
  const viewConnected = document.getElementById('view-connected');
  const viewScan      = document.getElementById('view-scan');
  const viewCollecting = document.getElementById('view-collecting');

  const scanResults   = document.getElementById('scan-results');
  const prospectList  = document.getElementById('prospect-list');
  const selCountEl    = document.getElementById('sel-count');
  const importResult  = document.getElementById('import-result');

  // ── State ──
  let prospects = [];
  let selected  = new Set();
  let targetCount = 50;
  let isCollecting = false;

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
    viewCollecting.classList.add('hidden');
    scanResults.classList.add('hidden');
    importResult.classList.add('hidden');
    badge.textContent = 'LinkedIn';
    badge.classList.remove('hidden');
    setStatus('ok', '✅ Ready — select quantity & collect');
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
  //  QUANTITY SELECTOR
  // ══════════════════════════════════════════
  document.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.qty-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      targetCount = parseInt(btn.dataset.count);
    });
  });

  // ══════════════════════════════════════════
  //  MULTI-PAGE COLLECTION
  // ══════════════════════════════════════════
  function updateProgress(collected, target, page) {
    const pct = Math.min(100, Math.round((collected / target) * 100));
    document.getElementById('progress-count').textContent = `${collected} / ${target}`;
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('progress-status').textContent = collected >= target ? '✅ Complete!' : 'Scanning...';
    document.getElementById('progress-pages').textContent = `Page ${page}`;
  }

  document.getElementById('btn-start-collect').addEventListener('click', async () => {
    if (isCollecting) return;
    isCollecting = true;

    // Show progress UI
    document.getElementById('btn-start-collect').classList.add('hidden');
    document.querySelector('.qty-section').classList.add('hidden');
    viewCollecting.classList.remove('hidden');
    scanResults.classList.add('hidden');
    importResult.classList.add('hidden');
    updateProgress(0, targetCount, 1);
    setStatus('info', `Collecting ${targetCount} prospects...`);

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Send to background for multi-page collection
    chrome.runtime.sendMessage({
      type: 'START_COLLECTION',
      targetCount,
      tabId: tab.id
    });
  });

  // Stop collecting
  document.getElementById('btn-stop').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'STOP_COLLECTION' });
    isCollecting = false;
    setStatus('warn', 'Collection stopped');
  });

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'PROGRESS_UPDATE') {
      updateProgress(msg.collected, msg.target, msg.page);
    }
    if (msg.type === 'COLLECTION_COMPLETE') {
      isCollecting = false;
      prospects = msg.prospects || [];
      selected = new Set(prospects.map((_, i) => i));

      // Reset UI
      viewCollecting.classList.add('hidden');
      document.getElementById('btn-start-collect').classList.remove('hidden');
      document.querySelector('.qty-section').classList.remove('hidden');

      if (prospects.length === 0) {
        setStatus('warn', 'No prospects found. Scroll down and try again.');
        return;
      }

      setStatus('found', `🎯 Found ${prospects.length} prospects`);
      renderProspects();
      scanResults.classList.remove('hidden');
      updateSelection();
    }
  });

  // ══════════════════════════════════════════
  //  SCAN — single page fallback (extractProspects injected by background)
  // ══════════════════════════════════════════
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

        let name = '';
        const nameSelectors = ['span[aria-hidden="true"]', '[class*="title"] span', '[class*="name"]', 'span.t-16', 'span.t-bold'];
        for (const sel of nameSelectors) {
          const el = container.querySelector(sel);
          const text = el?.innerText?.trim()?.split('\n')[0]?.trim();
          if (text && text.length > 1 && !text.includes('·') && !text.toLowerCase().includes('connect') && !text.toLowerCase().includes('follow') && !text.toLowerCase().includes('message') && !text.toLowerCase().includes('pending')) {
            name = text;
            break;
          }
        }
        if (!name || name.length < 2) return;

        const titleEl = container.querySelector('[class*="primary-subtitle"], [class*="subtitle"]:first-of-type, .entity-result__summary');
        const companyEl = container.querySelector('[class*="secondary-subtitle"]');
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

      // Import in chunks of 50 to avoid timeouts
      const chunkSize = 50;
      let totalImported = 0;

      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        setStatus('info', `Importing batch ${Math.floor(i/chunkSize)+1}... (${i}/${items.length})`);

        const res = await fetch('https://wassel-alpha.vercel.app/api/ext/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
          },
          body: JSON.stringify({
            prospects: chunk,
            source_url: tab?.url || 'linkedin_search',
          }),
        });

        const data = await res.json();
        if (res.ok) {
          totalImported += data.imported || data.count || chunk.length;
        }
      }

      importResult.innerHTML = `<div class="result-box success">✅ ${totalImported} prospects imported successfully!</div>`;
      setStatus('ok', `✅ ${totalImported} imported`);
      downloadCSV(items);

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
      p.name || '', p.title || '', p.company || '', p.linkedin_url || '', new Date().toLocaleDateString(),
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
  document.getElementById('btn-select-all').addEventListener('click', () => {
    if (selected.size === prospects.length) { selected.clear(); } else { prospects.forEach((_, i) => selected.add(i)); }
    updateSelection();
  });

  document.getElementById('btn-import').addEventListener('click', importSelected);

  document.getElementById('btn-linkedin').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.linkedin.com/search/results/people/' });
  });

  document.getElementById('btn-dashboard').addEventListener('click', () => {
    const loadingMsg = document.getElementById('loading-msg');
    chrome.tabs.create({ url: 'https://wassel-alpha.vercel.app/app' }, (tab) => {
      const timeout = setTimeout(() => {
        if (loadingMsg) {
          loadingMsg.innerHTML = 'Taking too long? <a href="https://wassel-alpha.vercel.app/app" target="_blank" style="color:#a855f7;text-decoration:underline;">Open dashboard directly →</a>';
          loadingMsg.style.display = 'block';
        }
      }, 8000);
      chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          clearTimeout(timeout);
          chrome.tabs.onUpdated.removeListener(listener);
          if (loadingMsg) loadingMsg.style.display = 'none';
        }
      });
    });
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
    setStatus('info', '🔄 Syncing...');
    const result = await syncToken();
    if (result?.synced) await init();
    else showLogin(result?.reason || 'unknown');
  });

  document.getElementById('btn-resync').addEventListener('click', async () => {
    setStatus('info', '🔄 Refreshing...');
    const btn = document.getElementById('btn-resync');
    btn.disabled = true;
    btn.textContent = '⏳ Syncing...';

    const result = await syncToken();
    if (result?.synced) {
      btn.textContent = '✅ Connected!';
      btn.style.background = 'rgba(34,197,94,.15)';
      btn.style.color = '#86efac';
      await init();
    } else {
      btn.textContent = '❌ Open Dashboard First';
      btn.style.background = 'rgba(239,68,68,.15)';
      btn.style.color = '#fca5a5';
      showLogin(result?.reason || 'unknown');
    }
    setTimeout(() => {
      btn.textContent = '🔄 Refresh Session';
      btn.style.background = '';
      btn.style.color = '';
      btn.disabled = false;
    }, 3000);
  });

  document.getElementById('btn-rescan').addEventListener('click', () => {
    scanResults.classList.add('hidden');
    importResult.classList.add('hidden');
    prospects = [];
    selected.clear();
    showScanView();
  });

  // ══════════════════════════════════════════
  //  INIT — detect URL and show correct view
  // ══════════════════════════════════════════
  async function init() {
    setStatus('info', 'Connecting...');

    let token = await getToken();

    if (!token) {
      // Try to sync from dashboard
      const result = await syncToken();
      if (!result?.synced) {
        showLogin(result?.reason || 'no_token');
        return;
      }
      token = await getToken();
      if (!token) {
        showLogin('no_token');
        return;
      }
    }

    // Validate token is actually valid (quick check)
    try {
      const testRes = await fetch('https://wassel-alpha.vercel.app/api/health', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });

      if (testRes.status === 401) {
        // Token invalid — try resync once
        console.log('[Wassel popup] Token invalid, resyncing...');
        await new Promise(resolve => {
          chrome.storage.local.remove('wasselToken', resolve);
        });
        const result = await syncToken();
        if (!result?.synced) {
          showLogin('token_expired');
          return;
        }
      }
    } catch (e) {
      // Health check timeout — proceed anyway (server might be slow)
      console.log('[Wassel popup] Health check timeout, proceeding:', e.message);
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
