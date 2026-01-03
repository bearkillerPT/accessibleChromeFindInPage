"use strict";
document.addEventListener('DOMContentLoaded', function () {
    const settingsButton = document.getElementById('settingsButton');
    const settingsPopup = document.getElementById('settingsPopup');
    const closeButton = document.getElementById('closeButton');
    const saveButton = document.getElementById('saveButton');
    const blinkIntervalInput = document.getElementById('blinkInterval');
    const numBlinksInput = document.getElementById('numBlinks');
    const numSurroundingWordsInput = document.getElementById('numSurroundingWords');
    chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
        if (response) {
            blinkIntervalInput.value = String(response.blinkInterval ?? 1000);
            numBlinksInput.value = String(response.numBlinks ?? 3);
            numSurroundingWordsInput.value = String(response.numSurroundingWords ?? 5);
        }
    });
    settingsButton.addEventListener('click', () => {
        settingsPopup.style.display = 'block';
        const popupHeight = settingsPopup.scrollHeight;
        document.body.style.height = popupHeight + 'px';
    });
    closeButton.addEventListener('click', () => {
        settingsPopup.style.display = 'none';
        document.body.style.height = 'auto';
    });
    saveButton.addEventListener('click', () => {
        const blinkInterval = Number(blinkIntervalInput.value);
        const numBlinks = Number(numBlinksInput.value);
        const numSurroundingWords = Number(numSurroundingWordsInput.value);
        chrome.runtime.sendMessage({
            action: 'setSettings',
            settings: {
                blinkInterval,
                numBlinks,
                numSurroundingWords,
            },
        });
        settingsPopup.style.display = 'none';
        document.body.style.height = 'auto';
    });
    const findInput = document.getElementById('findInput');
    findInput.addEventListener('input', handleFindInputChange);
    function handleFindInputChange(event) {
        const target = event.target;
        const searchTerm = target.value;
        chrome.runtime.sendMessage({ action: 'findInPage', searchTerm });
    }
});
