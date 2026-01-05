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
        // Remove the overlay and clear highlights
        chrome.scripting.executeScript({
          target: { tabId },
          func: removeOverlayInPage,
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

  // Open or focus the in-page overlay via keyboard shortcut
  chrome.commands.onCommand.addListener(async (command) => {
    if (command !== 'open_popup') return;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs && tabs[0] && typeof tabs[0].id === 'number' ? tabs[0].id! : undefined;
      if (typeof tabId !== 'number') return;
      chrome.scripting.executeScript({
        target: { tabId },
        func: injectOrFocusOverlay,
        args: [300, 240],
      });
    });
  });

  // Clicking the action icon opens or focuses the in-page overlay
  chrome.action.onClicked.addListener(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs && tabs[0] && typeof tabs[0].id === 'number' ? tabs[0].id! : undefined;
      if (typeof tabId !== 'number') return;
      chrome.scripting.executeScript({
        target: { tabId },
        func: injectOrFocusOverlay,
        args: [300, 240],
      });
    });
  });

// Inject or focus the overlay iframe in the page context
function injectOrFocusOverlay(width: number, height: number): void {
  const id = 'accessible-find-overlay';
  const existing = document.getElementById(id) as HTMLDivElement | null;
  if (!existing) {
    const container = document.createElement('div');
    container.id = id;
    container.style.position = 'fixed';
    container.style.top = '8px';
    container.style.right = '8px';
    container.style.zIndex = '2147483647';
    container.style.pointerEvents = 'auto';
    const root = container.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      .panel {
        font-family: system-ui, sans-serif;
        width: ${width}px;
        background: #0f172a; /* slate-900 */
        color: #e5e7eb; /* gray-200 */
        border: 1px solid #334155; /* slate-700 */
        border-radius: 6px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.45);
        display: flex;
        flex-direction: column;
        padding: 8px;
        gap: 8px;
        box-sizing: border-box;
      }
      .row { display: flex; align-items: center; gap: 8px; min-width: 0; }
      input {
        flex: 1;
        min-width: 0;
        background: #0b1220;
        color: #e5e7eb;
        border: 1px solid #334155;
        border-radius: 4px;
        padding: 6px 8px;
        font-size: 12px;
      }
      input::placeholder { color: #94a3b8; }
      button {
        border: 1px solid #374151; /* slate-700 */
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 12px;
        background: #1f2937; /* slate-800 */
        color: #e5e7eb;
        cursor: pointer;
      }
      button:hover { background: #273449; border-color: #4b5563; }
      button:disabled { opacity: 0.45; cursor: not-allowed; }
      .count { font-size: 12px; color: #cbd5e1; min-width: 40px; text-align: right; }
      .spacer { flex: 1; }
      .settings {
        display: none;
        border-top: 1px solid #334155;
        padding-top: 8px;
        overflow: hidden;
      }
      .settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .settings label { font-size: 12px; color: #e5e7eb; align-self: center; }
      .settings input[type="number"], .settings input[type="color"] {
        background: #0b1220;
        color: #e5e7eb;
        border: 1px solid #334155;
        border-radius: 4px;
        padding: 4px 6px;
        font-size: 12px;
      }
      .settings-actions { display: flex; justify-content: flex-end; gap: 8px; grid-column: 1 / -1; }
    `;
    root.appendChild(style);

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="row">
        <button id="af-settings" title="Settings">⚙️</button>
        <input id="af-input" placeholder="Find in Page" />
        <span class="count" id="af-count">0/0</span>
        <button id="af-prev" title="Previous">▲</button>
        <button id="af-next" title="Next">▼</button>
        <button id="af-close" title="Close">✖</button>
      </div>
      <div id="af-settings-panel" class="settings">
        <div class="settings-grid">
          <label>Interval (ms)</label>
          <input id="af-s-interval" type="number" min="50" step="50" />
          <label># Blinks</label>
          <input id="af-s-blinks" type="number" min="1" />
          <label>Surrounding words</label>
          <input id="af-s-surround" type="number" min="0" />
          <label>Highlight background</label>
          <input id="af-s-hbg" type="color" />
          <label>Highlight text</label>
          <input id="af-s-htx" type="color" />
          <label>Border color</label>
          <input id="af-s-ocolor" type="color" />
          <label>Border width (px)</label>
          <input id="af-s-owidth" type="number" min="1" />
          <label>Match font size (px)</label>
          <input id="af-s-mfont" type="number" min="8" />
          <div class="settings-actions">
            <button id="af-s-close">Done</button>
            <button id="af-s-save">Save</button>
          </div>
        </div>
      </div>
    `;
    root.appendChild(panel);
    document.body.appendChild(container);

    const input = root.getElementById('af-input') as HTMLInputElement | null;
    const settingsBtn = root.getElementById('af-settings') as HTMLButtonElement | null;
    const settingsPanel = root.getElementById('af-settings-panel') as HTMLDivElement | null;
    const sInterval = root.getElementById('af-s-interval') as HTMLInputElement | null;
    const sBlinks = root.getElementById('af-s-blinks') as HTMLInputElement | null;
    const sSurround = root.getElementById('af-s-surround') as HTMLInputElement | null;
    const sHbg = root.getElementById('af-s-hbg') as HTMLInputElement | null;
    const sHtx = root.getElementById('af-s-htx') as HTMLInputElement | null;
    const sOColor = root.getElementById('af-s-ocolor') as HTMLInputElement | null;
    const sOWidth = root.getElementById('af-s-owidth') as HTMLInputElement | null;
    const sMFont = root.getElementById('af-s-mfont') as HTMLInputElement | null;
    const sClose = root.getElementById('af-s-close') as HTMLButtonElement | null;
    const sSave = root.getElementById('af-s-save') as HTMLButtonElement | null;
    const countEl = root.getElementById('af-count') as HTMLSpanElement | null;
    const prevBtn = root.getElementById('af-prev') as HTMLButtonElement | null;
    const nextBtn = root.getElementById('af-next') as HTMLButtonElement | null;
    const closeBtn = root.getElementById('af-close') as HTMLButtonElement | null;

    const updateCount = (currentIndex: number | null, count: number) => {
      if (!countEl) return;
      countEl.textContent = (currentIndex !== null && count > 0)
        ? `${currentIndex + 1}/${count}`
        : `${count}/${count}`;
    };

    const handleInput = () => {
      const term = input?.value ?? '';
      try {
        chrome.runtime.sendMessage({ action: 'findInPage', searchTerm: term }, (response: any) => {
          const count = response?.count ?? 0;
          const idx = (typeof response?.currentIndex === 'number') ? response.currentIndex : null;
          updateCount(idx, count);
          if (prevBtn) prevBtn.disabled = count === 0;
          if (nextBtn) nextBtn.disabled = count === 0;
        });
      } catch {}
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      try {
        chrome.runtime.sendMessage({ action: 'navigateMatch', direction: e.shiftKey ? 'prev' : 'next' }, (response: any) => {
          const count = response?.count ?? 0;
          const idx = (typeof response?.currentIndex === 'number') ? response.currentIndex : null;
          updateCount(idx, count);
        });
      } catch {}
    };
    const handlePrevClick = () => {
      try {
        chrome.runtime.sendMessage({ action: 'navigateMatch', direction: 'prev' }, (response: any) => {
          const count = response?.count ?? 0;
          const idx = (typeof response?.currentIndex === 'number') ? response.currentIndex : null;
          updateCount(idx, count);
        });
      } catch {}
    };
    const handleNextClick = () => {
      try {
        chrome.runtime.sendMessage({ action: 'navigateMatch', direction: 'next' }, (response: any) => {
          const count = response?.count ?? 0;
          const idx = (typeof response?.currentIndex === 'number') ? response.currentIndex : null;
          updateCount(idx, count);
        });
      } catch {}
    };
    input?.addEventListener('input', handleInput);
    input?.addEventListener('keydown', handleKeyDown);
    prevBtn?.addEventListener('click', handlePrevClick);
    nextBtn?.addEventListener('click', handleNextClick);

    const populateSettings = (st: any) => {
      if (!st) return;
      if (sInterval) sInterval.value = String(st.blinkInterval ?? 400);
      if (sBlinks) sBlinks.value = String(st.numBlinks ?? 2);
      if (sSurround) sSurround.value = String(st.numSurroundingWords ?? 1);
      if (sHbg) sHbg.value = String(st.highlightBgColor ?? '#ffff00');
      if (sHtx) sHtx.value = String(st.highlightTextColor ?? '#000000');
      if (sOColor) sOColor.value = String(st.outlineColor ?? '#ff8c00');
      if (sOWidth) sOWidth.value = String(st.outlineWidth ?? 3);
      if (sMFont) sMFont.value = String(st.matchFontSize ?? 20);
    };

    const animateShow = (el: HTMLElement) => {
      el.style.display = 'block';
      const grid = el.querySelector('.settings-grid') as HTMLElement | null;
      const targetHeight = grid ? (grid.scrollHeight + 8) : el.scrollHeight;
      el.animate([
        { opacity: 0, transform: 'translateY(-6px)', height: '0px' },
        { opacity: 1, transform: 'translateY(0)', height: targetHeight + 'px' }
      ], { duration: 250, easing: 'ease-out' }).onfinish = () => {
        el.style.height = 'auto';
        el.style.opacity = '1';
        el.style.transform = 'none';
      };
    };
    const animateHide = (el: HTMLElement) => {
      const currentHeight = el.offsetHeight;
      el.animate([
        { opacity: 1, transform: 'translateY(0)', height: currentHeight + 'px' },
        { opacity: 0, transform: 'translateY(-6px)', height: '0px' }
      ], { duration: 200, easing: 'ease-in' }).onfinish = () => {
        el.style.display = 'none';
        el.style.height = '0px';
        el.style.opacity = '0';
        el.style.transform = 'none';
      };
    };

    const handleSettingsClick = () => {
      if (!settingsPanel) return;
      const visible = getComputedStyle(settingsPanel).display !== 'none';
      if (visible) {
        animateHide(settingsPanel);
        return;
      }
      try {
        chrome.runtime.sendMessage({ action: 'getSettings' }, (st: any) => {
          populateSettings(st);
          animateShow(settingsPanel);
        });
      } catch {
        animateShow(settingsPanel);
      }
    };
    const handleSettingsClose = () => {
      if (settingsPanel) animateHide(settingsPanel);
    };
    settingsBtn?.addEventListener('click', handleSettingsClick);
    sClose?.addEventListener('click', handleSettingsClose);

    const handleSettingsSave = () => {
            const toNum = (el: HTMLInputElement | null, def: number) => {
              const v = el?.value ?? String(def);
              const n = Number(v);
              return Number.isFinite(n) ? n : def;
            };
            const st = {
              blinkInterval: toNum(sInterval, 400),
              numBlinks: toNum(sBlinks, 2),
              numSurroundingWords: toNum(sSurround, 1),
              highlightBgColor: sHbg?.value ?? '#ffff00',
              highlightTextColor: sHtx?.value ?? '#000000',
              outlineColor: sOColor?.value ?? '#ff8c00',
              outlineWidth: toNum(sOWidth, 3),
              matchFontSize: toNum(sMFont, 20),
            };
            try {
              chrome.runtime.sendMessage({ action: 'setSettings', settings: st }, () => {
                if (settingsPanel) animateHide(settingsPanel);
                const term = input?.value ?? '';
                if (term.trim().length > 0) {
                  chrome.runtime.sendMessage({ action: 'findInPage', searchTerm: term }, (response: any) => {
                    const count = response?.count ?? 0;
                    const idx = (typeof response?.currentIndex === 'number') ? response.currentIndex : null;
                    updateCount(idx, count);
                    prevBtn && (prevBtn.disabled = count === 0);
                    nextBtn && (nextBtn.disabled = count === 0);
                  });
                }
              });
            } catch {
              if (settingsPanel) animateHide(settingsPanel);
            }
          };
    sSave?.addEventListener('click', handleSettingsSave);
    const closeOverlay = () => {
      const id = 'accessible-find-overlay';
      const existing = document.getElementById(id);
      const cleanupEsc = () => {
        const escHandler = (window as any).__accessibleFindEscHandler as ((e: KeyboardEvent) => void) | undefined;
        if (escHandler) {
          window.removeEventListener('keydown', escHandler, true);
          (window as any).__accessibleFindEscHandler = undefined;
        }
      };
      try {
        chrome.runtime.sendMessage({ action: 'findInPage', searchTerm: '' }, () => {
          if (existing) existing.remove();
          cleanupEsc();
        });
      } catch {
        if (existing) existing.remove();
        cleanupEsc();
      }
    };
    const handleCloseClick = () => closeOverlay();
    closeBtn?.addEventListener('click', handleCloseClick);

    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeOverlay();
    };
    (window as any).__accessibleFindEscHandler = escHandler;
    window.addEventListener('keydown', escHandler, true);

    setTimeout(() => { try { input?.focus(); input?.select(); } catch {} }, 50);
  } else {
    const root = existing.shadowRoot as ShadowRoot | null;
    const input = root?.getElementById('af-input') as HTMLInputElement | null;
    try { input?.focus(); input?.select(); } catch {}
  }
}

// Remove overlay and its listeners in page context
function removeOverlayInPage(): void {
  const id = 'accessible-find-overlay';
  const existing = document.getElementById(id);
  if (existing) {
    existing.remove();
  }
  const escHandler = (window as any).__accessibleFindEscHandler as ((e: KeyboardEvent) => void) | undefined;
  if (escHandler) {
    window.removeEventListener('keydown', escHandler, true);
    (window as any).__accessibleFindEscHandler = undefined;
  }
}
