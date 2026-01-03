declare global {
  interface Window {
    __accessibleFindBlinkIntervalId?: number | null;
    __accessibleFindMatches?: HTMLElement[];
    __accessibleFindCurrentIndex?: number | null;
  }
}

export {};
