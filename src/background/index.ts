import { defaultSettings, getSettings, setSettings } from './settings.js';
import type { Settings } from './settings.js';
import { blinkLinesWithSearchTerm, navigateMatch } from './search.js';

// Track active search requests per tab to ignore stale results
const activeSearchByTab = new Map<number, number>();

let settings: Settings = { ...defaultSettings };

(async function init(): Promise<void> {
  settings = await getSettings();
  console.log('Accessible Find In Page service worker initialized');
})();

// Open onboarding page after fresh install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    const url = chrome.runtime.getURL('dist/onboarding-app/index.html');
    chrome.tabs.create({ url });
  }
});

type RuntimeMessage =
  | { action: 'getSettings' }
  | { action: 'setSettings'; settings: Settings }
  | { action: 'findInPage'; searchTerm: string }
  | { action: 'navigateMatch'; direction: 'next' | 'prev' }
  | { action: 'openShortcuts' };

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse): boolean | void => {
    const { action } = message;
    if (action === 'getSettings') {
      sendResponse(settings);
      return;
    }

    if (action === 'setSettings') {
      const updated = message.settings;
      setSettings(updated).then(() => {
        settings = { ...settings, ...updated };
        sendResponse({ ok: true });
      });
      return true; // async response
    }

    if (action === 'findInPage') {
      const searchTerm = message.searchTerm;
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0] ? tabs[0] : undefined;
        const tabId = tab ? tab.id : undefined;
        if (typeof tabId !== 'number') {
          sendResponse({ ok: false, error: 'No active tab' });
          return;
        }
        const requestId = Math.floor(Date.now() ^ Math.random() * 1e9);
        activeSearchByTab.set(tabId, requestId);
        blinkLinesWithSearchTerm(searchTerm, tabId, settings).then((result) => {
          const latestId = activeSearchByTab.get(tabId);
          if (latestId !== requestId) {
            // A newer request superseded this one; return a cancelled response
            sendResponse({ ok: false, cancelled: true });
            return;
          }
          sendResponse({ ok: true, ...result });
        });
      });
      return true; // async response
    }

    if (action === 'navigateMatch') {
      const direction = message.direction;
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0] ? tabs[0] : undefined;
        const tabId = tab ? tab.id : undefined;
        if (typeof tabId !== 'number') {
          sendResponse({ ok: false, error: 'No active tab' });
          return;
        }
        navigateMatch(tabId, direction).then((result) => {
          sendResponse({ ok: true, ...result });
        });
      });
      return true; // async response
    }

    if (action === 'openShortcuts') {
      try {
        chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }, () => {
          const err = chrome.runtime.lastError;
          if (err) {
            sendResponse({ ok: false, error: err.message });
          } else {
            sendResponse({ ok: true });
          }
        });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
      return true; // async response
    }
  }
);

  // Open popup via keyboard shortcut command
  chrome.commands.onCommand.addListener(async (command) => {
    if (command !== 'open_popup') return;
    try {
      // If supported, open the extension's action popup directly
      const actionAny = chrome.action as unknown as { openPopup?: () => Promise<void> };
      if (actionAny && typeof actionAny.openPopup === 'function') {
        await actionAny.openPopup!();
        return;
      }
    } catch (e) {
      // fall through to window popup
    }
    const url = chrome.runtime.getURL('dist/popup-app/index.html');
    chrome.windows.create({ url, type: 'popup', width: 300, height: 240, focused: true });
  });
