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
  const matchCountEl = document.getElementById('matchCount') as HTMLSpanElement;
  const prevButton = document.getElementById('prevButton') as HTMLButtonElement;
  const nextButton = document.getElementById('nextButton') as HTMLButtonElement;

  function handleFindKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      navigate(e.shiftKey ? 'prev' : 'next');
    }
  }
  function handlePrevClick() { navigate('prev'); }
  function handleNextClick() { navigate('next'); }

  findInput.addEventListener('input', handleFindInputChange);
  findInput.addEventListener('keydown', handleFindKeyDown);
  prevButton.addEventListener('click', handlePrevClick);
  nextButton.addEventListener('click', handleNextClick);

  // Autofocus the search input when the popup opens
  try {
    findInput.focus();
    findInput.select();
  } catch {}

  // Clear search and close popup on Escape
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      try {
        findInput.value = '';
        chrome.runtime.sendMessage({ action: 'findInPage', searchTerm: '' }, () => {
          window.close();
        });
      } catch {
        window.close();
      }
    }
  };
  document.addEventListener('keydown', onKeyDown);

  // Clear search when the popup is closed
  const onUnload = () => {
    try {
      chrome.runtime.sendMessage({ action: 'findInPage', searchTerm: '' });
    } catch {}
  };
  window.addEventListener('unload', onUnload);

  function handleFindInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const searchTerm = target.value;
    chrome.runtime.sendMessage({ action: 'findInPage', searchTerm }, (response: { ok: boolean; count?: number } | null) => {
      if (response && typeof response.count === 'number') {
        matchCountEl.textContent = String(response.count);
      } else {
        matchCountEl.textContent = '0';
      }
    });
  }

  function navigate(direction: 'next' | 'prev'): void {
    chrome.runtime.sendMessage({ action: 'navigateMatch', direction }, (response: { ok: boolean; count?: number } | null) => {
      if (response && typeof response.count === 'number') {
        matchCountEl.textContent = String(response.count);
      }
    });
  }
});
