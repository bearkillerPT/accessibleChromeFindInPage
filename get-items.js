// TODO remove this file if not used
chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    console.log(document.querySelectorAll("#auc-minicart-panel > div.auc-panel__content > div")[0].innerHTML)
    chrome.tabs.sendMessage(tabs[0].id, {
        products: document.querySelectorAll("#auc-minicart-panel > div.auc-panel__content > div")
    });
})