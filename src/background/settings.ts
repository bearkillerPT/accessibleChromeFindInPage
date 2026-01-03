export interface Settings {
  blinkInterval: number;
  numBlinks: number;
  numSurroundingWords: number;
  highlightBgColor: string;
  highlightTextColor: string;
  outlineColor: string;
  outlineWidth: number; // in px
}

export const defaultSettings: Settings = {
  blinkInterval: 400,
  numBlinks: 2,
  numSurroundingWords: 1,
  highlightBgColor: '#ffff00',
  highlightTextColor: '#000000',
  outlineColor: '#ff8c00',
  outlineWidth: 3,
};

export function getSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ settings: defaultSettings }, (result) => {
      const raw = result && (result as { settings?: Settings }).settings
        ? (result as { settings?: Settings }).settings!
        : defaultSettings;
      const merged: Settings = { ...defaultSettings, ...raw };
      resolve(merged);
    });
  });
}

export function setSettings(settings: Settings): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ settings }, () => resolve(true));
  });
}
