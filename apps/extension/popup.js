// Wassel Extension — Popup Script
document.addEventListener('DOMContentLoaded', async () => {
    const statusBox = document.getElementById('status-box');
    const statusText = document.getElementById('status-text');
    const configSection = document.getElementById('config-section');
    const connectedSection = document.getElementById('connected-section');
    const apiTokenInput = document.getElementById('api-token');
    const clientIdInput = document.getElementById('client-id');
    const saveBtn = document.getElementById('save-btn');
    const testBtn = document.getElementById('test-btn');
    const openLinkedinBtn = document.getElementById('open-linkedin-btn');
    const dashboardBtn = document.getElementById('dashboard-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');

    function setStatus(type, text) {
        statusBox.className = `status ${type}`;
        statusBox.querySelector('.dot').className = `dot ${type === 'ok' ? 'green' : type === 'err' ? 'red' : 'yellow'}`;
        statusText.textContent = text;
    }

    // Check existing config
    chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, (config) => {
        if (config && config.apiToken) {
            configSection.classList.add('hidden');
            connectedSection.classList.remove('hidden');
            setStatus('ok', 'Connected to Wassel');
        } else {
            configSection.classList.remove('hidden');
            connectedSection.classList.add('hidden');
            setStatus('pending', 'Not configured — enter your API token below');
        }
    });

    // Save config
    saveBtn.addEventListener('click', () => {
        const apiToken = apiTokenInput.value.trim();
        if (!apiToken) {
            setStatus('err', 'API token is required');
            return;
        }

        const config = {
            apiToken,
            clientId: clientIdInput.value.trim(),
        };

        chrome.runtime.sendMessage({ type: 'SET_CONFIG', config }, (response) => {
            if (response && response.ok) {
                configSection.classList.add('hidden');
                connectedSection.classList.remove('hidden');
                setStatus('ok', 'Connected to Wassel');
            }
        });
    });

    // Test connection
    testBtn.addEventListener('click', () => {
        setStatus('pending', 'Testing connection...');
        testBtn.disabled = true;
        chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' }, (response) => {
            testBtn.disabled = false;
            if (response && response.ok) {
                setStatus('ok', 'Backend reachable ✓');
            } else {
                setStatus('err', 'Connection failed: ' + (response?.error || 'Unknown error'));
            }
        });
    });

    // Open LinkedIn
    openLinkedinBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://www.linkedin.com/search/results/people/' });
    });

    // Open Dashboard
    dashboardBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://wassel-alpha.vercel.app/dashboard' });
    });

    // Disconnect
    disconnectBtn.addEventListener('click', () => {
        chrome.storage.local.clear(() => {
            configSection.classList.remove('hidden');
            connectedSection.classList.add('hidden');
            apiTokenInput.value = '';
            clientIdInput.value = '';
            setStatus('pending', 'Disconnected — enter token to reconnect');
        });
    });
});
