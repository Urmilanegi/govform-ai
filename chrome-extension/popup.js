// GovForm AI — Popup Logic

const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const mainContent = document.getElementById('mainContent');

chrome.storage.local.get(
  ['govform_profile', 'govform_saved_at', 'govform_portal', 'govform_last_fill', 'govform_auto_active'],
  (data) => {
    const profile = data.govform_profile || null;
    const portal = data.govform_portal || null;
    const lastFill = data.govform_last_fill || null;
    const savedAt = data.govform_saved_at || null;
    const autoActive = Boolean(data.govform_auto_active);

    if (profile) {
      statusDot.className = 'status-dot active';
      statusText.textContent = autoActive
        ? `Auto mode active ✓ · Saved ${timeAgo(savedAt)}`
        : `Profile ready ✓ · Saved ${timeAgo(savedAt)}`;
      renderProfile(profile, portal, lastFill);
    } else {
      statusDot.className = 'status-dot empty';
      statusText.textContent = 'Profile nahi mili — GovForm AI pe jaao';
      renderEmpty();
    }
  }
);

function renderProfile(profile, portal, lastFill) {
  const rows = [
    { label: 'Name', value: profile.fullName },
    { label: 'Father', value: profile.fatherName },
    { label: 'DOB', value: profile.dateOfBirth },
    { label: 'Category', value: profile.category },
    { label: 'Mobile', value: profile.mobileNumber },
    { label: 'Email', value: profile.email },
    { label: 'State', value: profile.state },
    { label: 'Aadhaar', value: profile.aadhaarNumber },
    { label: '10th Board', value: profile.class10Board },
    { label: 'Graduation', value: profile.graduationUniversity },
    { label: 'Bank', value: profile.bankName },
  ].filter((row) => row.value);

  const portalCard = portal ? `
    <div class="profile-card">
      <div class="profile-header">${portal.icon || '🌐'} Active Portal</div>
      <div class="profile-row">
        <span class="profile-label">Portal</span>
        <span class="profile-value">${portal.name}</span>
      </div>
      <div class="profile-row">
        <span class="profile-label">Login URL</span>
        <span class="profile-value">${safeHost(portal.loginUrl || portal.applyUrl)}</span>
      </div>
      <div class="profile-row">
        <span class="profile-label">Flow</span>
        <span class="profile-value">${(portal.steps || []).slice(0, 4).join(' -> ') || 'Auto-fill ready'}</span>
      </div>
    </div>
  ` : '';

  const lastFillCard = lastFill ? `
    <div class="site-info">
      ⚡ Last auto-fill: <span>${lastFill.filled || 0} fields</span>
      ${lastFill.previewDetected ? '<br/>✅ Preview page reached' : ''}
      ${lastFill.url ? `<br/>🌐 ${safeHost(lastFill.url)}` : ''}
    </div>
  ` : '';

  mainContent.innerHTML = `
    <div class="profile-card">
      <div class="profile-header">👤 Stored Profile</div>
      ${rows.map((row) => `
        <div class="profile-row">
          <span class="profile-label">${row.label}</span>
          <span class="profile-value">${row.value}</span>
        </div>
      `).join('')}
    </div>

    ${portalCard}
    ${lastFillCard}

    <div class="site-info" id="siteInfo">
      🌐 Current site: <span id="currentSite">checking...</span>
    </div>

    <div class="fill-result" id="fillResult"></div>

    <button class="btn btn-primary" id="fillBtn" disabled>
      ⚡ Auto Fill This Page
    </button>
    ${portal ? `
      <button class="btn btn-secondary" id="openPortalBtn">
        🚀 Open ${portal.shortName || 'Portal'} Flow
      </button>
    ` : ''}
    <button class="btn btn-secondary" id="openGovformBtn">
      🔗 Open GovForm AI
    </button>
    <button class="btn btn-danger" id="clearBtn">
      🗑 Clear Profile
    </button>
  `;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.url) return;

    const url = new URL(tab.url);
    const host = url.hostname;
    const isGovSite = host.includes('.gov.in') || host.includes('.nic.in') || host.includes('.ibps.in') || host === 'localhost' || host === '127.0.0.1';
    const siteEl = document.getElementById('currentSite');
    const fillBtn = document.getElementById('fillBtn');

    if (siteEl) siteEl.textContent = host;

    if (isGovSite) {
      fillBtn.disabled = false;
      fillBtn.textContent = `⚡ Auto Fill — ${host}`;
    } else {
      fillBtn.disabled = true;
      fillBtn.textContent = '⚡ Auto Fill (Govt site pe jaao)';
    }
  });

  document.getElementById('fillBtn').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) return;

      chrome.tabs.sendMessage(tabId, { type: 'DO_FILL', profile }, (result) => {
        const el = document.getElementById('fillResult');
        el.style.display = 'block';

        if (result?.filled > 0) {
          el.className = 'fill-result success';
          el.innerHTML = `✅ ${result.filled} fields auto-filled! Green border wale fields dekho.`;
        } else {
          el.className = 'fill-result error';
          el.innerHTML = '⚠️ Koi field match nahi hua. Is form ka structure alag hai.';
        }
      });
    });
  });

  if (portal) {
    document.getElementById('openPortalBtn').addEventListener('click', () => {
      chrome.runtime.sendMessage({
        type: 'OPEN_PORTAL_FLOW',
        profile,
        portal,
        autoActive: true,
      }, (response) => {
        const el = document.getElementById('fillResult');
        el.style.display = 'block';
        if (response?.success) {
          el.className = 'fill-result success';
          el.innerHTML = `🚀 ${portal.name} open ho gaya. Login ke baad pages auto-fill hongi.`;
        } else {
          el.className = 'fill-result error';
          el.innerHTML = '⚠️ Portal open nahi ho paya.';
        }
      });
    });
  }

  document.getElementById('openGovformBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3000' });
  });

  document.getElementById('clearBtn').addEventListener('click', () => {
    if (!confirm('Profile clear karein?')) return;

    chrome.storage.local.remove([
      'govform_profile',
      'govform_saved_at',
      'govform_portal',
      'govform_credentials',
      'govform_filled_form',
      'govform_last_fill',
      'govform_auto_active',
    ], () => {
      window.location.reload();
    });
  });
}

function renderEmpty() {
  mainContent.innerHTML = `
    <div class="empty-state">
      <div class="icon">📋</div>
      <h3>Profile nahi mili!</h3>
      <p>Pehle GovForm AI pe documents upload karo. AI data extract karega aur extension mein save ho jaayega.</p>
    </div>

    <div class="steps">
      <div class="steps-title">🚀 Kaise use karein:</div>
      <div class="step"><div class="step-num">1</div><span>GovForm AI website pe jaao (localhost:3000)</span></div>
      <div class="step"><div class="step-num">2</div><span>Documents upload karo — Aadhaar, Marksheet</span></div>
      <div class="step"><div class="step-num">3</div><span>Exam aur post select karo</span></div>
      <div class="step"><div class="step-num">4</div><span>Review page se official portal flow start karo</span></div>
      <div class="step"><div class="step-num">5</div><span>Govt portal pe login ke baad extension auto-fill karegi ⚡</span></div>
    </div>

    <button class="btn btn-primary" id="openGovformBtn">
      🔗 GovForm AI Open Karo
    </button>
  `;

  document.getElementById('openGovformBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3000' });
  });
}

function safeHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url || 'unknown';
  }
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}
