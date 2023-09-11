// main.js
console.log('Content script loaded');

// Initialize default settings (if needed)
const defaultSettings = {
    blinkInterval: 500, // Default blink interval in milliseconds
    numBlinks: 3,       // Default number of blinks
    numSurroundingWords: 1, // Default number of surrounding words
};
let blinkInterval = 1000
let numBlinks = 3
let numSurroundingWords = 5
// Initialize settings from storage or use default settings
chrome.storage.sync.get(defaultSettings, (result) => {
    // The result object will contain the stored settings, or the default settings if none are stored.
    const storedSettings = result;
    if (!storedSettings.settings) {
        storedSettings.settings = defaultSettings;
    }
    blinkInterval = storedSettings.settings.blinkInterval;
    numBlinks = storedSettings.settings.numBlinks;
    numSurroundingWords = storedSettings.settings.numSurroundingWords;
    // Listen for messages from the popup or content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'getSettings') {
            // Send the stored settings to the requesting script (popup or content script)
            sendResponse(storedSettings);
        } else if (message.action === 'setSettings') {
            // Update and save the settings to storage
            const updatedSettings = message.settings;
            chrome.storage.sync.set(updatedSettings, () => {
                // Send a confirmation message (if needed)
                blinkInterval = updatedSettings.blinkInterval;
                numBlinks = updatedSettings.numBlinks;
                numSurroundingWords = updatedSettings.numSurroundingWords;
                sendResponse('Settings updated successfully');
            });
        }
    });
});


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log(message)
    if (message.action === 'findInPage') {
        const searchTerm = message.searchTerm;
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            console.log('Searching for', searchTerm);
            blinkLinesWithSearchTerm(searchTerm, tabs[0].id);
        });
    }
    else if (message.action === 'setSettings') {
        // Update settings based on the message from the popup
        blinkInterval = message.blinkInterval;
        numBlinks = message.numBlinks;
        numSurroundingWords = message.numSurroundingWords;
    }
});

function blinkLinesWithSearchTerm(searchTerm, tabId) {
    console.log(`Searching for "${searchTerm}"`, tabId);
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        function: (searchTerm, blinkInterval, numBlinks, numSurroundingWords) => {
            const removeBlinkingStyles = () => {
                const blinkingElements = document.querySelectorAll('.blink');
                // merge the blink and blink-off texts into one text node
                blinkingElements.forEach((element) => {
                    const parent = element.parentNode;
                    if (!parent) return;
                    parent.innerHTML = parent.innerHTML = parent.textContent
                }
                );
            };

            const applyBlinkingStyles = () => {
                let currentBlinks = numBlinks * 2;

                const blinkIntervalId = setInterval(() => {
                    if (currentBlinks <= 0) {
                        clearInterval(blinkIntervalId);
                        return;
                    }
                    const blinkingElements = document.querySelectorAll('.blink');
                    const offBlinkingElements = document.querySelectorAll('.blink-off');
                    if (currentBlinks % 2 === 0) {
                        blinkingElements.forEach((element) => {
                            element.style.backgroundColor = 'transparent';
                        });
                        offBlinkingElements.forEach((element) => {
                            element.style.backgroundColor = 'yellow';
                        });

                    }
                    else {
                        blinkingElements.forEach((element) => {
                            element.style.backgroundColor = 'yellow';
                            element.style.color = 'black';
                        });
                        offBlinkingElements.forEach((element) => {
                            element.style.backgroundColor = 'transparent';
                        });
                    }


                    currentBlinks--;
                }, blinkInterval);
            };

            const findAndMatchText = (element, searchText) => {
                if (element.nodeType === Node.TEXT_NODE) {
                    let contentStrings = element.textContent.split(" ");
                    const searchTermRegex = new RegExp(searchText, 'gi');
                    let lastMatchIndex = -1;
                    for (let i = 0; i < contentStrings.length; i++) {
                        if (contentStrings[i].match(searchTermRegex)) {
                            lastMatchIndex = i;
                            // surround the match with a span element
                            contentStrings[i] = contentStrings[i].replace(searchTermRegex, `<span class="blink">$&</span>`);
                            for (let j = 1; j <= numSurroundingWords; j++) {
                                if (i - j >= 0 &&
                                    contentStrings[i - j].trim() !== '' &&
                                    !contentStrings[i - j].includes('<span class="blink')
                                ) {
                                    console.log(contentStrings[i - j])
                                    contentStrings[i - j] = `<span class="blink-off">${contentStrings[i - j]}</span>`;
                                }

                            }
                        }
                    }
                    if (lastMatchIndex === -1) return;
                    for (let j = 1; j <= numSurroundingWords; j++) {
                        if (lastMatchIndex + j < contentStrings.length &&
                            contentStrings[lastMatchIndex + j].trim() !== '' &&
                            !contentStrings[lastMatchIndex + j].includes('<span class="blink')) {
                            contentStrings[lastMatchIndex + j] = `<span class="blink-off">${contentStrings[lastMatchIndex + j]}</span>`;
                        }
                    }

                    const div = document.createElement('div');
                    div.innerHTML = contentStrings.join(" ");
                    element.parentNode.replaceChild(div, element);
                    const blinkElements = document.querySelectorAll('.blink');
                    blinkElements.forEach((blinkElement) => {
                        blinkElement.style.backgroundColor = 'yellow';
                        blinkElement.style.color = 'black';
                    });
                    applyBlinkingStyles();

                } else if (element.nodeType === Node.ELEMENT_NODE) {
                    for (let i = 0; i < element.childNodes.length; i++) {
                        findAndMatchText(element.childNodes[i], searchText);
                    }
                }
            };

            removeBlinkingStyles();
            if (searchTerm === '')
                return;
            findAndMatchText(document.body, searchTerm);
        },
        args: [searchTerm, blinkInterval, numBlinks, numSurroundingWords]
    });
}