// main.js
console.log('Content script loaded');

// Define variables to track settings
let blinkInterval = 500; // Default blink interval in milliseconds
let numBlinks = 3; // Default number of blinks

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log(message)
    if (message.action === 'findInPage') {
        const searchTerm = message.searchTerm;
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            blinkLinesWithSearchTerm(searchTerm, tabs[0].id);
        });
    }
    else if (message.action === 'setSettings') {
        // Update settings based on the message from the popup
        blinkInterval = message.blinkInterval;
        numBlinks = message.numBlinks;
    }
});
function blinkLinesWithSearchTerm(searchTerm, tabId) {
    console.log(`Searching for "${searchTerm}"`, tabId);
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        function: (searchTerm, blinkInterval, numBlinks) => {
            const removeBlinkingStyles = () => {
                const blinkingElements = document.querySelectorAll('.blink');
                blinkingElements.forEach((element) => {
                    const parent = element.parentNode.parentNode;
                    if(parent === null) return;
                    // remove the span element and return it to the original parent with just text
                    parent.innerHTML = parent.textContent;
                });
            };

            const applyBlinkingStyles = (element) => {
                const originalBackgroundColor = element.style.backgroundColor;
                let currentBlinks = numBlinks*2;

                const blinkIntervalId = setInterval(() => {
                    if (currentBlinks <= 0) {
                        clearInterval(blinkIntervalId);
                        element.style.backgroundColor = originalBackgroundColor;
                        return;
                    }

                    if (element.style.backgroundColor === 'yellow') {
                        element.style.backgroundColor = 'transparent';
                    } else {
                        element.style.backgroundColor = 'yellow';
                    }
                    currentBlinks--;
                }, blinkInterval);
            };

            const findAndMatchText = (element, searchText) => {
                if (element.nodeType === Node.TEXT_NODE) {
                    let replacedHTML = element.textContent;
                    const regex = new RegExp(searchText, 'gi');
                    if (regex.test(replacedHTML)) {
                        replacedHTML = replacedHTML.replace(
                            regex,
                            '<mark class="blink">$&</mark>'
                        );
                        const span = document.createElement('span');
                        span.innerHTML = replacedHTML;

                        if (element.parentNode) {
                            element.parentNode.replaceChild(span, element);
                            const blinkElements = span.querySelectorAll('.blink');
                            blinkElements.forEach((blinkElement) => {
                                applyBlinkingStyles(blinkElement);
                            });
                        }
                    }
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
        args: [searchTerm, blinkInterval, numBlinks],
    });
}
