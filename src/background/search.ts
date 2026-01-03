import type { Settings } from './settings.js';
import { performSearch } from '../content/logic.js';

export function blinkLinesWithSearchTerm(
  searchTerm: string,
  tabId: number,
  settings: Settings
): Promise<number | null> {
  const { blinkInterval, numBlinks, numSurroundingWords } = settings;
  return new Promise((resolve) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func: performSearch,
        args: [searchTerm, blinkInterval, numBlinks, numSurroundingWords],
      },
      (results) => {
        const first = results && results[0] ? results[0] : undefined;
        resolve(first ? (first.result as number | null) : null);
      }
    );
  });
}
