console.log('Popup script loaded');
// popup.js

// Function to toggle the settings panel visibility
function toggleSettingsPanel() {
    const settingsPanel = document.getElementById('settingsPanel');
    settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
  }
  
  // Event listener for the settings button
  document.getElementById('openSettings').addEventListener('click', toggleSettingsPanel);
  
  // Event listener for find-in-page input changes
  document.getElementById('findInput').addEventListener('input', handleFindInputChange);
  // Function to handle changes in the find-in-page input
  function handleFindInputChange(event) {
    const searchTerm = event.target.value;
    console.log(`Sending message to background script to find "${searchTerm}"`);
    // Send a message to the background script to perform find-in-page functionality
    chrome.runtime.sendMessage({ action: 'findInPage', searchTerm });
  }
  
  // ... (Additional logic for settings and messaging to background script)
  