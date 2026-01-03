export function performSearch(
  searchTerm: string,
  blinkInterval: number,
  numBlinks: number,
  numSurroundingWords: number,
  highlightBgColor: string,
  highlightTextColor: string,
  outlineColor: string,
  outlineWidth: number,
  matchFontSize: number
): { blinkIntervalId: number | null; count: number; currentIndex: number | null } {
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

  const getMatches = (): HTMLElement[] =>
    (window as unknown as { __accessibleFindMatches?: HTMLElement[] }).
      __accessibleFindMatches ?? [];

  const setMatches = (m: HTMLElement[]): void => {
    (window as unknown as { __accessibleFindMatches?: HTMLElement[] }).
      __accessibleFindMatches = m;
  };

  const getCurrentIndex = (): number | null =>
    (window as unknown as { __accessibleFindCurrentIndex?: number | null }).
      __accessibleFindCurrentIndex ?? null;

  const setCurrentIndex = (idx: number | null): void => {
    (window as unknown as { __accessibleFindCurrentIndex?: number | null }).
      __accessibleFindCurrentIndex = idx;
  };

  const setElementsHighlighted = (
    elements: NodeListOf<Element>,
    highlighted: boolean
  ): void => {
    elements.forEach((element) => {
      const el = element as HTMLElement;
      if (highlighted) {
        el.style.backgroundColor = highlightBgColor;
        el.style.color = highlightTextColor;
      } else {
        el.style.removeProperty("background-color");
        el.style.removeProperty("color");
      }
    });
  };

  const applyCurrentSelection = (index: number | null): void => {
    const matches = getMatches();
    // clear any previous outlines
    matches.forEach((m) => {
      m.style.removeProperty("outline");
      m.style.removeProperty("border");
    });
    if (index === null) return;
    const el = matches[index];
    if (!el) return;
    el.style.outline = `${outlineWidth}px solid ${outlineColor}`;
    el.scrollIntoView({ block: "center", inline: "nearest" });
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
      // Apply match font size once; do not toggle during blink cycles
      blinkElements.forEach((el) => {
        (el as HTMLElement).style.fontSize = `${matchFontSize}px`;
      });
    } else if (element.nodeType === Node.ELEMENT_NODE) {
      const el = element as Element;
      for (let i = 0; i < el.childNodes.length; i++) {
        findAndMatchText(el.childNodes[i], searchText);
      }
    }
  };

  removeBlinkingStyles();
  (window as unknown as { __accessibleFindStyles?: any }).__accessibleFindStyles = {
    highlightBgColor,
    highlightTextColor,
    outlineColor,
    outlineWidth,
    matchFontSize,
  };
  setMatches([]);
  setCurrentIndex(null);
  if (!searchTerm) {
    return { blinkIntervalId: null, count: 0, currentIndex: null };
  }
  findAndMatchText(document.body, searchTerm);
  const matches = Array.from(document.querySelectorAll(".blink")) as HTMLElement[];
  setMatches(matches);
  // Determine default selection closest to viewport center
  let defaultIndex: number | null = null;
  if (matches.length > 0) {
    const viewportCenterY = window.scrollY + window.innerHeight / 2;
    let bestDist = Number.POSITIVE_INFINITY;
    let bestIdx = 0;
    for (let i = 0; i < matches.length; i++) {
      const rect = matches[i].getBoundingClientRect();
      const centerY = rect.top + window.scrollY + rect.height / 2;
      const dist = Math.abs(centerY - viewportCenterY);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    defaultIndex = bestIdx;
  }
  setCurrentIndex(defaultIndex);
  applyCurrentSelection(defaultIndex);
  const id = applyBlinkingStyles();
  return { blinkIntervalId: id, count: matches.length, currentIndex: defaultIndex };
}

export function navigateMatches(direction: "next" | "prev"): { count: number; currentIndex: number | null } {
  const getMatches = (): HTMLElement[] =>
    (window as unknown as { __accessibleFindMatches?: HTMLElement[] }).
      __accessibleFindMatches ?? [];
  const styles = (window as unknown as { __accessibleFindStyles?: {
    highlightBgColor: string;
    highlightTextColor: string;
    outlineColor: string;
    outlineWidth: number;
  } }).__accessibleFindStyles ?? {
    highlightBgColor: '#ffff00',
    highlightTextColor: '#000000',
    outlineColor: '#ff8c00',
    outlineWidth: 3,
  };
  const setCurrentIndex = (idx: number | null): void => {
    (window as unknown as { __accessibleFindCurrentIndex?: number | null }).
      __accessibleFindCurrentIndex = idx;
  };
  const getCurrentIndex = (): number | null =>
    (window as unknown as { __accessibleFindCurrentIndex?: number | null }).
      __accessibleFindCurrentIndex ?? null;
  const matches = getMatches();
  const count = matches.length;
  if (count === 0) {
    setCurrentIndex(null);
    return { count: 0, currentIndex: null };
  }
  let idx = getCurrentIndex();
  if (idx === null) idx = 0;
  if (direction === "next") {
    idx = (idx + 1) % count;
  } else {
    idx = (idx - 1 + count) % count;
  }
  setCurrentIndex(idx);
  // Apply selection outline and scroll
  matches.forEach((m) => {
    m.style.removeProperty("outline");
    m.style.removeProperty("border");
  });
  const el = matches[idx];
  if (el) {
    el.style.outline = `${styles.outlineWidth}px solid ${styles.outlineColor}`;
    el.scrollIntoView({ block: "center", inline: "nearest" });
  }
  return { count, currentIndex: idx };
}
