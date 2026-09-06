/**
 * The one place app-wide state lives.
 *
 * A React CONTEXT is a value any component can read without it being passed
 * down through every layer in between. Settings and profiles are needed
 * almost everywhere, so threading them by hand would mean every component in
 * the middle taking props it does not use.
 *
 * The store owns three things: settings, profiles, and the saved game. It
 * writes to localStorage on every change, and it keeps the audio module in
 * step with the sound and music switches.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import { setMusicEnabled, setSoundEnabled, unlockAudio } from "../audio/sound";
import type { GameId } from "../engine/types";
import { translate } from "../lib/i18n";
import type { MessageArgs } from "../lib/i18n";
import type { Achievement, GameResult } from "./achievements";
import { applyResult, markFirstRoll } from "./achievements";
import { clearAll, createProfile, emptyData, load, save } from "./storage";
import type { AppData, Profile, SavedGame, Settings } from "./types";

interface Store {
  data: AppData;
  settings: Settings;
  profiles: Profile[];
  activeProfile: Profile | null;
  /** Translate a key in the currently selected language. */
  t: (key: string, args?: MessageArgs) => string;

  updateSettings: (patch: Partial<Settings>) => void;
  addProfile: (name: string, avatar: string, color: Profile["color"]) => Profile;
  removeProfile: (id: string) => void;
  selectProfile: (id: string) => void;
  recordResult: (result: GameResult) => { unlocked: Achievement[]; stars: number };
  recordFirstRoll: () => Achievement[];
  resetProgress: () => void;

  saveGame: (game: GameId, state: unknown) => void;
  clearSavedGame: () => void;
  savedGame: SavedGame | null;

  /** Newly unlocked achievements waiting to be shown as a toast. */
  toasts: Achievement[];
  pushToasts: (achievements: Achievement[]) => void;
  dismissToast: (id: string) => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => load());
  const [toasts, setToasts] = useState<Achievement[]>([]);
  // Kept in a ref so callbacks can read the latest data without being
  // recreated on every change, which would restart effects that depend on them.
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    save(data);
  }, [data]);

  useEffect(() => {
    setSoundEnabled(data.settings.sound);
  }, [data.settings.sound]);

  useEffect(() => {
    setMusicEnabled(data.settings.music);
  }, [data.settings.music]);

  // Browsers block audio until the user interacts. One listener, once.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // The animation setting drives one attribute; the CSS does the rest.
  useEffect(() => {
    document.documentElement.dataset.animation = data.settings.animation;
  }, [data.settings.animation]);

  useEffect(() => {
    document.documentElement.lang = data.settings.language;
  }, [data.settings.language]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  }, []);

  const addProfile = useCallback((name: string, avatar: string, color: Profile["color"]) => {
    const profile = createProfile(name, avatar, color);
    setData((d) => ({
      ...d,
      profiles: [...d.profiles, profile],
      activeProfileId: profile.id,
    }));
    return profile;
  }, []);

  const removeProfile = useCallback((id: string) => {
    setData((d) => {
      const profiles = d.profiles.filter((p) => p.id !== id);
      return {
        ...d,
        profiles,
        activeProfileId: d.activeProfileId === id ? (profiles[0]?.id ?? null) : d.activeProfileId,
      };
    });
  }, []);

  const selectProfile = useCallback((id: string) => {
    setData((d) => ({ ...d, activeProfileId: id }));
  }, []);

  const pushToasts = useCallback((achievements: Achievement[]) => {
    if (achievements.length === 0) return;
    setToasts((current) => [...current, ...achievements]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((a) => a.id !== id));
  }, []);

  const recordResult = useCallback((result: GameResult) => {
    const current = dataRef.current;
    const active = current.profiles.find((p) => p.id === current.activeProfileId);
    if (!active) return { unlocked: [], stars: 0 };

    const { profile, unlocked, stars } = applyResult(active, result);
    setData((d) => ({
      ...d,
      profiles: d.profiles.map((p) => (p.id === profile.id ? profile : p)),
    }));
    return { unlocked, stars };
  }, []);

  const recordFirstRoll = useCallback(() => {
    const current = dataRef.current;
    const active = current.profiles.find((p) => p.id === current.activeProfileId);
    if (!active) return [];
    const { profile, unlocked } = markFirstRoll(active);
    if (unlocked.length === 0) return [];
    setData((d) => ({
      ...d,
      profiles: d.profiles.map((p) => (p.id === profile.id ? profile : p)),
    }));
    return unlocked;
  }, []);

  const resetProgress = useCallback(() => {
    clearAll();
    setData(emptyData());
    setToasts([]);
  }, []);

  const saveGame = useCallback((game: GameId, state: unknown) => {
    setData((d) => ({ ...d, savedGame: { game, state, savedAt: Date.now() } }));
  }, []);

  const clearSavedGame = useCallback(() => {
    setData((d) => (d.savedGame === null ? d : { ...d, savedGame: null }));
  }, []);

  const t = useCallback(
    (key: string, args?: MessageArgs) => translate(data.settings.language, key, args),
    [data.settings.language],
  );

  const value = useMemo<Store>(
    () => ({
      data,
      settings: data.settings,
      profiles: data.profiles,
      activeProfile: data.profiles.find((p) => p.id === data.activeProfileId) ?? null,
      savedGame: data.savedGame,
      t,
      updateSettings,
      addProfile,
      removeProfile,
      selectProfile,
      recordResult,
      recordFirstRoll,
      resetProgress,
      saveGame,
      clearSavedGame,
      toasts,
      pushToasts,
      dismissToast,
    }),
    [
      data,
      t,
      toasts,
      updateSettings,
      addProfile,
      removeProfile,
      selectProfile,
      recordResult,
      recordFirstRoll,
      resetProgress,
      saveGame,
      clearSavedGame,
      pushToasts,
      dismissToast,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside <StoreProvider>");
  return store;
}
