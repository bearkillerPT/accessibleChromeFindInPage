export function performSearch(
  searchTerm: string,
  blinkInterval: number,
  numBlinks: number,
  numSurroundingWords: number
): number | null {
  // Helpers to manage the blink interval id stored on window
  const getBlinkIntervalId = (): number | null =>
    (window as unknown as { __accessibleFindBlinkIntervalId?: number | null })
      .__accessibleFindBlinkIntervalId ?? null;

  const setBlinkIntervalId = (id: number | null): void => {
    (
      window as unknown as { __accessibleFindBlinkIntervalId?: number | null }
    ).__accessibleFindBlinkIntervalId = id;
  };

  // Stop any previous blinking interval running in the page context
  const prevBlinkIntervalId = getBlinkIntervalId();
  if (typeof prevBlinkIntervalId === "number") {
    window.clearInterval(prevBlinkIntervalId);
    setBlinkIntervalId(null);
  }

  const removeBlinkingStyles = (): void => {
    const blinkingElements = document.querySelectorAll(
      ".blink, .blink-off"
    );
    blinkingElements.forEach((element) => {
      const parent = element.parentNode as HTMLElement | null;
      if (!parent) return;
      parent.innerHTML = parent.textContent ?? "";
    });
  };

  const setElementsHighlighted = (
    elements: NodeListOf<Element>,
    highlighted: boolean
  ): void => {
    elements.forEach((element) => {
      const el = element as HTMLElement;
      if (highlighted) {
        el.style.backgroundColor = "yellow";
        el.style.color = "black";
      } else {
        el.style.removeProperty("background-color");
        el.style.removeProperty("color");
      }
    });
  };

  const applyBlinkingStyles = (): number => {
    let currentBlinks = numBlinks * 2;

    const blinkIntervalId = window.setInterval(() => {
      if (currentBlinks <= 0) {
        window.clearInterval(blinkIntervalId);
        setBlinkIntervalId(null);
        return;
      }
      const blinkingElements = document.querySelectorAll(".blink");
      const offBlinkingElements = document.querySelectorAll(".blink-off");
      const highlightBlink = currentBlinks % 2 === 1;
      setElementsHighlighted(blinkingElements, highlightBlink);
      setElementsHighlighted(offBlinkingElements, !highlightBlink);

      currentBlinks--;
    }, blinkInterval);
    setBlinkIntervalId(blinkIntervalId);
    return blinkIntervalId;
  };

  const findAndMatchText = (element: Node, searchText: string): void => {
    if (element.nodeType === Node.TEXT_NODE) {
      const text = (element.textContent ?? "").trim();
      if (!text) return;
      const contentStrings = text.split(" ");
      const searchTermRegex = new RegExp(searchText, "gi");
      const shouldWrapOff = (token: string): boolean => {
        return (
          !!token &&
          !token.includes('class="blink') &&
          !token.includes('<span class="blink') &&
          !token.match(searchTermRegex)
        );
      };
      for (let i = 0; i < contentStrings.length; i++) {
        const token = contentStrings[i];
        if (token.includes('<span class="blink')) continue;
        if (token.match(searchTermRegex)) {
          contentStrings[i] = token.replace(
            searchTermRegex,
            '<span class="blink">$&</span>'
          );
          for (let j = 1; j <= numSurroundingWords; j++) {
            const left = i - j;
            const right = i + j;
            if (left >= 0 && shouldWrapOff(contentStrings[left])) {
              contentStrings[
                left
              ] = `<span class="blink-off">${contentStrings[left]}</span>`;
            }
            if (
              right < contentStrings.length &&
              shouldWrapOff(contentStrings[right])
            ) {
              contentStrings[
                right
              ] = `<span class="blink-off">${contentStrings[right]}</span>`;
            }
          }
        }
      }

      const div = document.createElement("div");
      div.innerHTML = contentStrings.join(" ");
      const parent = element.parentNode as HTMLElement | null;
      if (!parent) return;
      parent.replaceChild(div, element);
      const blinkElements = document.querySelectorAll(".blink");
      setElementsHighlighted(blinkElements, true);
    } else if (element.nodeType === Node.ELEMENT_NODE) {
      const el = element as Element;
      for (let i = 0; i < el.childNodes.length; i++) {
        findAndMatchText(el.childNodes[i], searchText);
      }
    }
  };

  removeBlinkingStyles();
  if (!searchTerm) return null;
  findAndMatchText(document.body, searchTerm);
  return applyBlinkingStyles();
}
