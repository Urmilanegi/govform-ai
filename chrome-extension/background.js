// GovForm AI — Background Service Worker

const WINDOW_CONTEXT_PREFIX = 'govform-context=';

function encodePortalContext(payload) {
  return `${WINDOW_CONTEXT_PREFIX}${btoa(encodeURIComponent(JSON.stringify(payload)))}`;
}

function withPortalContext(targetUrl, payload) {
  const url = new URL(targetUrl);
  url.hash = encodePortalContext(payload);
  return url.toString();
}

function buildFlowPayload(message) {
  const payload = {};

  if (message.profile !== undefined) payload.govform_profile = message.profile;
  if (message.portal !== undefined) payload.govform_portal = message.portal;
  if (message.credentials !== undefined) payload.govform_credentials = message.credentials;
  if (message.filledForm !== undefined) payload.govform_filled_form = message.filledForm;
  if (message.autoActive !== undefined) payload.govform_auto_active = Boolean(message.autoActive);

  payload.govform_saved_at = Date.now();
  return payload;
}

function setFlowContext(message, callback) {
  chrome.storage.local.set(buildFlowPayload(message), () => {
    callback?.({ success: true });
  });
}

function injectContextIntoTab(tabId, message) {
  let attempts = 0;

  const tryHydrate = () => {
    attempts += 1;

    chrome.tabs.sendMessage(tabId, {
      type: 'HYDRATE_CONTEXT',
      profile: message.profile || null,
      portal: message.portal || null,
      credentials: message.credentials || null,
      filledForm: message.filledForm || null,
      autoActive: message.autoActive !== false,
    }, (response) => {
      if (response?.success || attempts >= 8) {
        return;
      }

      setTimeout(tryHydrate, 600);
    });
  };

  setTimeout(tryHydrate, 900);
}

async function fetchLatestBrowserContext() {
  const response = await fetch('http://localhost:3000/api/browser-context');
  if (!response.ok) {
    throw new Error(`Browser context fetch failed: ${response.status}`);
  }

  return response.json();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SAVE_PROFILE' || message.type === 'SAVE_AUTOMATION_CONTEXT') {
    setFlowContext(message, sendResponse);
    return true;
  }

  if (message.type === 'GET_PROFILE') {
    chrome.storage.local.get(
      [
        'govform_profile',
        'govform_saved_at',
        'govform_portal',
        'govform_credentials',
        'govform_auto_active',
        'govform_last_fill',
      ],
      (data) => {
        sendResponse({
          profile: data.govform_profile || null,
          savedAt: data.govform_saved_at || null,
          portal: data.govform_portal || null,
          credentials: data.govform_credentials || null,
          autoActive: Boolean(data.govform_auto_active),
          lastFill: data.govform_last_fill || null,
        });
      }
    );
    return true;
  }

  if (message.type === 'FETCH_BROWSER_CONTEXT') {
    fetchLatestBrowserContext()
      .then((data) => sendResponse(data))
      .catch((error) => sendResponse({ success: false, error: String(error) }));
    return true;
  }

  if (message.type === 'OPEN_PORTAL_FLOW') {
    const targetUrl = message.portal?.loginUrl || message.portal?.registerUrl || message.portal?.applyUrl;

    if (!targetUrl) {
      sendResponse({ success: false, error: 'No portal URL found.' });
      return true;
    }

    setFlowContext(message, () => {
      const contextualUrl = withPortalContext(targetUrl, {
        profile: message.profile || null,
        portal: message.portal || null,
        credentials: message.credentials || null,
        filledForm: message.filledForm || null,
        autoActive: message.autoActive !== false,
      });

      chrome.tabs.create({ url: contextualUrl, active: true }, (tab) => {
        if (tab?.id) {
          injectContextIntoTab(tab.id, message);
        }

        sendResponse({
          success: true,
          url: contextualUrl,
          tabId: tab?.id || null,
        });
      });
    });
    return true;
  }

  if (message.type === 'FILL_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'DO_FILL', profile: message.profile }, sendResponse);
      } else {
        sendResponse({ filled: 0, error: 'No active tab.' });
      }
    });
    return true;
  }

  if (message.type === 'FILL_RESULT') {
    chrome.storage.local.set({ govform_last_fill: message.result }, () => {
      sendResponse?.({ success: true });
    });
    return true;
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.govform_profile || changes.govform_auto_active) {
    const hasProfile = changes.govform_profile
      ? Boolean(changes.govform_profile.newValue)
      : true;
    const autoActive = changes.govform_auto_active?.newValue;

    if (!hasProfile && autoActive !== true) {
      chrome.action.setBadgeText({ text: '' });
      return;
    }

    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
  }
});
