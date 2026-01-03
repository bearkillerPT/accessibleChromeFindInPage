# Accessible find in page
Accessible find in page is a browser extension that makes it easier to search for text on a web page on chromium based browsers.
It is designed to be used by people with visual impairments and temporarely blinks the lines containing the search term.

## Installation
### From the Chrome Web Store
(TODO)
Accessible find in page is available on the [Chrome Web Store](https://chrome.google.com/webstore/detail/accessible-find-in-page/okjgjgkfbfjgjgjgjgjgjgjgjgjgjgj). Just click the "Add to Chrome" button.

### From source
1. Clone the repository
2. Run `npm install`
3. Run `npm run build`
4. Open the extensions page in your browser
5. Enable developer mode
6. Click "Load unpacked extension"
7. Select the `dist` folder

## Usage
1. Click the extension icon to open the popup
2. Type a search term; matching lines blink
3. Use ▲/▼ to navigate previous/next match
4. The default selected match is closest to the viewport center
5. The counter shows total matches found
 - Or press the shortcut to open the popup (configurable under chrome://extensions/shortcuts; default is Ctrl+Shift+F)

## Options
### Search term
(TODO)
### Blinking
Blinking is the main feature of this extension. It makes the lines containing the search term blink. You can set the blink interval and the number of blinks.
It also allows to have a number of surrounding words blink alternatingly with the search term.

### Navigation
When a search is active, the extension selects the match closest to the center of the viewport. You can navigate through matches using the ▲ (previous) and ▼ (next) buttons. The popup displays the total number of matches found.

## Contributing
### TODO
- [ ] Keyboard shortcuts
- [ ] PDF support
- [ ] Search term options (case sensitive, whole word, regex, etc.)
- [ ] Selecting only elements that CTRL+F would select (I've tried a few things, but I can't get exactly the same results)
- [ ] Selecting a specific result and going to previous/next result using different color and shortcut


## Example
If you wish to try out the extension, you can go to [this page](https://heaboo.bearkillerpt.xyz/), to test in a really simple page, or, as the example in the demo video does, try it on [GitHub](https://www.github.com/bearkillerpt/accessible-find-in-page/).
Checkout the [demo video](https://www.github.com/bearkillerpt/accessible-find-in-page/demo.mp4) to see it in action!

## Disclaimer
This extension is still in development and may not work as expected. 
Right now the extension looks at every tag containing text content but on a google search page, for example, the page brakes when the replacement spans are inserted.

Create an issue if you want more options besides the ones listed above.

I myself have Retinitis pigmentosa :/

