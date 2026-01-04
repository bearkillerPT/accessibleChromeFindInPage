import { useEffect, useMemo, useState } from "react";

function getShortcutsUrl(): string {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("edg/")) return "edge://extensions/shortcuts";
  if (ua.includes("vivaldi")) return "vivaldi://extensions/shortcuts";
  if (ua.includes("opr/")) return "chrome://extensions/shortcuts";
  return "chrome://extensions/shortcuts";
}

export default function App() {
  const [iconUrl, setIconUrl] = useState<string>("");
  const [shortcut, setShortcut] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    try {
      setIconUrl(chrome.runtime.getURL("128.png"));
    } catch {}
  }, []);

  useEffect(() => {
    let timer: number | null = null;
    function check() {
      if (!(chrome && chrome.commands && chrome.commands.getAll)) {
        setChecking(false);
        setShortcut(null);
        return;
      }
      chrome.commands.getAll((cmds) => {
        const cmd = (cmds || []).find((c) => c.name === "open_popup");
        const sc =
          cmd && cmd.shortcut && cmd.shortcut.trim().length > 0
            ? cmd.shortcut
            : null;
        setShortcut(sc);
        setChecking(sc == null);
      });
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

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-4">
        {iconUrl && (
          <img
            src={iconUrl}
            alt="Accessible Find In Page icon"
            className="w-10 h-10 rounded-lg"
          />
        )}
        <div>
          <div className="text-2xl font-bold">Accessible Find In Page</div>
          <div className="text-slate-300">Quick setup guide</div>
        </div>
      </div>
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
        <h1 className="text-xl font-semibold mb-2">
          Welcome! Let’s set a shortcut
        </h1>
        <p className="text-slate-200 mb-3">
          Assign a keyboard shortcut to open the popup instantly.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={`text-sm rounded-full border px-3 py-1 ${
              shortcut
                ? "border-emerald-500 text-emerald-300 bg-emerald-900/20"
                : "border-amber-500 text-amber-300 bg-amber-900/20"
            }`}
          >
            {statusText}
          </span>
          {checking && (
            <span
              aria-hidden
              className="w-3.5 h-3.5 rounded-full border-2 border-slate-600 border-t-blue-400 animate-spin"
            />
          )}
          <button
            onClick={openShortcuts}
            className="text-sm bg-blue-600 hover:bg-blue-500 border border-blue-600 text-white rounded-md px-3 py-1"
          >
            Open shortcut settings
          </button>
        </div>
        <p className="text-slate-400 text-sm mt-4">
          In the shortcuts page, set a key for{" "}
          <span className="font-semibold">
            "Open Accessible Find In Page popup"
          </span>{" "}
          (not the default
          <span className="font-semibold"> "Activate the extension"</span>).
        </p>
        <hr className="border-slate-700 my-4" />
        <p className="text-slate-300">You can also:</p>
        <ul className="list-disc pl-6 text-slate-300">
          <li>Open the popup from the toolbar (pin the extension)</li>
          <li>
            Customize blinking, colors, border, and font size in the popup
            settings (gear icon)
          </li>
        </ul>
      </div>
    </div>
  );
}
