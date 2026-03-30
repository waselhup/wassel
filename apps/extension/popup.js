// Wassel Extension — Popup v2.0.0
// Shows: connection status, today's action counts, active campaigns
// Does NOT: scan, import, or collect prospects

document.addEventListener('DOMContentLoaded', () => {
  // Version display
  const manifest = chrome.runtime.getManifest();
  document.querySelectorAll('#ext-version, #ext-version-footer').forEach(el => {
    if (el) el.textContent = manifest.version;
  });

  // ── Elements ──
  const statusBar  = document.getElementById('status');
  const statusText = document.getElementById('status-text');
  const viewLogin  = document.getElementById('view-login');
  const viewConnected = document.getElementById('view-connected');

  // ── Status helper ──
  function setStatus(type, text) {
    statusBar.className = 'status-bar ' + type;
    const dotColors = { ok: 'green', err: 'red', warn: 'yellow', info: 'purple' };
    statusBar.querySelector('.dot').className = 'dot ' + (dotColors[type] || 'purple');
    statusText.textContent = text;
  }

  function hideAllViews() {
    viewLogin.classList.add('hidden');
    viewConnected.classList.add('hidden');
  }

  // ── Token helpers ──
  function getToken() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, config => {
        if (config?.apiToken) return resolve(config.apiToken);
        chrome.storage.local.get(
          ['wasselToken', 'authToken', 'token', 'accessToken'],
          stored => resolve(
            stored.wasselToken || stored.authToken || stored.token || stored.accessToken || null
          )
        );
      });
    });
  }

  function syncToken() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'SYNC_TOKEN' }, resolve);
    });
  }

  // ── Show login view ──
  function showLogin(reason) {
    hideAllViews();
    viewLogin.classList.remove('hidden');
    if (reason === 'no_token') setStatus('warn', 'Please log in to Wassel first');
    else if (reason === 'token_expired') setStatus('warn', 'Session expired — please log in again');
    else setStatus('err', 'Not connected — ' + (reason || 'unknown'));
  }

  // ── Show connected view with stats ──
  async function showConnected(token) {
    hideAllViews();
    viewConnected.classList.remove('hidden');
    setStatus('ok', '✅ Connected to Wassel');

    // Load stats and campaigns
    try {
      const [statsRes, campaignsRes] = await Promise.all([
        fetch('https://wassel-alpha.vercel.app/api/ext/daily-stats', {
          headers: { 'Authorization': 'Bearer ' + token },
          signal: AbortSignal.timeout(8000),
        }),
        fetch('https://wassel-alpha.vercel.app/api/ext/campaigns/active', {
          headers: { 'Authorization': 'Bearer ' + token },
          signal: AbortSignal.timeout(8000),
        }),
      ]);

      if (statsRes.ok) {
        const stats = await statsRes.json();
        document.getElementById('stat-visits').textContent   = stats.visits   ?? 0;
        document.getElementById('stat-invites').textContent  = stats.invites  ?? 0;
        document.getElementById('stat-messages').textContent = stats.messages ?? 0;
      } else {
        ['stat-visits', 'stat-invites', 'stat-messages'].forEach(id => {
          document.getElementById(id).textContent = '0';
        });
      }

      if (campaignsRes.ok) {
        const { campaigns = [] } = await campaignsRes.json();
        document.getElementById('stat-campaigns').textContent = campaigns.length;
        renderCampaigns(campaigns);
      } else {
        document.getElementById('stat-campaigns').textContent = '0';
        renderCampaigns([]);
      }
    } catch (e) {
      console.log('[Wassel popup] Stats load error:', e.message);
      ['stat-visits', 'stat-invites', 'stat-messages', 'stat-campaigns'].forEach(id => {
        document.getElementById(id).textContent = '—';
      });
      renderCampaigns([]);
    }
  }

  // ── Render campaign list ──
  function renderCampaigns(campaigns) {
    const list = document.getElementById('campaign-list');
    if (!campaigns.length) {
      list.innerHTML = '<div class="empty-state">No active campaigns</div>';
      return;
    }
    list.innerHTML = campaigns.slice(0, 4).map(c => `
      <div class="campaign-row">
        <span class="campaign-name" title="${esc(c.name)}">${esc(c.name)}</span>
        <span class="campaign-status status-${c.status === 'active' ? 'active' : c.status === 'paused' ? 'paused' : 'done'}">
          ${c.status === 'active' ? '● Running' : c.status === 'paused' ? '⏸ Paused' : 'Done'}
        </span>
      </div>
    `).join('');
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // ══════════════════════════════════════════
  //  EVENT LISTENERS
  // ══════════════════════════════════════════

  document.getElementById('btn-open-dashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://wassel-alpha.vercel.app/app' });
  });

  document.getElementById('btn-sync').addEventListener('click', async () => {
    setStatus('info', '🔄 Syncing...');
    const result = await syncToken();
    if (result?.synced) await init();
    else showLogin(result?.reason || 'no_token');
  });

  document.getElementById('btn-dashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://wassel-alpha.vercel.app/app' });
  });

  document.getElementById('btn-resync').addEventListener('click', async () => {
    const btn = document.getElementById('btn-resync');
    setStatus('info', '🔄 Refreshing...');
    btn.disabled = true;
    btn.textContent = '⏳ Syncing...';

    const result = await syncToken();
    if (result?.synced) {
      btn.textContent = '✅ Connected!';
      await init();
    } else {
      btn.textContent = '❌ Open Dashboard First';
      showLogin(result?.reason || 'no_token');
    }

    setTimeout(() => {
      btn.textContent = '🔄 Refresh Session';
      btn.disabled = false;
    }, 3000);
  });

  // ══════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════
  async function init() {
    setStatus('info', 'Connecting...');

    let token = await getToken();

    if (!token) {
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

    // Quick health check
    try {
      const res = await fetch('https://wassel-alpha.vercel.app/api/health', {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok && res.status === 401) {
        // Token invalid — try resync once
        chrome.storage.local.remove('wasselToken');
        const result = await syncToken();
        if (!result?.synced) {
          showLogin('token_expired');
          return;
        }
        token = await getToken();
        if (!token) {
          showLogin('token_expired');
          return;
        }
      }
    } catch (e) {
      // Timeout — proceed anyway
      console.log('[Wassel popup] Health check timeout:', e.message);
    }

    await showConnected(token);
  }

  init();
});
