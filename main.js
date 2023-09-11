// main.js
console.log('Content script loaded');

// Define variables to track settings
let blinkInterval = 500; // Default blink interval in milliseconds
let numBlinks = 3; // Default number of blinks
let numSurroundingWords = 0; // Default number of words to blink around the search term

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
                blinkingElements.forEach((element) => {
                    const parent = element.parentNode.parentNode;
                    if (parent === null) return;
                    // remove the span element and return it to the original parent with just text
                    parent.innerHTML = parent.textContent;
                });
            };

            const applyBlinkingStyles = () => {
                let currentBlinks = numBlinks * 2;

                const blinkIntervalId = setInterval(() => {
                    if (currentBlinks <= 0) {
                        clearInterval(blinkIntervalId);
                        element.style.backgroundColor = originalBackgroundColor;
                        return;
                    }
                    const blinkingElements = document.querySelectorAll('.blink');
                    const offBlinkingElements = document.querySelectorAll('.blink-off');
                    if(currentBlinks % 2 === 0) {
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
                    let replacedHTML = element.textContent;
                    // for each searchTerm match
                    let contentStrings = element.textContent.split(" ");
                    const searchTermRegex = new RegExp(searchText, 'gi');
                    for (let i = 0; i < contentStrings.length; i++) {
                        if (contentStrings[i].match(searchTermRegex)) {
                            // surround the match with a span element
                            contentStrings[i] = contentStrings[i].replace(searchTermRegex, `<span class="blink">$&</span>`);
                        }
                        else {
                            contentStrings[i] = `<span class="blink-off">${contentStrings[i]}</span>`;
                        }
                    }
                    const div = document.createElement('div');
                    div.innerHTML = contentStrings.join(" ");
                    element.parentNode.replaceChild(div, element);
                    const blinkElements = document.querySelectorAll('.blink');
                    blinkElements.forEach((element) => {
                        element.style.backgroundColor = 'yellow';
                        element.style.color = 'black';
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