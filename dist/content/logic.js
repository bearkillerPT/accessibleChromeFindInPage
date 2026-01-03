export function performSearch(searchTerm, blinkInterval, numBlinks, numSurroundingWords) {
    const removeBlinkingStyles = () => {
        const blinkingElements = document.querySelectorAll('.blink');
        blinkingElements.forEach((element) => {
            const parent = element.parentNode;
            if (!parent)
                return;
            parent.innerHTML = parent.textContent ?? '';
        });
        const offBlinkingElements = document.querySelectorAll('.blink-off');
        offBlinkingElements.forEach((element) => {
            const parent = element.parentNode;
            if (!parent)
                return;
            parent.innerHTML = parent.textContent ?? '';
        });
    };
    const applyBlinkingStyles = () => {
        let currentBlinks = numBlinks * 2;
        const blinkIntervalId = window.setInterval(() => {
            if (currentBlinks <= 0) {
                window.clearInterval(blinkIntervalId);
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
                    const el = element;
                    el.style.backgroundColor = 'yellow';
                    el.style.color = 'black';
                });
                offBlinkingElements.forEach((element) => {
                    element.style.backgroundColor = 'transparent';
                });
            }
            currentBlinks--;
        }, blinkInterval);
        return blinkIntervalId;
    };
    const findAndMatchText = (element, searchText) => {
        if (element.nodeType === Node.TEXT_NODE) {
            const text = (element.textContent ?? '').trim();
            if (!text)
                return;
            const contentStrings = text.split(' ');
            const searchTermRegex = new RegExp(searchText, 'gi');
            for (let i = 0; i < contentStrings.length; i++) {
                const token = contentStrings[i];
                if (token.includes('<span class="blink'))
                    continue;
                if (token.match(searchTermRegex)) {
                    contentStrings[i] = token.replace(searchTermRegex, '<span class="blink">$&</span>');
                    for (let j = 1; j <= numSurroundingWords; j++) {
                        const left = i - j;
                        const right = i + j;
                        if (left >= 0 &&
                            contentStrings[left] &&
                            !contentStrings[left].includes('<span class="blink') &&
                            !contentStrings[left].match(searchTermRegex)) {
                            contentStrings[left] = `<span class="blink-off">${contentStrings[left]}</span>`;
                        }
                        if (right < contentStrings.length &&
                            contentStrings[right] &&
                            !contentStrings[right].includes('class="blink') &&
                            !contentStrings[right].match(searchTermRegex)) {
                            contentStrings[right] = `<span class="blink-off">${contentStrings[right]}</span>`;
                        }
                    }
                }
            }
            const div = document.createElement('div');
            div.innerHTML = contentStrings.join(' ');
            const parent = element.parentNode;
            if (!parent)
                return;
            parent.replaceChild(div, element);
            const blinkElements = document.querySelectorAll('.blink');
            blinkElements.forEach((blinkElement) => {
                const el = blinkElement;
                el.style.backgroundColor = 'yellow';
                el.style.color = 'black';
            });
        }
        else if (element.nodeType === Node.ELEMENT_NODE) {
            const el = element;
            for (let i = 0; i < el.childNodes.length; i++) {
                findAndMatchText(el.childNodes[i], searchText);
            }
        }
    };
    removeBlinkingStyles();
    if (!searchTerm)
        return null;
    findAndMatchText(document.body, searchTerm);
    return applyBlinkingStyles();
}
