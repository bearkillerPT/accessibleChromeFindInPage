export interface Settings {
  blinkInterval: number;
  numBlinks: number;
  numSurroundingWords: number;
}

export const defaultSettings: Settings = {
  blinkInterval: 400,
  numBlinks: 2,
  numSurroundingWords: 1,
};

export function getSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ settings: defaultSettings }, (result) => {
      const s = result && (result as { settings?: Settings }).settings
        ? (result as { settings?: Settings }).settings!
        : defaultSettings;
      resolve(s);
    });
  });
}

export function setSettings(settings: Settings): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ settings }, () => resolve(true));
  });
}
