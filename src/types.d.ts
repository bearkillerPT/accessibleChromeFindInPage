declare global {
  interface Window {
    __accessibleFindBlinkIntervalId?: number | null;
    __accessibleFindMatches?: HTMLElement[];
    __accessibleFindCurrentIndex?: number | null;
    __accessibleFindStyles?: {
      highlightBgColor: string;
      highlightTextColor: string;
      outlineColor: string;
      outlineWidth: number;
      matchFontSize: number;
    };
  }
}

export {};
