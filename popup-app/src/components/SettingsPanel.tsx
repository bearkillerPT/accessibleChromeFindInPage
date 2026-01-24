import React, { useEffect, useMemo, useState } from "react";
import { Section } from "./Section";
import { Label } from "./Label";
import { NumberInput } from "./NumberInput";
import { ColorInput } from "./ColorInput";

export type Settings = {
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

type ProfileSummary = { id: string; name: string; system?: boolean };

type SettingsPanelProps = {
  settings: Settings;
  onChange: (next: Settings) => void;
  onClose: () => void;
  onReset: () => void;
  onSave: () => void;
  profiles: ProfileSummary[];
  activeProfileId: string | null;
  onSelectProfile: (id: string) => void;
  onCreateProfile: () => void;
  onRenameProfile: (id: string, name: string) => void;
  onDeleteProfile: (id: string) => void;
  activeIsSystem?: boolean;
};

// WCAG contrast helpers
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function relLuminance({
  r,
  g,
  b,
}: {
  r: number;
  g: number;
  b: number;
}): number {
  const srgb = [r, g, b].map((c) => c / 255);
  const f = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const [R, G, B] = srgb.map(f);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(bgHex: string, fgHex: string): number | null {
  const bg = hexToRgb(bgHex);
  const fg = hexToRgb(fgHex);
  if (!bg || !fg) return null;
  const L1 = relLuminance(bg);
  const L2 = relLuminance(fg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function SettingsPanel({
  settings,
  onChange,
  onClose,
  onReset,
  onSave,
  profiles,
  activeProfileId,
  onSelectProfile,
  onCreateProfile,
  onRenameProfile,
  onDeleteProfile,
  activeIsSystem,
}: SettingsPanelProps) {
  // Shortcut status
  const [shortcut, setShortcut] = useState<string | null>(null);
  const [checking, setChecking] = useState<boolean>(true);
  const [renaming, setRenaming] = useState<boolean>(false);
  const [renameVal, setRenameVal] = useState<string>("");

  function getShortcutsUrl(): string {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("edg/")) return "edge://extensions/shortcuts";
    if (ua.includes("vivaldi")) return "vivaldi://extensions/shortcuts";
    if (ua.includes("opr/")) return "chrome://extensions/shortcuts";
    return "chrome://extensions/shortcuts";
  }

  useEffect(() => {
    let timer: number | null = null;
    function check() {
      try {
        // @ts-ignore chrome is available in extension context
        if (!(chrome && chrome.commands && chrome.commands.getAll)) {
          setChecking(false);
          setShortcut(null);
          return;
        }
        // @ts-ignore
        chrome.commands.getAll((cmds) => {
          const cmd = (cmds || []).find((c) => c.name === "open_popup");
          const sc =
            cmd && cmd.shortcut && cmd.shortcut.trim().length > 0
              ? cmd.shortcut
              : null;
          setShortcut(sc);
          setChecking(sc == null);
        });
      } catch {
        setChecking(false);
        setShortcut(null);
      }
    }
    check();
    timer = window.setInterval(check, 1500);
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, []);

  const statusText = useMemo(() => {
    if (shortcut) return `Shortcut set: ${shortcut}`;
    if (checking) return "Checking shortcut…";
    return "No shortcut set (waiting…)";
  }, [shortcut, checking]);

  function openShortcuts() {
    const url = getShortcutsUrl();
    try {
      const w = window.open(url, "_blank");
      if (w) return;
    } catch {}
    // Fallback via background
    // @ts-ignore
    chrome.runtime.sendMessage(
      { action: "openShortcuts" },
      (res: { ok: boolean } | null) => {
        if (res && res.ok) return;
        alert(
          `Please open ${url} and set a shortcut for "Open Accessible Find In Page popup" (not "Activate the extension").`
        );
      }
    );
  }

  const ratioHighlight = contrastRatio(
    settings.highlightBgColor,
    settings.highlightTextColor
  );
  const ratioSelected = contrastRatio(
    settings.selectedBgColor,
    settings.selectedTextColor
  );

  const warnHighlight = ratioHighlight !== null && ratioHighlight < 4.5;
  const warnSelected = ratioSelected !== null && ratioSelected < 4.5;

  return (
    <div
      id="settings-panel"
      role="dialog"
      aria-labelledby="settings-title"
      aria-describedby="settings-help"
      className="p-2 space-y-3"
    >
      <h2 id="settings-title" className="text-base font-semibold">
        Settings
      </h2>
      <p id="settings-help" className="text-xs text-slate-400">
        Tune highlight behavior and colors. All controls are
        keyboard-accessible; contrast warnings help choose readable colors.
      </p>

      {/* Keyboard shortcut section moved above profiles */}
      <div>
        <Section title="Keyboard Shortcut">
          <Label id="shortcutRow">Shortcut</Label>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 w-full">
            <span
              aria-live="polite"
              className={`text-xs rounded-full border px-2 py-0.5 ${
                shortcut
                  ? "border-emerald-500 text-emerald-300 bg-emerald-900/20"
                  : "border-amber-500 text-amber-300 bg-amber-900/20"
              } w-full sm:w-auto text-center sm:text-left break-words whitespace-pre-wrap`}
            >
              {statusText}
            </span>
            {checking && (
              <span
                aria-hidden
                className="w-3 h-3 rounded-full border-2 border-slate-600 border-t-blue-400 animate-spin self-center"
              />
            )}
            <button
              onClick={openShortcuts}
              className="text-xs bg-blue-600 hover:bg-blue-700 border border-blue-600 text-white rounded px-2 py-1 w-full sm:w-auto"
              aria-describedby="shortcutHelp"
            >
              Open shortcut settings
            </button>
          </div>

          <div className="w-full sm:col-span-2">
            <p className="text-xs text-slate-400" id="shortcutHelp">
              Set a key for{" "}
              <span className="font-semibold">
                "Open Accessible Find In Page popup"
              </span>{" "}
              (not
              <span className="font-semibold"> "Activate the extension"</span>).
            </p>
          </div>
        </Section>
      </div>

      {/* Profiles manager */}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs text-gray-300">Profile</label>
        {profiles.length > 0 ? (
          <select
            id="profile-select"
            className="text-sm bg-slate-900 text-gray-200 border border-slate-700 rounded px-2 py-1 w-full sm:w-auto"
            value={activeProfileId ?? ""}
            onChange={(e) => onSelectProfile(e.target.value)}
            aria-describedby="profile-help"
          >
            {/* User profiles */}
            {profiles
              .filter((p) => !p.system)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            {/* Separator and system optgroup */}
            {profiles.some((p) => p.system) && (
              <optgroup label="System">
                {profiles
                  .filter((p) => p.system)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </optgroup>
            )}
          </select>
        ) : (
          <span className="text-xs border border-slate-700 rounded px-2 py-1 text-gray-200 bg-slate-900">
            Default
          </span>
        )}

        {!renaming ? (
          <div className="flex flex-wrap items-center gap-1 w-full sm:w-auto">
            <button
              className="text-xs border border-slate-700 text-gray-200 rounded px-2 py-1 hover:bg-slate-800"
              onClick={() => onCreateProfile()}
              aria-label="Duplicate profile"
              title="Duplicate profile"
            >
              ⧉ Duplicate
            </button>
            <button
              className="text-xs border border-slate-700 text-gray-200 rounded px-2 py-1 hover:bg-slate-800 disabled:opacity-50"
              onClick={() => {
                const current = profiles.find(
                  (p) => p.id === (activeProfileId ?? "")
                );
                setRenameVal(current?.name ?? "");
                setRenaming(true);
              }}
              aria-label="Rename profile"
              title="Rename profile"
              disabled={
                !activeProfileId ||
                profiles.length === 0 ||
                (profiles.find((p) => p.id === activeProfileId)?.system ??
                  false)
              }
            >
              ✏️ Rename
            </button>
            <button
              className="text-xs border border-red-700 text-red-200 rounded px-2 py-1 hover:bg-red-900/30 disabled:opacity-50"
              onClick={() => {
                if (!activeProfileId) return;
                const ok = window.confirm("Delete current profile?");
                if (ok) onDeleteProfile(activeProfileId);
              }}
              aria-label="Delete profile"
              title="Delete profile"
              disabled={
                !activeProfileId ||
                profiles.filter((p) => !p.system).length <= 1 ||
                (profiles.find((p) => p.id === activeProfileId)?.system ??
                  false)
              }
            >
              🗑️ Delete
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1 w-full sm:w-auto">
            <input
              className="text-sm bg-slate-900 text-gray-200 border border-slate-700 rounded px-2 py-1 w-full sm:w-auto"
              value={renameVal}
              onChange={(e) => setRenameVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const name = renameVal.trim();
                  if (name && activeProfileId)
                    onRenameProfile(activeProfileId, name);
                  setRenaming(false);
                } else if (e.key === "Escape") {
                  setRenaming(false);
                }
              }}
              aria-label="New profile name"
              autoFocus
            />
            <button
              className="text-xs bg-blue-600 hover:bg-blue-700 border border-blue-600 text-white rounded px-2 py-1"
              onClick={() => {
                const name = renameVal.trim();
                if (name && activeProfileId)
                  onRenameProfile(activeProfileId, name);
                setRenaming(false);
              }}
            >
              Save
            </button>
            <button
              className="text-xs border border-slate-700 text-gray-200 rounded px-2 py-1 hover:bg-slate-800"
              onClick={() => setRenaming(false)}
            >
              Cancel
            </button>
          </div>
        )}
        <p id="profile-help" className="text-xs text-slate-400 w-full">
          Manage your settings profiles.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Section title="Blinking" disabled={!!activeIsSystem}>
          <Label id="blinkInterval">Interval (ms)</Label>
          <NumberInput
            id="blinkInterval"
            value={settings.blinkInterval}
            min={100}
            step={50}
            onChange={(val) => onChange({ ...settings, blinkInterval: val })}
          />

          <Label id="numBlinks"># Blinks</Label>
          <NumberInput
            id="numBlinks"
            value={settings.numBlinks}
            min={1}
            onChange={(val) => onChange({ ...settings, numBlinks: val })}
          />

          <Label id="numSurroundingWords">Surrounding words</Label>
          <NumberInput
            id="numSurroundingWords"
            value={settings.numSurroundingWords}
            min={0}
            onChange={(val) =>
              onChange({ ...settings, numSurroundingWords: val })
            }
          />
        </Section>

        <Section title="Size & Border Width" disabled={!!activeIsSystem}>
          <Label id="matchFontSize">Match font size (px)</Label>
          <NumberInput
            id="matchFontSize"
            value={settings.matchFontSize}
            min={8}
            onChange={(val) => onChange({ ...settings, matchFontSize: val })}
          />

          <Label id="borderWidth">Border width (px)</Label>
          <NumberInput
            id="borderWidth"
            value={settings.borderWidth}
            min={1}
            onChange={(val) => onChange({ ...settings, borderWidth: val })}
          />
        </Section>

        <Section title="Highlight Colors" disabled={!!activeIsSystem}>
          <Label id="highlightBgColor">Background</Label>
          <ColorInput
            id="highlightBgColor"
            value={settings.highlightBgColor}
            onChange={(val) => onChange({ ...settings, highlightBgColor: val })}
            describedBy="highlight-contrast"
          />

          <Label id="highlightTextColor">Text</Label>
          <ColorInput
            id="highlightTextColor"
            value={settings.highlightTextColor}
            onChange={(val) =>
              onChange({ ...settings, highlightTextColor: val })
            }
            describedBy="highlight-contrast"
          />

          <Label id="outlineColor">Border</Label>
          <ColorInput
            id="outlineColor"
            value={settings.outlineColor}
            onChange={(val) => onChange({ ...settings, outlineColor: val })}
          />

          <div className="text-xs text-slate-300 sm:col-span-2">Preview</div>
          <div
            className="flex items-center gap-2 flex-wrap sm:col-span-2"
            aria-live="polite"
          >
            <div
              className="rounded px-2 py-1 border"
              style={{
                background: settings.highlightBgColor,
                color: settings.highlightTextColor,
                borderColor: settings.outlineColor,
                borderWidth: `${settings.borderWidth}px`,
              }}
              aria-label="Highlight preview example"
            >
              Sample text
            </div>
          </div>
          <div className="sm:col-span-2">
            <span id="highlight-contrast" className="text-xs text-slate-300">
              Text–background contrast:{" "}
              {ratioHighlight ? ratioHighlight.toFixed(2) : "n/a"}{" "}
              {warnHighlight ? "(below 4.5:1)" : ""}
            </span>
          </div>
        </Section>

        <Section title="Selected Match Colors" disabled={!!activeIsSystem}>
          <Label id="selectedBgColor">Background</Label>
          <ColorInput
            id="selectedBgColor"
            value={settings.selectedBgColor}
            onChange={(val) => onChange({ ...settings, selectedBgColor: val })}
            describedBy="selected-contrast"
          />

          <Label id="selectedTextColor">Text</Label>
          <ColorInput
            id="selectedTextColor"
            value={settings.selectedTextColor}
            onChange={(val) =>
              onChange({ ...settings, selectedTextColor: val })
            }
            describedBy="selected-contrast"
          />

          <Label id="selectedBorderColor">Border</Label>
          <ColorInput
            id="selectedBorderColor"
            value={settings.selectedBorderColor}
            onChange={(val) =>
              onChange({ ...settings, selectedBorderColor: val })
            }
          />

          <div className="text-xs text-slate-300 sm:col-span-2">Preview</div>
          <div
            className="flex items-center gap-2 flex-wrap sm:col-span-2"
            aria-live="polite"
          >
            <div
              className="rounded px-2 py-1 border"
              style={{
                background: settings.selectedBgColor,
                color: settings.selectedTextColor,
                borderColor: settings.selectedBorderColor,
                borderWidth: `${settings.borderWidth}px`,
              }}
              aria-label="Selected preview example"
            >
              Selected text
            </div>
          </div>
          <div className="sm:col-span-2">
            <span id="selected-contrast" className="text-xs text-slate-300">
              Text–background contrast:{" "}
              {ratioSelected ? ratioSelected.toFixed(2) : "n/a"}{" "}
              {warnSelected ? "(below 4.5:1)" : ""}
            </span>
          </div>
        </Section>
      </div>
    </div>
  );
}
