import { defaultSettings, getSettings, setSettings } from './settings.js';
import { blinkLinesWithSearchTerm } from './search.js';
let settings = { ...defaultSettings };
let lastIntervalId = null;
(async function init() {
    settings = await getSettings();
    console.log('Accessible Find In Page service worker initialized');
})();
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
            blinkLinesWithSearchTerm(searchTerm, tabId, settings).then((intervalId) => {
                if (lastIntervalId !== null) {
                    clearInterval(lastIntervalId);
                }
                lastIntervalId = intervalId;
                sendResponse({ ok: true });
            });
        });
        return true; // async response
    }
});
