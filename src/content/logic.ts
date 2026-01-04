export async function performSearch(
  searchTerm: string,
  blinkInterval: number,
  numBlinks: number,
  numSurroundingWords: number,
  highlightBgColor: string,
  highlightTextColor: string,
  outlineColor: string,
  outlineWidth: number,
  matchFontSize: number
): Promise<{ blinkIntervalId: number | null; count: number; currentIndex: number | null }> {
  // Cancellation token management
  const getActiveToken = (): number | null =>
    (window as unknown as { __accessibleFindActiveToken?: number | null }).
      __accessibleFindActiveToken ?? null;
  const setActiveToken = (token: number | null): void => {
    (window as unknown as { __accessibleFindActiveToken?: number | null }).
      __accessibleFindActiveToken = token;
  };
  const generateToken = (): number => Math.floor(Date.now() ^ Math.random() * 1e9);
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

  // Set a new active token; older searches will stop when they detect mismatch
  const myToken = generateToken();
  setActiveToken(myToken);
  const isCancelled = (): boolean => getActiveToken() !== myToken;

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

  // Visibility and exclusion helpers to align with Chrome's find-in-page behavior
  const isExcludedTag = (el: Element): boolean => {
    const tag = el.tagName.toUpperCase();
    return (
      tag === "SCRIPT" ||
      tag === "STYLE" ||
      tag === "NOSCRIPT" ||
      tag === "TEMPLATE" ||
      tag === "HEAD" ||
      tag === "META" ||
      tag === "LINK"
    );
  };

  const isElementActuallyVisible = (el: Element): boolean => {
    // Walk up the ancestor chain to detect hiddenness similar to Chrome
    let cur: Element | null = el;
    while (cur && cur instanceof Element) {
      const h = cur as HTMLElement;
      if (h.hidden) return false;
      if (cur.hasAttribute("inert")) return false;
      const ariaHidden = cur.getAttribute("aria-hidden");
      if (ariaHidden === "true") return false;

      const style = window.getComputedStyle(cur);
      if (style.display === "none" || style.visibility === "hidden") return false;
      if (parseFloat(style.opacity || "1") === 0) return false;
      const contentVisibility = style.getPropertyValue("content-visibility");
      if (contentVisibility === "hidden") return false;

      cur = cur.parentElement;
    }

    // Element itself must have a non-empty rect with area
    const rects = (el as HTMLElement).getClientRects();
    if (rects.length === 0) return false;
    let hasNonZeroRect = false;
    for (let i = 0; i < rects.length; i++) {
      if (rects[i].width > 0 && rects[i].height > 0) {
        hasNonZeroRect = true;
        break;
      }
    }
    if (!hasNonZeroRect) return false;

    return true;
  };

  const shouldSkipElement = (el: Element): boolean => {
    if (isExcludedTag(el)) return true;
    // Skip entire subtrees that are not visible
    if (!isElementActuallyVisible(el)) return true;
    return false;
  };

  const getMatches = (): HTMLElement[] =>
    (window as unknown as { __accessibleFindMatches?: HTMLElement[] }).
      __accessibleFindMatches ?? [];

  const setMatches = (m: HTMLElement[]): void => {
    (window as unknown as { __accessibleFindMatches?: HTMLElement[] }).
      __accessibleFindMatches = m;
  };
  
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
      if (isCancelled()) {
        window.clearInterval(blinkIntervalId);
        setBlinkIntervalId(null);
        return;
      }
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

  // Async, chunked traversal to allow cancellation to interrupt mid-search
  const walkAndMatchAsync = async (
    root: Element,
    searchText: string
  ): Promise<{ ops: Array<{ parent: HTMLElement; node: Node; html: string }> }> => {
    const queue: Node[] = Array.from(root.childNodes);
    const regex = new RegExp(searchText, "gi");
    const ops: Array<{ parent: HTMLElement; node: Node; html: string }> = [];

    const processTextNode = (node: Node): void => {
      const parentEl = node.parentElement;
      if (!parentEl || shouldSkipElement(parentEl)) return;
      const raw = node.textContent ?? "";
      const text = raw.trim();
      if (!text) return;
      const contentStrings = text.split(" ");
      let changed = false;
      const shouldWrapOff = (token: string): boolean => {
        return (
          !!token &&
          !token.includes('class="blink') &&
          !token.includes('<span class="blink') &&
          !!token.match(regex) === false
        );
      };
      for (let i = 0; i < contentStrings.length; i++) {
        const token = contentStrings[i];
        if (token.includes('<span class="blink')) continue;
        if (token.match(regex)) {
          contentStrings[i] = token.replace(regex, '<span class="blink">$&</span>');
          changed = true;
          for (let j = 1; j <= numSurroundingWords; j++) {
            const left = i - j;
            const right = i + j;
            if (left >= 0 && shouldWrapOff(contentStrings[left])) {
              contentStrings[left] = `<span class="blink-off">${contentStrings[left]}</span>`;
              changed = true;
            }
            if (right < contentStrings.length && shouldWrapOff(contentStrings[right])) {
              contentStrings[right] = `<span class="blink-off">${contentStrings[right]}</span>`;
              changed = true;
            }
          }
        }
      }
      if (!changed) return;
      const spanHTML = contentStrings.join(" ");
      const parent = node.parentNode as HTMLElement | null;
      if (!parent) return;
      ops.push({ parent, node, html: spanHTML });
    };

    const CHUNK = 600; // nodes per tick; smaller chunk for faster cancellation
    while (queue.length) {
      if (isCancelled()) return { ops: [] };
      let processed = 0;
      while (queue.length && processed < CHUNK) {
        const node = queue.shift()!;
        if (node.nodeType === Node.TEXT_NODE) {
          processTextNode(node);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          if (!shouldSkipElement(el)) {
            for (let i = 0; i < el.childNodes.length; i++) {
              queue.push(el.childNodes[i]);
            }
          }
        }
        processed++;
      }
      await new Promise((r) => setTimeout(r, 0));
    }
    return { ops };
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
  // Run traversal in chunks so cancellation can interrupt promptly
  const { ops } = await walkAndMatchAsync(document.body, searchTerm);
  if (isCancelled()) {
    return { blinkIntervalId: null, count: 0, currentIndex: null };
  }
  // Apply all queued DOM changes in one pass to avoid intermediate highlights
  for (let i = 0; i < ops.length; i++) {
    const { parent, node, html } = ops[i];
    const spanContainer = document.createElement("span");
    spanContainer.innerHTML = html;
    // parent may be detached; guard
    if (!parent || !node || !parent.contains(node)) continue;
    parent.replaceChild(spanContainer, node);
  }
  const blinkElementsApplied = document.querySelectorAll(".blink");
  setElementsHighlighted(blinkElementsApplied, true);
  blinkElementsApplied.forEach((el) => {
    (el as HTMLElement).style.fontSize = `${matchFontSize}px`;
  });
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

export function cancelSearchAndCleanup(): void {
  // Invalidate any ongoing search by setting a new token
  const setActiveToken = (token: number | null): void => {
    (window as unknown as { __accessibleFindActiveToken?: number | null }).
      __accessibleFindActiveToken = token;
  };
  setActiveToken(Math.floor(Date.now() ^ Math.random() * 1e9));
  const getBlinkIntervalId = (): number | null =>
    (window as unknown as { __accessibleFindBlinkIntervalId?: number | null }).
      __accessibleFindBlinkIntervalId ?? null;
  const setBlinkIntervalId = (id: number | null): void => {
    (
      window as unknown as { __accessibleFindBlinkIntervalId?: number | null }
    ).__accessibleFindBlinkIntervalId = id;
  };
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
  removeBlinkingStyles();
  (window as unknown as { __accessibleFindMatches?: HTMLElement[] }).__accessibleFindMatches = [];
  (window as unknown as { __accessibleFindCurrentIndex?: number | null }).__accessibleFindCurrentIndex = null;
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
