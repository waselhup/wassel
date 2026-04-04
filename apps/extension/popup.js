// Wassel Extension — Popup v3.0.0
// Shows: engine status, execution stats, last action, cookie health
// Communicates with background.js via chrome.runtime.sendMessage

document.addEventListener('DOMContentLoaded', () => {
  // Version
  const ver = chrome.runtime.getManifest().version;
  document.querySelectorAll('#ext-ver, #ext-ver-f').forEach(el => el.textContent = ver);

  // Elements
  const engineBanner = document.getElementById('engine-banner');
  const engineText = document.getElementById('engine-text');
  const engineSub = document.getElementById('engine-sub');
  const viewLogin = document.getElementById('view-login');
  const viewMain = document.getElementById('view-main');

  // ── Helpers ──
  function hideAll() {
    viewLogin.classList.add('hidden');
    viewMain.classList.add('hidden');
  }

  function setEngine(state, text, sub) {
    engineBanner.className = 'engine-banner ' + state;
    const dot = engineBanner.querySelector('.engine-dot');
    dot.className = 'engine-dot' + (state === 'running' ? ' pulse' : '');
    engineText.textContent = text;
    engineSub.textContent = sub || '';
  }

  function timeAgo(iso) {
    if (!iso) return '';
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return diff + 's ago';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // ── Get token ──
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

  // ── Get automation status from background ──
  function getAutomationStatus() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'GET_AUTOMATION_STATUS' }, res => {
        resolve(res || null);
      });
    });
  }

  // ── Check LinkedIn cookie ──
  function checkCookie() {
    return new Promise(resolve => {
      chrome.cookies.getAll({ domain: '.linkedin.com' }, cookies => {
        const liAt = cookies?.find(c => c.name === 'li_at');
        resolve({
          hasLiAt: !!liAt,
          expiresAt: liAt ? new Date(liAt.expirationDate * 1000) : null,
        });
      });
    });
  }

  // ── Show login view ──
  function showLogin(reason) {
    hideAll();
    viewLogin.classList.remove('hidden');
    if (reason === 'token_expired') {
      setEngine('error', 'Session Expired', 'Log in to Wassel dashboard to reconnect');
    } else {
      setEngine('offline', 'Not Connected', 'Open Wassel dashboard to activate');
    }
  }

  // ── Show main view ──
  async function showMain() {
    hideAll();
    viewMain.classList.remove('hidden');

    // Get automation status from background
    const status = await getAutomationStatus();
    const stats = status?.stats || {};

    // Engine status
    if (stats.consecutiveErrors >= 5) {
      setEngine('error', 'Paused — Too Many Errors', 'Will auto-retry in 10 minutes');
    } else if (status?.isProcessing) {
      setEngine('running', 'Executing Action...', 'Processing LinkedIn action now');
    } else if (stats.actionsToday > 0) {
      setEngine('running', 'Engine Running', `${stats.actionsToday} actions completed today`);
    } else {
      setEngine('idle', 'Engine Ready', 'Polling every 60s for pending actions');
    }

    // Stats
    document.getElementById('s-actions').textContent = stats.actionsToday || 0;
    document.getElementById('s-errors').textContent = stats.errors || 0;
    // Streak = consecutive successful (actionsToday - consecutiveErrors when > 0)
    const streak = stats.consecutiveErrors === 0 ? stats.actionsToday || 0 : 0;
    document.getElementById('s-streak').textContent = streak;

    // Last action
    const la = stats.lastAction;
    const laBody = document.getElementById('la-body');
    const laTime = document.getElementById('la-time');
    if (la) {
      const icon = la.success ? '✅' : '❌';
      const typeLabel = { visit: 'Visited', connect: 'Invited', message: 'Messaged', follow: 'Followed' }[la.type] || la.type;
      laBody.innerHTML = `${icon} <span class="type">${esc(typeLabel)}</span> <span class="name">${esc(la.prospect)}</span>`;
      laTime.textContent = timeAgo(la.time);
    } else {
      laBody.innerHTML = '<div class="la-empty">No actions yet — waiting for campaign</div>';
      laTime.textContent = '';
    }

    // Cookie status
    const cookie = await checkCookie();
    const cookieBar = document.getElementById('cookie-bar');
    const cookieText = document.getElementById('cookie-text');
    if (cookie.hasLiAt) {
      const daysLeft = cookie.expiresAt
        ? Math.max(0, Math.floor((cookie.expiresAt - Date.now()) / 86400000))
        : '?';
      cookieBar.className = 'cookie-bar valid';
      cookieText.textContent = `LinkedIn session active (${daysLeft} days remaining)`;
    } else {
      cookieBar.className = 'cookie-bar invalid';
      cookieText.textContent = 'No LinkedIn session — log in to linkedin.com';
    }
  }

  // ══════════════════════════════════════════
  //  EVENT LISTENERS
  // ══════════════════════════════════════════

  // Login view buttons
  document.getElementById('btn-open-dash').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://wassel-alpha.vercel.app/app' });
  });

  document.getElementById('btn-sync-login').addEventListener('click', async () => {
    setEngine('idle', 'Syncing...', '');
    const result = await syncToken();
    if (result?.synced) {
      await init();
    } else {
      showLogin(result?.reason || 'no_token');
    }
  });

  // Main view buttons
  document.getElementById('btn-dashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://wassel-alpha.vercel.app/app' });
  });

  document.getElementById('btn-force-exec').addEventListener('click', async () => {
    const btn = document.getElementById('btn-force-exec');
    btn.disabled = true;
    btn.textContent = '⏳ Executing...';
    setEngine('running', 'Executing...', 'Running next pending action');

    const result = await new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'FORCE_POLL' }, resolve);
    });

    if (result?.ok) {
      btn.textContent = '✅ Done!';
    } else {
      btn.textContent = '— No action available';
    }

    // Refresh stats after execution
    setTimeout(async () => {
      btn.textContent = '▶ Execute Next Action Now';
      btn.disabled = false;
      await showMain();
    }, 2000);
  });

  document.getElementById('btn-refresh-cookie').addEventListener('click', async () => {
    const btn = document.getElementById('btn-refresh-cookie');
    btn.disabled = true;
    btn.textContent = '⏳ Refreshing...';

    const result = await new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'EXTRACT_COOKIES' }, resolve);
    });

    if (result?.success) {
      btn.textContent = '✅ Cookie saved!';
    } else {
      btn.textContent = '❌ ' + (result?.reason || 'Failed');
    }

    // Refresh cookie display
    setTimeout(async () => {
      btn.textContent = 'Refresh Cookie';
      btn.disabled = false;
      await showMain();
    }, 2500);
  });

  // ══════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════
  async function init() {
    setEngine('idle', 'Connecting...', '');

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

    await showMain();
  }

  init();

  // Auto-refresh every 30s while popup is open
  setInterval(async () => {
    const token = await getToken();
    if (token) {
      const status = await getAutomationStatus();
      if (status) {
        const stats = status.stats || {};
        document.getElementById('s-actions').textContent = stats.actionsToday || 0;
        document.getElementById('s-errors').textContent = stats.errors || 0;

        // Update last action
        const la = stats.lastAction;
        if (la) {
          const icon = la.success ? '✅' : '❌';
          const typeLabel = { visit: 'Visited', connect: 'Invited', message: 'Messaged', follow: 'Followed' }[la.type] || la.type;
          document.getElementById('la-body').innerHTML = `${icon} <span class="type">${esc(typeLabel)}</span> <span class="name">${esc(la.prospect)}</span>`;
          document.getElementById('la-time').textContent = timeAgo(la.time);
        }
      }
    }
  }, 30000);
});
