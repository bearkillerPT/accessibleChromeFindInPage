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
  highlightTextColor: "#000000",
  outlineColor: "#ff8c00",
  borderWidth: 3,
  matchFontSize: 20,
  selectedBgColor: "#ff8c00",
  selectedBorderColor: "#ffff00",
  selectedTextColor: "#ffffff",
};

export function getSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ settings: defaultSettings }, (result) => {
      const raw =
        result && (result as { settings?: Settings }).settings
          ? (result as { settings?: Settings }).settings!
          : defaultSettings;
      const merged: Settings = { ...defaultSettings, ...raw };
      // Normalize any 3-digit hex colors to 6-digit for input[type=color] compatibility
      const normalizeHex = (hex: string): string => {
        try {
          const m = hex.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
          if (!m) return hex;
          let h = m[1];
          if (h.length === 3) h = h.split("").map((c) => c + c).join("");
          return `#${h.toLowerCase()}`;
        } catch {
          return hex;
        }
      };
      const normalized: Settings = {
        ...merged,
        highlightBgColor: normalizeHex(merged.highlightBgColor),
        highlightTextColor: normalizeHex(merged.highlightTextColor),
        outlineColor: normalizeHex(merged.outlineColor),
        selectedBgColor: normalizeHex(merged.selectedBgColor),
        selectedBorderColor: normalizeHex(merged.selectedBorderColor),
        selectedTextColor: normalizeHex(merged.selectedTextColor),
      };
      resolve(normalized);
    });
  });
}

export function setSettings(settings: Settings): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ settings }, () => resolve(true));
  });
}
