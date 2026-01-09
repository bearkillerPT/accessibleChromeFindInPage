declare global {
  interface Window {
    __accessibleFindBlinkIntervalId?: number | null;
    __accessibleFindMatches?: HTMLElement[];
    __accessibleFindCurrentIndex?: number | null;
    __accessibleFindStyles?: {
      highlightBgColor: string;
      highlightTextColor: string;
      outlineColor: string;
      borderWidth: number;
      matchFontSize: number;
      selectedBgColor?: string;
      selectedBorderColor?: string;
      selectedTextColor?: string;
    };
  }
}

export {};
