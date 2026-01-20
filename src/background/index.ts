import { defaultSettings, getSettings, setSettings, getProfilesState, setActiveProfile, createProfile, renameProfile, deleteProfile } from './settings.js';
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
  | { action: 'getProfiles' }
  | { action: 'setActiveProfile'; profileId: string }
  | { action: 'createProfile'; name?: string; baseSettings?: Settings }
  | { action: 'renameProfile'; profileId: string; name: string }
  | { action: 'deleteProfile'; profileId: string }
  | { action: 'findInPage'; searchTerm: string }
  | { action: 'navigateMatch'; direction: 'next' | 'prev' }
  | { action: 'openShortcuts' }
  | { action: 'resetSettings' };

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

    if (action === 'getProfiles') {
      getProfilesState().then((state) => {
        // Keep local active settings in sync
        const active = state.profiles.find((p) => p.id === state.activeProfileId) || state.profiles[0];
        settings = active.settings;
        sendResponse({ ok: true, state });
      });
      return true;
    }

    if (action === 'setActiveProfile') {
      const profileId = (message as any).profileId as string;
      setActiveProfile(profileId).then((state) => {
        const active = state.profiles.find((p) => p.id === state.activeProfileId) || state.profiles[0];
        settings = active.settings;
        sendResponse({ ok: true, state });
      });
      return true;
    }

    if (action === 'createProfile') {
      const name = (message as any).name as string | undefined;
      const base = (message as any).baseSettings as Settings | undefined;
      createProfile(name ?? 'New Profile', base).then((state) => {
        const active = state.profiles.find((p) => p.id === state.activeProfileId) || state.profiles[0];
        settings = active.settings;
        sendResponse({ ok: true, state });
      });
      return true;
    }

    if (action === 'renameProfile') {
      const { profileId, name } = message as any;
      renameProfile(profileId, name).then((state) => {
        const active = state.profiles.find((p) => p.id === state.activeProfileId) || state.profiles[0];
        settings = active.settings;
        sendResponse({ ok: true, state });
      });
      return true;
    }

    if (action === 'deleteProfile') {
      const { profileId } = message as any;
      deleteProfile(profileId).then((state) => {
        const active = state.profiles.find((p) => p.id === state.activeProfileId) || state.profiles[0];
        settings = active.settings;
        sendResponse({ ok: true, state });
      });
      return true;
    }

    if (action === 'resetSettings') {
      setSettings(defaultSettings).then(() => {
        settings = { ...defaultSettings };
        sendResponse({ ok: true, settings });
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

    if ((message as any).action === 'closeOverlay') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs && tabs[0] && typeof tabs[0].id === 'number' ? tabs[0].id! : undefined;
        if (typeof tabId !== 'number') {
          sendResponse({ ok: false, error: 'No active tab' });
          return;
        }
        // Remove iframe overlay if present, then clear highlights
        chrome.scripting.executeScript({
          target: { tabId },
          func: function removeReactOverlay(): void {
            const id = 'accessible-find-react-overlay';
            // Remove the global message handler first, if present
            try {
              const handler = (window as any).__af_onMessage as ((e: MessageEvent) => void) | undefined;
              if (handler) {
                window.removeEventListener('message', handler);
                (window as any).__af_onMessage = undefined;
              }
              const onResize = (window as any).__af_onResize as (() => void) | undefined;
              if (onResize) {
                window.removeEventListener('resize', onResize);
                (window as any).__af_onResize = undefined;
              }
            } catch {}
            // Remove any keydown handler
            try {
              const kbd = (window as any).__af_kbd as ((e: KeyboardEvent) => void) | undefined;
              if (kbd) {
                window.removeEventListener('keydown', kbd, true);
                (window as any).__af_kbd = undefined;
              }
            } catch {}
            const existing = document.getElementById(id);
            if (existing) existing.remove();
          },
          args: [],
        }, () => {
          blinkLinesWithSearchTerm('', tabId, settings).then(() => {
            sendResponse({ ok: true });
          });
        });
      });
      return true;
    }
  }
);

// Inject the React popup-app as an iframe overlay inside the active page
function injectReactOverlay(width: number, height: number): void {
  const id = 'accessible-find-react-overlay';
  const existing = document.getElementById(id) as HTMLDivElement | null;
  if (existing) {
    const root = existing.shadowRoot as ShadowRoot | null;
    const iframe = root?.querySelector('iframe') as HTMLIFrameElement | null;
    try {
      iframe?.focus();
      iframe?.contentWindow?.postMessage({ type: 'focusInput' }, '*');
    } catch {}
    return;
  }
  const container = document.createElement('div');
  container.id = id;
  container.style.position = 'fixed';
  container.style.top = '8px';
  container.style.right = '8px';
  container.style.zIndex = '2147483647';
  const root = container.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    .overlay { display: flex; }
    iframe { border: 0; background: transparent; }
  `;
  root.appendChild(style);
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('dist/popup-app/index.html');
  // Prevent the iframe from stealing page shortcuts unintentionally
  iframe.setAttribute('title', 'Accessible Find In Page');
  overlay.appendChild(iframe);
  root.appendChild(overlay);
  const getViewportLimit = () => {
    const inner = Math.max(window.innerWidth - 16, 0);
    if (!Number.isFinite(inner) || inner <= 0) return Math.min(900, width);
    return Math.min(inner, 900);
  };
  const getViewportHeightLimit = () => {
    const inner = Math.max(window.innerHeight - 16, 0);
    if (!Number.isFinite(inner) || inner <= 0) return undefined;
    return inner;
  };
  let lastRequestedWidth = width;
  let lastRequestedHeight = height;
  const applySize = (nextWidth: number | undefined, nextHeight: number | undefined) => {
    if (typeof nextWidth === 'number' && !Number.isNaN(nextWidth)) {
      lastRequestedWidth = nextWidth;
    }
    if (typeof nextHeight === 'number' && !Number.isNaN(nextHeight)) {
      lastRequestedHeight = nextHeight;
    }
    const viewportLimit = getViewportLimit();
    const viewportHeightLimit = getViewportHeightLimit();
    const fallbackWidth = viewportLimit > 0 ? viewportLimit : Math.min(900, width);
    const desiredWidth = Math.max(320, typeof nextWidth === 'number' && !Number.isNaN(nextWidth) ? nextWidth : Math.max(lastRequestedWidth, fallbackWidth));
    const resolvedWidth = viewportLimit > 0 ? Math.min(desiredWidth, viewportLimit) : desiredWidth;
    iframe.style.width = resolvedWidth + 'px';
    const desiredHeight = typeof nextHeight === 'number' && !Number.isNaN(nextHeight)
      ? nextHeight
      : lastRequestedHeight;
    const resolvedHeight = typeof viewportHeightLimit === 'number'
      ? Math.min(desiredHeight, viewportHeightLimit)
      : desiredHeight;
    iframe.style.height = resolvedHeight + 'px';
  };
  // Ensure input focus when the iframe finishes loading
  iframe.addEventListener('load', () => {
    try { iframe.contentWindow?.postMessage({ type: 'focusInput' }, '*'); } catch {}
  });
  // Install page-level hotkeys so ESC and Ctrl+F work even when page is focused
  const kbdHandler = (e: any) => {
    try {
      const isCtrlF = (e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F');
      if (e.key === 'Escape') {
        e.preventDefault();
        try { iframe.contentWindow?.postMessage({ type: 'requestClose' }, '*'); } catch {}
      } else if (isCtrlF) {
        e.preventDefault();
        try { iframe.contentWindow?.postMessage({ type: 'focusInput' }, '*'); } catch {}
      }
    } catch {}
  };
  window.addEventListener('keydown', kbdHandler, true);
  (window as any).__af_kbd = kbdHandler;
  // Listen for size messages from the React app and adjust iframe
  const onMessage = (e: MessageEvent) => {
    try {
      if (e.source === iframe.contentWindow && e.data && (e.data as any).type === 'accessible-find:size') {
        const d = e.data as { type: string; width?: number; height?: number };
        applySize(d.width, d.height);
      }
    } catch {}
  };
  window.addEventListener('message', onMessage);
  // Expose handler for cleanup on closeOverlay
  (window as any).__af_onMessage = onMessage;
  applySize(width, height);
  const onResize = () => applySize(lastRequestedWidth, lastRequestedHeight);
  window.addEventListener('resize', onResize);
  (window as any).__af_onResize = onResize;
  document.documentElement.appendChild(container);
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'open_popup') return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs && tabs[0] && typeof tabs[0].id === 'number' ? tabs[0].id! : undefined;
    if (typeof tabId !== 'number') return;
    chrome.scripting.executeScript({ target: { tabId }, func: injectReactOverlay, args: [340, 240] });
  });
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs && tabs[0] && typeof tabs[0].id === 'number' ? tabs[0].id! : undefined;
    if (typeof tabId !== 'number') return;
    chrome.scripting.executeScript({ target: { tabId }, func: injectReactOverlay, args: [340, 240] });
  });
});
// No in-page overlay remains; popup UI handles all interactions
