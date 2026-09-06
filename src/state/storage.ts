/**
 * Saving.
 *
 * Everything lives in this browser's localStorage and nowhere else: no
 * account, no server, no analytics. That is the right shape for a children's
 * app, and it means the whole persistence layer is one key.
 *
 * Every read is defensive. localStorage can be missing (private windows,
 * embedded webviews), full, or hold data written by an older version of the
 * app, and none of those may stop the game from opening.
 */

import type { AppData, Profile } from "./types";
import { DEFAULT_SETTINGS } from "./types";

const KEY = "kids-game-world.v1";
const VERSION = 1;

export const AVATARS = [
  "🦊", "🐼", "🐯", "🐰", "🐸", "🐨", "🦁", "🐵",
  "🐧", "🦄", "🐢", "🐬", "🦉", "🐷", "🐮", "🐙",
];

export function emptyData(): AppData {
  return {
    version: VERSION,
    settings: { ...DEFAULT_SETTINGS },
    profiles: [],
    activeProfileId: null,
    savedGame: null,
  };
}

export function createProfile(name: string, avatar: string, color: Profile["color"]): Profile {
  return {
    id: "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: name.trim() || "Player",
    avatar,
    color,
    gamesPlayed: 0,
    wins: 0,
    stars: 0,
    currentStreak: 0,
    bestStreak: 0,
    laddersClimbed: 0,
    snakesHit: 0,
    captures: 0,
    ludoWins: 0,
    snakesWins: 0,
    achievements: [],
    createdAt: Date.now(),
  };
}

/** Fill in anything a stored profile is missing, so old saves still load. */
function reviveProfile(raw: Partial<Profile>): Profile {
  const base = createProfile(raw.name ?? "Player", raw.avatar ?? AVATARS[0], raw.color ?? "red");
  return {
    ...base,
    ...raw,
    id: raw.id ?? base.id,
    achievements: Array.isArray(raw.achievements) ? raw.achievements : [],
    createdAt: raw.createdAt ?? base.createdAt,
  };
}

export function load(): AppData {
  if (typeof localStorage === "undefined") return emptyData();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw) as Partial<AppData>;
    const profiles = Array.isArray(parsed.profiles)
      ? parsed.profiles.map((p) => reviveProfile(p as Partial<Profile>))
      : [];
    return {
      version: VERSION,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      profiles,
      activeProfileId:
        parsed.activeProfileId && profiles.some((p) => p.id === parsed.activeProfileId)
          ? parsed.activeProfileId
          : (profiles[0]?.id ?? null),
      savedGame: parsed.savedGame ?? null,
    };
  } catch {
    // A corrupt save must never be a blank screen. Start fresh instead.
    return emptyData();
  }
}

export function save(data: AppData): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Quota exceeded or storage disabled: the game keeps working in memory.
  }
}

export function clearAll(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing useful to do */
  }
}
