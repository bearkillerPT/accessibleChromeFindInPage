export const defaultSettings = {
    blinkInterval: 1000,
    numBlinks: 3,
    numSurroundingWords: 5,
};
export function getSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get({ settings: defaultSettings }, (result) => {
            const s = result && result.settings
                ? result.settings
                : defaultSettings;
            resolve(s);
        });
    });
}
export function setSettings(settings) {
    return new Promise((resolve) => {
        chrome.storage.sync.set({ settings }, () => resolve(true));
    });
}
