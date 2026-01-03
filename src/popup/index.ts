document.addEventListener('DOMContentLoaded', function () {
  const settingsButton = document.getElementById('settingsButton') as HTMLButtonElement;
  const settingsPopup = document.getElementById('settingsPopup') as HTMLDivElement;
  const closeButton = document.getElementById('closeButton') as HTMLSpanElement;
  const saveButton = document.getElementById('saveButton') as HTMLButtonElement;
  const blinkIntervalInput = document.getElementById('blinkInterval') as HTMLInputElement;
  const numBlinksInput = document.getElementById('numBlinks') as HTMLInputElement;
  const numSurroundingWordsInput = document.getElementById('numSurroundingWords') as HTMLInputElement;

  chrome.runtime.sendMessage({ action: 'getSettings' }, (response: { blinkInterval: number; numBlinks: number; numSurroundingWords: number } | null) => {
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

  const findInput = document.getElementById('findInput') as HTMLInputElement;
  findInput.addEventListener('input', handleFindInputChange);

  function handleFindInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const searchTerm = target.value;
    chrome.runtime.sendMessage({ action: 'findInPage', searchTerm });
  }
});
