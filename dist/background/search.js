import { performSearch } from '../content/logic.js';
export function blinkLinesWithSearchTerm(searchTerm, tabId, settings) {
    const { blinkInterval, numBlinks, numSurroundingWords } = settings;
    return new Promise((resolve) => {
        chrome.scripting.executeScript({
            target: { tabId },
            func: performSearch,
            args: [searchTerm, blinkInterval, numBlinks, numSurroundingWords],
        }, (results) => {
            const first = results && results[0] ? results[0] : undefined;
            resolve(first ? first.result : null);
        });
    });
}
