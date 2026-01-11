export interface Settings {
  blinkInterval: number;
  numBlinks: number;
  numSurroundingWords: number;
  highlightBgColor: string;
  highlightTextColor: string;
  outlineColor: string;
  borderWidth: number; // in px
  matchFontSize: number; // in px
  selectedBgColor: string;
  selectedBorderColor: string;
  selectedTextColor: string;
}

export interface Profile {
  id: string;
  name: string;
  settings: Settings;
  system?: boolean;
}

export interface ProfilesState {
  activeProfileId: string;
  profiles: Profile[];
}

export const defaultSettings: Settings = {
  blinkInterval: 400,
  numBlinks: 2,
  numSurroundingWords: 1,
  highlightBgColor: "#ffff00",
  highlightTextColor: "#000000",
  outlineColor: "#ff8c00",
  borderWidth: 3,
  matchFontSize: 20,
  selectedBgColor: "#ff8c00",
  selectedBorderColor: "#ffff00",
  selectedTextColor: "#ffffff",
};

function normalizeHex(hex: string): string {
  try {
    const m = hex.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
    if (!m) return hex;
    let h = m[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return `#${h.toLowerCase()}`;
  } catch {
    return hex;
  }
}

function normalizeSettings(s: Settings): Settings {
  const merged: Settings = { ...defaultSettings, ...s };
  return {
    ...merged,
    highlightBgColor: normalizeHex(merged.highlightBgColor),
    highlightTextColor: normalizeHex(merged.highlightTextColor),
    outlineColor: normalizeHex(merged.outlineColor),
    selectedBgColor: normalizeHex(merged.selectedBgColor),
    selectedBorderColor: normalizeHex(merged.selectedBorderColor),
    selectedTextColor: normalizeHex(merged.selectedTextColor),
  };
}

function makeDefaultProfile(): Profile {
  return {
    id: 'default',
    name: 'Default',
    settings: { ...defaultSettings },
  };
}

const SYSTEM_PROFILES: Profile[] = [
  // Designed to stand out on light pages
  {
    id: 'sys-hc-light',
    name: 'High Contrast (Light)',
    settings: normalizeSettings({
      ...defaultSettings,
      highlightBgColor: '#000000',
      highlightTextColor: '#ffff00',
      outlineColor: '#ffffff',
      selectedBgColor: '#000000',
      selectedTextColor: '#ffffff',
      selectedBorderColor: '#00ff00',
      borderWidth: Math.max(4, defaultSettings.borderWidth),
    }),
    system: true,
  },
  // Designed to stand out on dark pages
  {
    id: 'sys-hc-dark',
    name: 'High Contrast (Dark)',
    settings: normalizeSettings({
      ...defaultSettings,
      highlightBgColor: '#ffffff',
      highlightTextColor: '#000000',
      outlineColor: '#ffff00',
      selectedBgColor: '#ffffff',
      selectedTextColor: '#000000',
      selectedBorderColor: '#00ffff',
      borderWidth: Math.max(4, defaultSettings.borderWidth),
    }),
    system: true,
  },
  // Color Blind Safe: blue/orange pairing
  {
    id: 'sys-colorblind',
    name: 'Color Blind Mode',
    settings: normalizeSettings({
      ...defaultSettings,
      highlightBgColor: '#0072CE',
      highlightTextColor: '#ffffff',
      outlineColor: '#FFA500',
      selectedBgColor: '#FFA500',
      selectedTextColor: '#000000',
      selectedBorderColor: '#0072CE',
      borderWidth: Math.max(4, defaultSettings.borderWidth),
    }),
    system: true,
  },
];

export function getProfilesState(): Promise<ProfilesState> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      { settings: defaultSettings, profiles: null, activeProfileId: null },
      (raw) => {
        const existingProfiles = (raw as any).profiles as Profile[] | null;
        const existingActive = (raw as any).activeProfileId as string | null;
        let profiles: Profile[];
        let activeProfileId: string;

        if (Array.isArray(existingProfiles) && existingProfiles.length > 0) {
          profiles = existingProfiles.map((p) => ({
            ...p,
            settings: normalizeSettings(p.settings),
          }));
          // Active may point to a system profile; defer selection until after composing allProfiles
          activeProfileId = existingActive || profiles[0].id;
        } else {
          // Migrate from single settings
          const single = (raw as { settings?: Settings }).settings ?? defaultSettings;
          const normalized = normalizeSettings(single);
          const def = makeDefaultProfile();
          def.settings = normalized;
          profiles = [def];
          activeProfileId = def.id;
        }

        // Compose final list including system profiles (not stored)
        const allProfiles: Profile[] = [...profiles, ...SYSTEM_PROFILES];

        // Ensure active profile id exists in combined list; fallback to first user or first system
        if (!allProfiles.some((p) => p.id === activeProfileId)) {
          activeProfileId = (profiles[0]?.id) ?? SYSTEM_PROFILES[0].id;
        }

        // Keep legacy `settings` in sync with active profile (user or system)
        const active = allProfiles.find((p) => p.id === activeProfileId) ?? allProfiles[0];
        chrome.storage.sync.set(
          { profiles, activeProfileId, settings: active.settings },
          () => resolve({ profiles: allProfiles, activeProfileId })
        );
      }
    );
  });
}

export async function getSettings(): Promise<Settings> {
  const state = await getProfilesState();
  const active = state.profiles.find((p) => p.id === state.activeProfileId) ?? state.profiles[0];
  return active.settings;
}

export async function setSettings(settings: Settings): Promise<boolean> {
  const state = await getProfilesState();
  const userProfiles = state.profiles.filter((p) => !p.system);
  const isSystemActive = !userProfiles.some((p) => p.id === state.activeProfileId);
  if (isSystemActive) {
    // Ignore updates to system profiles; keep system presets immutable
    return new Promise((resolve) => {
      // Ensure storage reflects current active system settings
      const sys = state.profiles.find((p) => p.id === state.activeProfileId) ?? state.profiles[0];
      chrome.storage.sync.set({ profiles: userProfiles, activeProfileId: state.activeProfileId, settings: sys.settings }, () => resolve(true));
    });
  }
  const updated = userProfiles.map((p) =>
    p.id === state.activeProfileId ? { ...p, settings: normalizeSettings(settings) } : p
  );
  const active = updated.find((p) => p.id === state.activeProfileId) ?? updated[0];
  return new Promise((resolve) => {
    chrome.storage.sync.set({ profiles: updated, activeProfileId: state.activeProfileId, settings: active.settings }, () => resolve(true));
  });
}

export async function setActiveProfile(profileId: string): Promise<ProfilesState> {
  const state = await getProfilesState();
  const all = state.profiles;
  const userProfiles = all.filter((p) => !p.system);
  const target = all.find((p) => p.id === profileId) ?? all[0];
  return new Promise((resolve) => {
    // Persist only user profiles; but set activeProfileId and settings to the chosen profile
    chrome.storage.sync.set(
      { profiles: userProfiles, activeProfileId: target.id, settings: target.settings },
      () => resolve({ profiles: [...userProfiles, ...SYSTEM_PROFILES], activeProfileId: target.id })
    );
  });
}

export async function createProfile(name: string, baseSettings?: Settings): Promise<ProfilesState> {
  const state = await getProfilesState();
  const id = Math.floor(Date.now() + Math.random() * 1e6).toString(36);
  const profile: Profile = {
    id,
    name: name && name.trim().length > 0 ? name.trim() : 'New Profile',
    settings: normalizeSettings(baseSettings ?? defaultSettings),
  };
  const userProfiles = state.profiles.filter((p) => !p.system);
  const profiles = [...userProfiles, profile];
  return new Promise((resolve) => {
    chrome.storage.sync.set({ profiles, activeProfileId: id, settings: profile.settings }, () => resolve({ profiles: [...profiles, ...SYSTEM_PROFILES], activeProfileId: id }));
  });
}

export async function renameProfile(profileId: string, newName: string): Promise<ProfilesState> {
  const state = await getProfilesState();
  if (SYSTEM_PROFILES.some((p) => p.id === profileId)) {
    return { profiles: state.profiles, activeProfileId: state.activeProfileId };
  }
  const userProfiles = state.profiles.filter((p) => !p.system);
  const profiles = userProfiles.map((p) => (p.id === profileId ? { ...p, name: newName.trim() || p.name } : p));
  return new Promise((resolve) => {
    chrome.storage.sync.set({ profiles }, () => resolve({ profiles: [...profiles, ...SYSTEM_PROFILES], activeProfileId: state.activeProfileId }));
  });
}

export async function deleteProfile(profileId: string): Promise<ProfilesState> {
  const state = await getProfilesState();
  if (SYSTEM_PROFILES.some((p) => p.id === profileId)) {
    return { profiles: state.profiles, activeProfileId: state.activeProfileId };
  }
  let profiles = state.profiles.filter((p) => !p.system).filter((p) => p.id !== profileId);
  if (profiles.length === 0) {
    const def = makeDefaultProfile();
    profiles = [def];
  }
  let activeProfileId = state.activeProfileId;
  const allAfter = [...profiles, ...SYSTEM_PROFILES];
  if (!allAfter.some((p) => p.id === activeProfileId)) {
    activeProfileId = profiles[0]?.id ?? SYSTEM_PROFILES[0].id;
  }
  const active = allAfter.find((p) => p.id === activeProfileId) ?? allAfter[0];
  return new Promise((resolve) => {
    chrome.storage.sync.set({ profiles, activeProfileId, settings: active.settings }, () => resolve({ profiles: [...profiles, ...SYSTEM_PROFILES], activeProfileId }));
  });
}
