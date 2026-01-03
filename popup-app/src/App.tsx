import { useEffect, useMemo, useState } from 'react';

type Settings = {
  blinkInterval: number;
  numBlinks: number;
  numSurroundingWords: number;
  highlightBgColor: string;
  highlightTextColor: string;
  outlineColor: string;
  outlineWidth: number;
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
  const [searchTerm, setSearchTerm] = useState('');
  const [count, setCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);

  useEffect(() => {
    chrome.runtime.sendMessage({ action: 'getSettings' }, (response: Settings | null) => {
      if (response) {
        setSettings(response);
      }
    });
  }, []);

  const canSave = useMemo(() => !!settings, [settings]);

  function saveSettings() {
    if (!settings) return;
    chrome.runtime.sendMessage({ action: 'setSettings', settings }, () => {
      setOpen(false);
      // If there's an active search term, re-run search to apply new styles immediately
      if (searchTerm && searchTerm.trim().length > 0) {
        chrome.runtime.sendMessage({ action: 'findInPage', searchTerm }, (response: FindResponse | null) => {
          setCount(response?.count ?? 0);
          setCurrentIndex(typeof response?.currentIndex === 'number' ? response!.currentIndex! : null);
        });
      }
    });
  }

  function onTermChange(v: string) {
    setSearchTerm(v);
    chrome.runtime.sendMessage({ action: 'findInPage', searchTerm: v }, (response: FindResponse | null) => {
      setCount(response?.count ?? 0);
      setCurrentIndex(typeof response?.currentIndex === 'number' ? response!.currentIndex! : null);
    });
  }

  function navigate(direction: 'next' | 'prev') {
    chrome.runtime.sendMessage({ action: 'navigateMatch', direction }, (response: NavigateResponse | null) => {
      setCount(response?.count ?? 0);
      setCurrentIndex(typeof response?.currentIndex === 'number' ? response!.currentIndex! : null);
    });
  }

  return (
    <div className="flex flex-col p-2 gap-2">
      <div className="flex items-center gap-2">
        <button
          className="text-xl"
          title="Settings"
          onClick={() => setOpen((o) => !o)}
        >⚙️</button>
        <input
          value={searchTerm}
          onChange={(e) => onTermChange(e.target.value)}
          placeholder="Find in Page"
          className="flex-1 border rounded px-2 py-1 text-sm"
        />
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-700 min-w-12 text-right">
            {currentIndex !== null && count > 0 ? `${currentIndex + 1}/${count}` : `${count}/${count}`}
          </span>
          <button
            className="border rounded px-1 text-xs"
            title="Previous"
            onClick={() => navigate('prev')}
            disabled={count === 0}
          >▲</button>
          <button
            className="border rounded px-1 text-xs"
            title="Next"
            onClick={() => navigate('next')}
            disabled={count === 0}
          >▼</button>
        </div>
      </div>

      {open && settings && (
        <div className="border rounded p-2 grid grid-cols-2 gap-2">
          <label className="text-sm col-span-2 font-semibold">Blinking</label>
          <label className="text-xs">Interval (ms)</label>
          <input type="number" className="border rounded px-2 py-1 text-sm" min={100} step={50}
            value={settings.blinkInterval}
            onChange={(e) => setSettings({ ...settings!, blinkInterval: Number(e.target.value) })}
          />
          <label className="text-xs"># Blinks</label>
          <input type="number" className="border rounded px-2 py-1 text-sm" min={1}
            value={settings.numBlinks}
            onChange={(e) => setSettings({ ...settings!, numBlinks: Number(e.target.value) })}
          />
          <label className="text-xs">Surrounding words</label>
          <input type="number" className="border rounded px-2 py-1 text-sm" min={0}
            value={settings.numSurroundingWords}
            onChange={(e) => setSettings({ ...settings!, numSurroundingWords: Number(e.target.value) })}
          />

          <label className="text-sm col-span-2 font-semibold mt-1">Colors</label>
          <label className="text-xs">Highlight background</label>
          <input type="color" className="border rounded px-2 py-1"
            value={settings.highlightBgColor}
            onChange={(e) => setSettings({ ...settings!, highlightBgColor: e.target.value })}
          />
          <label className="text-xs">Highlight text</label>
          <input type="color" className="border rounded px-2 py-1"
            value={settings.highlightTextColor}
            onChange={(e) => setSettings({ ...settings!, highlightTextColor: e.target.value })}
          />
          <label className="text-xs">Border color</label>
          <input type="color" className="border rounded px-2 py-1"
            value={settings.outlineColor}
            onChange={(e) => setSettings({ ...settings!, outlineColor: e.target.value })}
          />
          <label className="text-xs">Border width (px)</label>
          <input type="number" className="border rounded px-2 py-1 text-sm" min={1}
            value={settings.outlineWidth}
            onChange={(e) => setSettings({ ...settings!, outlineWidth: Number(e.target.value) })}
          />

          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <button className="border rounded px-3 py-1 text-sm" onClick={() => setOpen(false)}>Close</button>
            <button className="bg-blue-600 text-white rounded px-3 py-1 text-sm disabled:opacity-50" onClick={saveSettings} disabled={!canSave}>Save</button>
          </div>
        </div>
      )}
    </div>
  );
}
