document.addEventListener('DOMContentLoaded', function () {
  const settingsButton = document.getElementById('settingsButton');
  const settingsPopup = document.getElementById('settingsPopup');
  const closeButton = document.getElementById('closeButton');
  const saveButton = document.getElementById('saveButton');
  const blinkIntervalInput = document.getElementById('blinkInterval');
  const numBlinksInput = document.getElementById('numBlinks');
  const numSurroundingWordsInput = document.getElementById('numSurroundingWords');

  // Load settings from the background script
  chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
      if (response) {
          blinkIntervalInput.value = response.blinkInterval || 1000;
          numBlinksInput.value = response.numBlinks || 3;
          numSurroundingWordsInput.value = response.numSurroundingWords || 5;
      }
  });

  settingsButton.addEventListener('click', () => {
      settingsPopup.style.display = 'block';

      // Calculate the new height based on the settings popup content
      const popupHeight = settingsPopup.scrollHeight;
      document.body.style.height = popupHeight + 'px';
  });

  closeButton.addEventListener('click', () => {
      settingsPopup.style.display = 'none';

      // Reset the body height when the popup is closed
      document.body.style.height = 'auto';
  });

  saveButton.addEventListener('click', () => {
      const blinkInterval = blinkIntervalInput.value;
      const numBlinks = numBlinksInput.value;
      const numSurroundingWords = numSurroundingWordsInput.value;

      // Send the updated settings to the background script
      chrome.runtime.sendMessage({
          action: 'setSettings',
          settings: {
              blinkInterval,
              numBlinks,
              numSurroundingWords,
          },
      });

      // Close the settings popup
      settingsPopup.style.display = 'none';

      // Reset the body height when the popup is closed
      document.body.style.height = 'auto';
  });

  // Event listener for find-in-page input changes
  document.getElementById('findInput').addEventListener('input', handleFindInputChange);

  // Function to handle changes in the find-in-page input
  function handleFindInputChange(event) {
      const searchTerm = event.target.value;
      console.log(`Sending message to background script to find "${searchTerm}"`);
      // Send a message to the background script to perform find-in-page functionality
      chrome.runtime.sendMessage({ action: 'findInPage', searchTerm });
  }
});
