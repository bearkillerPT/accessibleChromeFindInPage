export interface Settings {
  blinkInterval: number;
  numBlinks: number;
  numSurroundingWords: number;
  highlightBgColor: string;
  highlightTextColor: string;
  outlineColor: string;
  borderWidth: number; // in px
  matchFontSize: number; // in px
  selectedBgColor: string;
  selectedBorderColor: string;
  selectedTextColor: string;
}

export const defaultSettings: Settings = {
  blinkInterval: 400,
  numBlinks: 2,
  numSurroundingWords: 1,
  highlightBgColor: "#ffff00",
  highlightTextColor: "#000",
  outlineColor: "#ff8c00",
  borderWidth: 3,
  matchFontSize: 20,
  selectedBgColor: "#ff8c00",
  selectedBorderColor: "#ffff00",
  selectedTextColor: "#fff",
};

export function getSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ settings: defaultSettings }, (result) => {
      const raw =
        result && (result as { settings?: Settings }).settings
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
