import type { Settings } from './settings.js';
import { performSearch, navigateMatches, cancelSearchAndCleanup } from '../content/logic.js';

export function blinkLinesWithSearchTerm(
  searchTerm: string,
  tabId: number,
  settings: Settings
): Promise<{ blinkIntervalId: number | null; count: number; currentIndex: number | null }> {
  const { blinkInterval, numBlinks, numSurroundingWords, highlightBgColor, highlightTextColor, outlineColor, borderWidth, matchFontSize, selectedBgColor, selectedBorderColor, selectedTextColor } = settings;
  return new Promise((resolve) => {
    // First cancel any ongoing search and remove existing spans immediately
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func: cancelSearchAndCleanup,
        args: [],
      },
      () => {
        // Then start the new search
        chrome.scripting.executeScript(
          {
            target: { tabId },
            func: performSearch,
            args: [searchTerm, blinkInterval, numBlinks, numSurroundingWords, highlightBgColor, highlightTextColor, outlineColor, borderWidth, matchFontSize, selectedBgColor, selectedBorderColor, selectedTextColor],
          },
          (results) => {
            const first = results && results[0] ? results[0] : undefined;
            resolve(
              first
                ? (first.result as {
                    blinkIntervalId: number | null;
                    count: number;
                    currentIndex: number | null;
                  })
                : { blinkIntervalId: null, count: 0, currentIndex: null }
            );
          }
        );
      }
    );
  });
}

export function navigateMatch(
  tabId: number,
  direction: 'next' | 'prev'
): Promise<{ count: number; currentIndex: number | null }> {
  return new Promise((resolve) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func: navigateMatches,
        args: [direction],
      },
      (results) => {
        const first = results && results[0] ? results[0] : undefined;
        resolve(
          first
            ? (first.result as { count: number; currentIndex: number | null })
            : { count: 0, currentIndex: null }
        );
      }
    );
  });
}
