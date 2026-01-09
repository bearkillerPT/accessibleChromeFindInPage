import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";

type Settings = {
  blinkInterval: number;
  numBlinks: number;
  numSurroundingWords: number;
  highlightBgColor: string;
  highlightTextColor: string;
  outlineColor: string;
  borderWidth: number;
  matchFontSize: number;
  selectedBgColor: string;
  selectedBorderColor: string;
  selectedTextColor: string;
};

type FindResponse = {
  ok: boolean;
  count?: number;
  currentIndex?: number | null;
};

type NavigateResponse = {
  ok: boolean;
  count?: number;
  currentIndex?: number | null;
};

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [count, setCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [needsShortcut, setNeedsShortcut] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  // No debounce; background/page handle cancellation

  const findMutation = useMutation<FindResponse | null, unknown, string>({
    mutationFn: async (term: string) =>
      await new Promise<FindResponse | null>((resolve) => {
        try {
          chrome.runtime.sendMessage(
            { action: "findInPage", searchTerm: term },
            (response: FindResponse | null) => {
              resolve(response ?? null);
            }
          );
        } catch {
          resolve({ ok: false, count: 0, currentIndex: null });
        }
      }),
    onSuccess: (response) => {
      if (response && response.ok) {
        setCount(response.count ?? 0);
        setCurrentIndex(
          typeof response.currentIndex === "number"
            ? response.currentIndex!
            : null
        );
      }
    },
  });

  useEffect(() => {
    chrome.runtime.sendMessage(
      { action: "getSettings" },
      (response: Settings | null) => {
        if (response) {
          setSettings(response);
        }
      }
    );
  }, []);

  // Autofocus the search input when the popup opens and respond to focus requests
  useEffect(() => {
    // Focus and select any existing text for quick replacement
    inputRef.current?.focus();
    inputRef.current?.select();

    const onMessage = (e: MessageEvent) => {
      const data = e?.data as { type?: string } | undefined;
      if (!data) return;
      if (data.type === "focusInput") {
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      if (data.type === "requestClose") {
        // Mirror onClose behavior without relying on page context
        try {
          chrome.runtime.sendMessage({ action: "findInPage", searchTerm: "" }, () => {
            chrome.runtime.sendMessage({ action: "closeOverlay" });
          });
        } catch {
          chrome.runtime.sendMessage({ action: "closeOverlay" });
        }
        return;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Clear search and close overlay on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Reset the search in the active tab
        try {
          chrome.runtime.sendMessage(
            { action: "findInPage", searchTerm: "" },
            () => {
              setSearchTerm("");
              chrome.runtime.sendMessage({ action: "closeOverlay" });
            }
          );
        } catch {
          setSearchTerm("");
          chrome.runtime.sendMessage({ action: "closeOverlay" });
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Clear search when the popup is closed/unmounted
  useEffect(() => {
    return () => {
      try {
        chrome.runtime.sendMessage({ action: "findInPage", searchTerm: "" });
      } catch {
        // Ignore if runtime is unavailable, e.g., during unload
      }
    };
  }, []);

  // Report natural size to parent so iframe can autosize
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const sendSize = () => {
      const width = Math.ceil(el.scrollWidth);
      const height = Math.ceil(el.scrollHeight);
      try {
        window.parent?.postMessage({ type: "accessible-find:size", width, height }, "*");
      } catch {}
    };
    // Initial send + observe for changes
    sendSize();
    const ro = new ResizeObserver(() => sendSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [rootRef, open, settings, searchTerm, count, currentIndex]);

  useEffect(() => {
    // Check whether the keyboard shortcut is assigned; if not, prompt the user
    try {
      chrome.commands.getAll((cmds) => {
        const openPopup = cmds?.find((c) => c.name === "open_popup");
        const hasShortcut =
          !!openPopup?.shortcut && openPopup.shortcut.trim().length > 0;
        setNeedsShortcut(!hasShortcut);
      });
    } catch {
      // Ignore if commands API not available in this context
    }
  }, []);

  const canSave = useMemo(() => !!settings, [settings]);

  function saveSettings() {
    if (!settings) return;
    chrome.runtime.sendMessage({ action: "setSettings", settings }, () => {
      setOpen(false);
      // If there's an active search term, re-run search to apply new styles immediately
      if (searchTerm && searchTerm.trim().length > 0) {
        findMutation.mutate(searchTerm);
      }
    });
  }

  function onTermChange(v: string) {
    setSearchTerm(v);
    // Send immediately; cancellation handled in background/page
    findMutation.mutate(v);
  }

  function navigate(direction: "next" | "prev") {
    chrome.runtime.sendMessage(
      { action: "navigateMatch", direction },
      (response: NavigateResponse | null) => {
        setCount(response?.count ?? 0);
        setCurrentIndex(
          typeof response?.currentIndex === "number"
            ? response!.currentIndex!
            : null
        );
      }
    );
  }

  function onPrev() {
    navigate("prev");
  }

  function onNext() {
    navigate("next");
  }

  function onClose() {
    try {
      chrome.runtime.sendMessage({ action: "findInPage", searchTerm: "" }, () => {
        setSearchTerm("");
        chrome.runtime.sendMessage({ action: "closeOverlay" });
      });
    } catch {
      setSearchTerm("");
      chrome.runtime.sendMessage({ action: "closeOverlay" });
    }
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) onPrev(); else onNext();
    }
  }

  return (
    <div ref={rootRef} className="flex flex-col p-2 gap-2 bg-slate-900 text-gray-200 overflow-hidden border border-slate-700 rounded-md shadow-lg">
      {needsShortcut && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs rounded p-2">
          <div className="flex items-center justify-between gap-2">
            <span>
              Set a keyboard shortcut for{" "}
              <strong>"Open Accessible Find In Page popup"</strong> (not
              "Activate the extension").
            </span>
            <button
              className="border rounded px-2 py-0.5 hover:bg-yellow-100"
              onClick={() => {
                const ua = navigator.userAgent.toLowerCase();
                const url = ua.includes("edg/")
                  ? "edge://extensions/shortcuts"
                  : ua.includes("vivaldi")
                  ? "vivaldi://extensions/shortcuts"
                  : "chrome://extensions/shortcuts";

                chrome.runtime.sendMessage(
                  { action: "openShortcuts" },
                  async (res: { ok: boolean; error?: string } | null) => {
                    if (res && res.ok) return;
                    alert(
                      "Please open " +
                        url +
                        ' and set a shortcut for "Open Accessible Find In Page popup" (not "Activate the extension").'
                    );
                  }
                );
              }}
            >
              Open shortcut settings
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          className="text-xl"
          title="Settings"
          onClick={() => setOpen((o) => !o)}
        >
          ⚙️
        </button>
        <input
          ref={inputRef}
          autoFocus
          value={searchTerm}
          onChange={(e) => onTermChange(e.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder="Find in Page"
          className="flex-1 min-w-0 border border-slate-700 rounded px-2 py-1 text-sm bg-slate-800 text-gray-200 placeholder:text-slate-400"
        />
        <div className="flex items-center gap-1">
          {findMutation.isPending ? (
            <span className="text-xs text-slate-400 min-w-12 text-right inline-flex items-center justify-end">
              <span className="inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            </span>
          ) : (
            <span className="text-xs text-gray-300 min-w-12 text-right">
              {currentIndex !== null && count > 0
                ? `${currentIndex + 1}/${count}`
                : `${count}/${count}`}
            </span>
          )}
          <button
            className="border border-slate-700 rounded px-1 text-xs bg-slate-800 hover:bg-slate-700"
            title="Previous"
            onClick={onPrev}
            disabled={count === 0 || findMutation.isPending}
          >
            ▲
          </button>
          <button
            className="border border-slate-700 rounded px-1 text-xs bg-slate-800 hover:bg-slate-700"
            title="Next"
            onClick={onNext}
            disabled={count === 0 || findMutation.isPending}
          >
            ▼
          </button>
          <button
            className="border border-slate-700 rounded px-2 text-sm ml-1 bg-slate-800 hover:bg-slate-700"
            title="Close"
            onClick={onClose}
          >
            ✖
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {settings && (
          <motion.div
            key="settings"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.65, 0.3, 0.9] }}
            style={{ overflow: "hidden" }}
            className="border border-slate-700 rounded bg-slate-800"
          >
            <div className="p-2 grid grid-cols-2 gap-2">
              <label className="text-sm col-span-2 font-semibold">Blinking</label>
          <label className="text-xs">Interval (ms)</label>
          <input
            type="number"
            className="border border-slate-700 rounded px-2 py-1 text-sm bg-slate-900 text-gray-200"
            min={100}
            step={50}
            value={settings.blinkInterval}
            onChange={(e) =>
              setSettings({
                ...settings!,
                blinkInterval: Number(e.target.value),
              })
            }
          />
          <label className="text-xs"># Blinks</label>
          <input
            type="number"
            className="border border-slate-700 rounded px-2 py-1 text-sm bg-slate-900 text-gray-200"
            min={1}
            value={settings.numBlinks}
            onChange={(e) =>
              setSettings({ ...settings!, numBlinks: Number(e.target.value) })
            }
          />
          <label className="text-xs">Surrounding words</label>
          <input
            type="number"
            className="border border-slate-700 rounded px-2 py-1 text-sm bg-slate-900 text-gray-200"
            min={0}
            value={settings.numSurroundingWords}
            onChange={(e) =>
              setSettings({
                ...settings!,
                numSurroundingWords: Number(e.target.value),
              })
            }
          />

          <label className="text-sm col-span-2 font-semibold mt-1">
            Colors
          </label>
          <label className="text-xs">Highlight background</label>
          <input
            type="color"
            className="border border-slate-700 rounded px-2 py-1 bg-slate-900"
            value={settings.highlightBgColor}
            onChange={(e) =>
              setSettings({ ...settings!, highlightBgColor: e.target.value })
            }
          />
          <label className="text-xs">Highlight text</label>
          <input
            type="color"
            className="border border-slate-700 rounded px-2 py-1 bg-slate-900"
            value={settings.highlightTextColor}
            onChange={(e) =>
              setSettings({ ...settings!, highlightTextColor: e.target.value })
            }
          />
          <label className="text-xs">Border color</label>
          <input
            type="color"
            className="border border-slate-700 rounded px-2 py-1 bg-slate-900"
            value={settings.outlineColor}
            onChange={(e) =>
              setSettings({ ...settings!, outlineColor: e.target.value })
            }
          />
          <label className="text-xs">Border width (px)</label>
          <input
            type="number"
            className="border border-slate-700 rounded px-2 py-1 text-sm bg-slate-900 text-gray-200"
            min={1}
            value={settings.borderWidth}
            onChange={(e) =>
              setSettings({
                ...settings!,
                borderWidth: Number(e.target.value),
              })
            }
          />

          <label className="text-xs">Match font size (px)</label>
          <input
            type="number"
            className="border border-slate-700 rounded px-2 py-1 text-sm bg-slate-900 text-gray-200"
            min={8}
            value={settings.matchFontSize}
            onChange={(e) =>
              setSettings({
                ...settings!,
                matchFontSize: Number(e.target.value),
              })
            }
          />
          <label className="text-xs">Selected background</label>
          <input
            type="color"
            className="border border-slate-700 rounded px-2 py-1 bg-slate-900"
            value={settings.selectedBgColor}
            onChange={(e) =>
              setSettings({ ...settings!, selectedBgColor: e.target.value })
            }
          />
          <label className="text-xs">Selected text</label>
          <input
            type="color"
            className="border border-slate-700 rounded px-2 py-1 bg-slate-900"
            value={settings.selectedTextColor}
            onChange={(e) =>
              setSettings({ ...settings!, selectedTextColor: e.target.value })
            }
          />
          <label className="text-xs">Selected border color</label>
          <input
            type="color"
            className="border border-slate-700 rounded px-2 py-1 bg-slate-900"
            value={settings.selectedBorderColor}
            onChange={(e) =>
              setSettings({ ...settings!, selectedBorderColor: e.target.value })
            }
          />

              <div className="col-span-2 flex justify-end gap-2 mt-2">
            <button
              className="border border-slate-700 rounded px-3 py-1 text-sm bg-slate-900 hover:bg-slate-800"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
            <button
              className="border border-slate-700 rounded px-3 py-1 text-sm bg-slate-900 hover:bg-slate-800"
              onClick={() => {
                chrome.runtime.sendMessage({ action: 'resetSettings' }, (resp: { ok: boolean; settings?: Settings } | null) => {
                  if (resp && resp.ok && resp.settings) {
                    setSettings(resp.settings);
                    // Re-run search if term is active to apply defaults immediately
                    if (searchTerm && searchTerm.trim().length > 0) {
                      findMutation.mutate(searchTerm);
                    }
                  }
                });
              }}
            >
              Reset to defaults
            </button>
            <button
              className="bg-blue-600 text-white rounded px-3 py-1 text-sm disabled:opacity-50 hover:bg-blue-700"
              onClick={saveSettings}
              disabled={!canSave}
            >
              Save
            </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
