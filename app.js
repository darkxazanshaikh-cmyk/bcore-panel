// ==================== CONFIG ====================
let CONFIG = {
    ghUser: '',
    ghRepo: '',
    ghBranch: 'main',
    ghToken: '',
    fileName: 'keys.json'
};

let keysData = {
    server_mode: 'online',
    keys: [],
    settings: {
        default_expiry_days: 30,
        max_devices_per_key: 1
    }
};

let currentPage = 1;
const perPage = 10;

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    if (CONFIG.ghUser && CONFIG.ghToken) {
        document.getElementById('setupCard').style.display = 'none';
        showPanels();
        loadKeys();
    }
});

// ==================== CONFIG MANAGEMENT ====================
function saveConfig() {
    CONFIG.ghUser = document.getElementById('ghUser').value.trim();
    CONFIG.ghRepo = document.getElementById('ghRepo').value.trim();
    CONFIG.ghBranch = document.getElementById('ghBranch').value.trim() || 'main';
    CONFIG.ghToken = document.getElementById('ghToken').value.trim();

    if (!CONFIG.ghUser || !CONFIG.ghRepo || !CONFIG.ghToken) {
        showToast('Please fill all fields', 'error');
        return;
    }

    localStorage.setItem('hcore_config', JSON.stringify(CONFIG));
    showToast('Config saved!');
    document.getElementById('setupCard').style.display = 'none';
    showPanels();
    loadKeys();
}

function loadConfig() {
    const saved = localStorage.getItem('hcore_config');
    if (saved) {
        CONFIG = JSON.parse(saved);
        document.getElementById('ghUser').value = CONFIG.ghUser;
        document.getElementById('ghRepo').value = CONFIG.ghRepo;
        document.getElementById('ghBranch').value = CONFIG.ghBranch;
        document.getElementById('ghToken').value = CONFIG.ghToken;
    }
}

function testConnection() {
    CONFIG.ghUser = document.getElementById('ghUser').value.trim();
    CONFIG.ghRepo = document.getElementById('ghRepo').value.trim();
    CONFIG.ghToken = document.getElementById('ghToken').value.trim();

    if (!CONFIG.ghUser || !CONFIG.ghRepo || !CONFIG.ghToken) {
        showToast('Please fill all fields', 'error');
        return;
    }

    const url = `https://api.github.com/repos/${CONFIG.ghUser}/${CONFIG.ghRepo}`;
    fetch(url, {
        headers: { 'Authorization': `token ${CONFIG.ghToken}` }
    })
    .then(r => {
        if (r.ok) {
            showToast('Connection successful!');
        } else {
            showToast('Connection failed. Check credentials.', 'error');
        }
    })
    .catch(e => showToast('Network error: ' + e.message, 'error'));
}

function showPanels() {
    document.getElementById('statsRow').style.display = 'grid';
    document.getElementById('createCard').style.display = 'block';
    document.getElementById('serverCard').style.display = 'block';
    document.getElementById('tableCard').style.display = 'block';
}

// ==================== GITHUB API ====================
function getApiUrl() {
    return `https://api.github.com/repos/${CONFIG.ghUser}/${CONFIG.ghRepo}/contents/${CONFIG.fileName}`;
}

function getRawUrl() {
    return `https://raw.githubusercontent.com/${CONFIG.ghUser}/${CONFIG.ghRepo}/${CONFIG.ghBranch}/${CONFIG.fileName}`;
}

function getHeaders() {
    return {
        'Authorization': `token ${CONFIG.ghToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
    };
}

async function loadKeys() {
    try {
        const resp = await fetch(getApiUrl(), { headers: getHeaders() });
        if (resp.status === 404) {
            // File doesn't exist, create it
            await createKeysFile();
            return;
        }
        if (!resp.ok) throw new Error('Failed to load keys');

        const data = await resp.json();
        const content = JSON.parse(atob(data.content));
        keysData = content;
        keysData._sha = data.sha;

        updateStats();
        updateServerMode();
        renderTable();
    } catch (e) {
        showToast('Error loading keys: ' + e.message, 'error');
    }
}

async function saveKeys() {
    try {
        const resp = await fetch(getApiUrl(), { headers: getHeaders() });
        let sha = '';

        if (resp.ok) {
            const data = await resp.json();
            sha = data.sha;
        }

        const content = JSON.stringify(keysData, null, 2);
        const encoded = btoa(unescape(encodeURIComponent(content)));

        const body = {
            message: `Update keys - ${new Date().toISOString()}`,
            content: encoded,
            branch: CONFIG.ghBranch
        };

        if (sha) body.sha = sha;

        const saveResp = await fetch(getApiUrl(), {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(body)
        });

        if (!saveResp.ok) {
            const err = await saveResp.json();
            throw new Error(err.message || 'Failed to save');
        }

        const result = await saveResp.json();
        keysData._sha = result.content.sha;

        showToast('Saved successfully!');
    } catch (e) {
        showToast('Error saving: ' + e.message, 'error');
    }
}

async function createKeysFile() {
    try {
        const content = JSON.stringify(keysData, null, 2);
        const encoded = btoa(unescape(encodeURIComponent(content)));

        const body = {
            message: `Initialize keys.json - ${new Date().toISOString()}`,
            content: encoded,
            branch: CONFIG.ghBranch
        };

        const resp = await fetch(getApiUrl(), {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(body)
        });

        if (!resp.ok) throw new Error('Failed to create file');

        const result = await resp.json();
        keysData._sha = result.content.sha;

        showToast('keys.json created!');
        updateStats();
        renderTable();
    } catch (e) {
        showToast('Error creating file: ' + e.message, 'error');
    }
}

// ==================== KEY MANAGEMENT ====================
function generateKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segments = [];
    for (let s = 0; s < 4; s++) {
        let seg = '';
        for (let i = 0; i < 4; i++) {
            seg += chars[Math.floor(Math.random() * chars.length)];
        }
        segments.push(seg);
    }
    document.getElementById('newKey').value = 'HCORE-' + segments.join('-');
}

function createKey() {
    let key = document.getElementById('newKey').value.trim();
    const expiry = document.getElementById('newExpiry').value;
    const maxDevices = parseInt(document.getElementById('newMaxDevices').value) || 1;
    const feature1 = document.getElementById('newFeature1').checked ? 1 : 0;
    const feature2 = document.getElementById('newFeature2').checked ? 1 : 0;

    if (!key) {
        generateKey();
        key = document.getElementById('newKey').value;
    }

    // Check duplicate
    if (keysData.keys.find(k => k.key === key)) {
        showToast('Key already exists!', 'error');
        return;
    }

    const expiryStr = expiry ? new Date(expiry).toISOString().replace('T', ' ').slice(0, 19) : '';

    keysData.keys.push({
        key: key,
        expiry: expiryStr,
        feature1: feature1,
        feature2: feature2,
        disabled: 0,
        max_devices: maxDevices,
        devices: [],
        created_at: new Date().toISOString().slice(0, 10)
    });

    saveKeys();
    updateStats();
    renderTable();

    // Clear form
    document.getElementById('newKey').value = '';
    document.getElementById('newExpiry').value = '';
    document.getElementById('newMaxDevices').value = '1';
    document.getElementById('newFeature1').checked = true;
    document.getElementById('newFeature2').checked = true;

    showToast('Key created!');
}

function deleteKey(index) {
    if (!confirm('Delete this key?')) return;
    keysData.keys.splice(index, 1);
    saveKeys();
    updateStats();
    renderTable();
    showToast('Key deleted!');
}

function deleteSelected() {
    const checkboxes = document.querySelectorAll('.row-check:checked');
    if (checkboxes.length === 0) {
        showToast('No keys selected', 'warning');
        return;
    }
    if (!confirm(`Delete ${checkboxes.length} keys?`)) return;

    const indices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index)).sort((b, a) => a - b);
    indices.forEach(i => keysData.keys.splice(i, 1));

    saveKeys();
    updateStats();
    renderTable();
    showToast(`${indices.length} keys deleted!`);
}

function editKey(index) {
    const k = keysData.keys[index];
    document.getElementById('editKeyIndex').value = index;
    document.getElementById('editKey').value = k.key;

    if (k.expiry) {
        const d = new Date(k.expiry.replace(' ', 'T'));
        document.getElementById('editExpiry').value = d.toISOString().slice(0, 16);
    } else {
        document.getElementById('editExpiry').value = '';
    }

    document.getElementById('editMaxDevices').value = k.max_devices || 1;
    document.getElementById('editFeature1').checked = k.feature1 === 1;
    document.getElementById('editFeature2').checked = k.feature2 === 1;
    document.getElementById('editDisabled').checked = k.disabled === 1;

    document.getElementById('editModal').classList.add('show');
}

function closeModal() {
    document.getElementById('editModal').classList.remove('show');
}

function saveEdit() {
    const index = parseInt(document.getElementById('editKeyIndex').value);
    const expiry = document.getElementById('editExpiry').value;
    const maxDevices = parseInt(document.getElementById('editMaxDevices').value) || 1;

    keysData.keys[index].expiry = expiry ? new Date(expiry).toISOString().replace('T', ' ').slice(0, 19) : '';
    keysData.keys[index].max_devices = maxDevices;
    keysData.keys[index].feature1 = document.getElementById('editFeature1').checked ? 1 : 0;
    keysData.keys[index].feature2 = document.getElementById('editFeature2').checked ? 1 : 0;
    keysData.keys[index].disabled = document.getElementById('editDisabled').checked ? 1 : 0;

    saveKeys();
    updateStats();
    renderTable();
    closeModal();
    showToast('Key updated!');
}

function toggleSelectAll() {
    const checked = document.getElementById('selectAll').checked;
    document.querySelectorAll('.row-check').forEach(cb => cb.checked = checked);
}

// ==================== SERVER MODE ====================
function setServerMode(mode) {
    keysData.server_mode = mode;
    saveKeys();
    updateServerMode();
    showToast(`Server mode: ${mode}`);
}

function updateServerMode() {
    const mode = keysData.server_mode || 'online';
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    const dot = document.querySelector('.status-dot');
    const text = document.getElementById('statusText');
    dot.className = 'status-dot ' + mode;
    text.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
}

// ==================== UI RENDERING ====================
function updateStats() {
    const now = new Date();
    let total = keysData.keys.length;
    let active = 0, expired = 0, disabled = 0;

    keysData.keys.forEach(k => {
        if (k.disabled === 1) {
            disabled++;
        } else if (k.expiry && new Date(k.expiry) < now) {
            expired++;
        } else {
            active++;
        }
    });

    document.getElementById('totalKeys').textContent = total;
    document.getElementById('activeKeys').textContent = active;
    document.getElementById('expiredKeys').textContent = expired;
    document.getElementById('disabledKeys').textContent = disabled;
}

function renderTable() {
    const tbody = document.getElementById('keysBody');
    const search = document.getElementById('searchInput').value.toLowerCase();
    const now = new Date();

    let filtered = keysData.keys.filter(k =>
        k.key.toLowerCase().includes(search)
    );

    const totalPages = Math.ceil(filtered.length / perPage);
    if (currentPage > totalPages) currentPage = 1;

    const start = (currentPage - 1) * perPage;
    const pageItems = filtered.slice(start, start + perPage);

    tbody.innerHTML = '';

    if (pageItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:#8b949e;">No keys found</td></tr>`;
        renderPagination(0);
        return;
    }

    pageItems.forEach((k, i) => {
        const realIndex = keysData.keys.indexOf(k);
        const isExpired = k.expiry && new Date(k.expiry) < now;
        const isDisabled = k.disabled === 1;

        let statusBadge;
        if (isDisabled) {
            statusBadge = '<span class="badge badge-disabled">Disabled</span>';
        } else if (isExpired) {
            statusBadge = '<span class="badge badge-expired">Expired</span>';
        } else {
            statusBadge = '<span class="badge badge-active">Active</span>';
        }

        const expiryClass = isExpired ? 'expired' : '';
        const expiryText = k.expiry || 'No expiry';

        const devicesCount = (k.devices || []).length;
        const maxDev = k.max_devices || 1;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" class="row-check" data-index="${realIndex}"></td>
            <td><span class="key-text">${k.key}</span></td>
            <td><span class="expiry-text ${expiryClass}">${expiryText}</span></td>
            <td>${k.feature1 === 1 ? '&#9989;' : '&#10060;'}</td>
            <td>${k.feature2 === 1 ? '&#9989;' : '&#10060;'}</td>
            <td><span class="badge badge-devices">${devicesCount}/${maxDev}</span></td>
            <td>${statusBadge}</td>
            <td>
                <button class="action-btn edit" onclick="editKey(${realIndex})">Edit</button>
                <button class="action-btn delete" onclick="deleteKey(${realIndex})">Del</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    const div = document.getElementById('pagination');
    if (totalPages <= 1) {
        div.innerHTML = '';
        return;
    }

    let html = '';
    if (currentPage > 1) {
        html += `<button onclick="goToPage(${currentPage - 1})">Prev</button>`;
    }

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += `<button class="${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += `<button disabled>...</button>`;
        }
    }

    if (currentPage < totalPages) {
        html += `<button onclick="goToPage(${currentPage + 1})">Next</button>`;
    }

    div.innerHTML = html;
}

function goToPage(page) {
    currentPage = page;
    renderTable();
}

function filterKeys() {
    currentPage = 1;
    renderTable();
}

// ==================== UTILITIES ====================
function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast ' + type;
    toast.style.display = 'block';

    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}
