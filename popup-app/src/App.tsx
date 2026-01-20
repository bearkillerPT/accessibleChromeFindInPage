import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import {
  SettingsPanel,
  type Settings as PanelSettings,
} from "./components/SettingsPanel";

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
  const [savedSettings, setSavedSettings] = useState<Settings | null>(null);
  const [profiles, setProfiles] = useState<
    Array<{ id: string; name: string; system?: boolean }>
  >([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [count, setCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [needsShortcut, setNeedsShortcut] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

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
      { action: "getProfiles" },
      (
        response: {
          ok: boolean;
          state?: {
            profiles: Array<{ id: string; name: string; settings: Settings }>;
            activeProfileId: string;
          };
        } | null
      ) => {
        const state = response?.state;
        if (
          state &&
          Array.isArray(state.profiles) &&
          state.profiles.length > 0
        ) {
          setProfiles(
            state.profiles.map((p) => ({
              id: p.id,
              name: p.name,
              system: (p as any).system || false,
            }))
          );
          setActiveProfileId(state.activeProfileId);
          const active =
            state.profiles.find((p) => p.id === state.activeProfileId) ||
            state.profiles[0];
          setSettings(active.settings);
          setSavedSettings(active.settings);
        } else {
          // Fallback to legacy single settings (background will migrate when first profile action occurs)
          chrome.runtime.sendMessage(
            { action: "getSettings" },
            (s: Settings | null) => {
              if (s) {
                setSettings(s);
                setSavedSettings(s);
              }
            }
          );
        }
      }
    );
  }, []);

  function refreshProfilesAndActiveSettings(): void {
    chrome.runtime.sendMessage(
      { action: "getProfiles" },
      (
        response: {
          ok: boolean;
          state?: {
            profiles: Array<{ id: string; name: string; settings: Settings }>;
            activeProfileId: string;
          };
        } | null
      ) => {
        const state = response?.state;
        if (
          state &&
          Array.isArray(state.profiles) &&
          state.profiles.length > 0
        ) {
          setProfiles(
            state.profiles.map((p) => ({
              id: p.id,
              name: p.name,
              system: (p as any).system || false,
            }))
          );
          setActiveProfileId(state.activeProfileId);
          const active =
            state.profiles.find((p) => p.id === state.activeProfileId) ||
            state.profiles[0];
          setSettings(active.settings);
          setSavedSettings(active.settings);
        }
      }
    );
  }

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
        // Animate exit then request overlay close
        setVisible(false);
        const EXIT_MS = 200;
        window.setTimeout(() => {
          try {
            chrome.runtime.sendMessage(
              { action: "findInPage", searchTerm: "" },
              () => {
                chrome.runtime.sendMessage({ action: "closeOverlay" });
              }
            );
          } catch {
            chrome.runtime.sendMessage({ action: "closeOverlay" });
          }
        }, EXIT_MS);
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
        // Animate exit, then reset search and close overlay
        setVisible(false);
        const EXIT_MS = 200;
        window.setTimeout(() => {
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
        }, EXIT_MS);
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
      const measuredWidth = Math.ceil(el.scrollWidth);
      const rect = el.getBoundingClientRect();
      const BASE_COMPACT = 360;
      const BASE_OPEN = 640;
      const MAX_WIDTH = 760;
      const minPreferred = open ? BASE_OPEN : BASE_COMPACT;
      let width = Math.max(measuredWidth, minPreferred);
      width = Math.min(width, MAX_WIDTH);
      const measuredHeight = Math.ceil(rect.height);
      const height = measuredHeight + 1;
      try {
        window.parent?.postMessage(
          { type: "accessible-find:size", width, height },
          "*"
        );
      } catch {}
    };
    // Initial send + observe for changes
    sendSize();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => sendSize());
    });
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
  const isDirty = useMemo(() => {
    if (!settings || !savedSettings) return false;
    try {
      return JSON.stringify(settings) !== JSON.stringify(savedSettings);
    } catch {
      return false;
    }
  }, [settings, savedSettings]);
  const activeIsSystem = useMemo(() => {
    if (!activeProfileId) return false;
    const p = profiles.find((p) => p.id === activeProfileId);
    return !!p?.system;
  }, [activeProfileId, profiles]);

  function saveSettings() {
    if (!settings) return;
    chrome.runtime.sendMessage({ action: "setSettings", settings }, () => {
      setSavedSettings(settings);
      setOpen(false);
      // If there's an active search term, re-run search to apply new styles immediately
      if (searchTerm && searchTerm.trim().length > 0) {
        findMutation.mutate(searchTerm);
      }
      // Refresh profiles state to reflect any normalization
      chrome.runtime.sendMessage(
        { action: "getProfiles" },
        (
          response: {
            ok: boolean;
            state?: {
              profiles: Array<{ id: string; name: string; settings: Settings }>;
              activeProfileId: string;
            };
          } | null
        ) => {
          const state = response?.state;
          if (state) {
            setProfiles(
              state.profiles.map((p) => ({ id: p.id, name: p.name }))
            );
            setActiveProfileId(state.activeProfileId);
          }
        }
      );
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
    // Trigger exit animation first, then close overlay
    setVisible(false);
    const EXIT_MS = 200;
    window.setTimeout(() => {
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
    }, EXIT_MS);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) onPrev();
      else onNext();
    }
  }

  return (
    <AnimatePresence initial={true}>
      {visible && (
        <motion.div
          key="popup-root"
          ref={rootRef as any}
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col p-2 gap-2 bg-slate-900 text-gray-200 overflow-x-hidden overflow-y-auto border border-slate-700 rounded-md shadow-lg"
        >
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
          <div className="flex items-center gap-2 self-start max-w-full">
            <button
              className="text-xl"
              title="Settings"
              aria-label="Toggle settings"
              aria-expanded={open}
              aria-controls="settings-panel"
              onClick={() => setOpen((o) => !o)}
            >
              ⚙️
            </button>
            <div className="max-w-full">
              <label htmlFor="search-input" className="sr-only">
                Search term
              </label>
              <input
                id="search-input"
                ref={inputRef}
                autoFocus
                value={searchTerm}
                onChange={(e) => onTermChange(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Find in Page"
                aria-describedby="search-help"
                className="w-64 max-w-full border border-slate-700 rounded px-2 py-1 text-sm bg-slate-800 text-gray-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p id="search-help" className="sr-only">
                Type to search. Press Enter for next, Shift+Enter for previous.
              </p>
            </div>
            <div className="flex items-center gap-1">
              {findMutation.isPending ? (
                <span className="text-xs text-slate-400 min-w-12 text-right inline-flex items-center justify-end">
                  <span className="inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                </span>
              ) : (
                <span
                  className="text-s text-gray-300 min-w-12 text-right"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {currentIndex !== null && count > 0
                    ? `${currentIndex + 1}/${count}`
                    : `${count}/${count}`}
                </span>
              )}
              <button
                className="border border-slate-700 rounded px-1 text-xs bg-slate-800 hover:bg-slate-700"
                title="Previous (Shift+Enter)"
                aria-label="Previous match"
                onClick={onPrev}
                disabled={count === 0 || findMutation.isPending}
              >
                ▲
              </button>
              <button
                className="border border-slate-700 rounded px-1 text-xs bg-slate-800 hover:bg-slate-700"
                title="Next (Enter)"
                aria-label="Next match"
                onClick={onNext}
                disabled={count === 0 || findMutation.isPending}
              >
                ▼
              </button>
              <button
                className="border border-slate-700 rounded px-2 text-sm ml-1 bg-slate-800 hover:bg-slate-700"
                title="Close"
                aria-label="Close popup"
                onClick={onClose}
              >
                ✖
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {open && settings && (
              <motion.div
                key="settings"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.2, 0.65, 0.3, 0.9] }}
                style={{ overflowX: "hidden" }}
                className="settings-root settings-panel-shell border border-slate-700 rounded bg-slate-800 flex flex-col"
              >
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <div className="p-2">
                    <SettingsPanel
                      settings={settings as PanelSettings}
                      onChange={(next) => setSettings(next)}
                      onClose={() => {}}
                      onReset={() => {}}
                      onSave={() => {}}
                      profiles={profiles}
                      activeProfileId={activeProfileId}
                      activeIsSystem={activeIsSystem}
                      onSelectProfile={(id) => {
                        chrome.runtime.sendMessage(
                          { action: "setActiveProfile", profileId: id },
                          (_response: any) => {
                            refreshProfilesAndActiveSettings();
                            if (searchTerm && searchTerm.trim().length > 0)
                              findMutation.mutate(searchTerm);
                          }
                        );
                      }}
                      onCreateProfile={() => {
                        const tempId =
                          "local-" +
                          Math.floor(Date.now() + Math.random() * 1e6).toString(
                            36
                          );
                        const tempName = "New Profile";
                        setProfiles((prev) => [
                          ...prev,
                          { id: tempId, name: tempName },
                        ]);
                        setActiveProfileId(tempId);
                        chrome.runtime.sendMessage(
                          {
                            action: "createProfile",
                            baseSettings: settings as Settings,
                          },
                          (_response: any) => {
                            refreshProfilesAndActiveSettings();
                          }
                        );
                      }}
                      onRenameProfile={(id, name) => {
                        chrome.runtime.sendMessage(
                          { action: "renameProfile", profileId: id, name },
                          (_response: any) => {
                            refreshProfilesAndActiveSettings();
                          }
                        );
                      }}
                      onDeleteProfile={(id) => {
                        chrome.runtime.sendMessage(
                          { action: "deleteProfile", profileId: id },
                          (_response: any) => {
                            refreshProfilesAndActiveSettings();
                            if (searchTerm && searchTerm.trim().length > 0)
                              findMutation.mutate(searchTerm);
                          }
                        );
                      }}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-slate-700 p-2 mb-4 bg-slate-800">
                  <button
                    className="border border-slate-700 rounded px-3 py-1 text-sm bg-slate-900 hover:bg-slate-800 flex-[1_1_140px] sm:flex-initial"
                    onClick={() => setOpen(false)}
                  >
                    Close
                  </button>
                  <button
                    className="bg-blue-600 text-white rounded px-3 py-1 text-sm disabled:opacity-50 hover:bg-blue-700 flex-[1_1_140px] sm:flex-initial"
                    disabled={!!activeIsSystem || !isDirty}
                    onClick={saveSettings}
                  >
                    Save
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
