import type { ColorId, Difficulty, GameId } from "../engine/types";
import type { Lang } from "../lib/i18n";

/** How much movement the app is allowed to use. */
export type AnimationLevel = "full" | "calm" | "off";

export interface Settings {
  sound: boolean;
  music: boolean;
  animation: AnimationLevel;
  difficulty: Difficulty;
  language: Lang;
}

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  color: ColorId;
  gamesPlayed: number;
  wins: number;
  stars: number;
  currentStreak: number;
  bestStreak: number;
  laddersClimbed: number;
  snakesHit: number;
  captures: number;
  ludoWins: number;
  snakesWins: number;
  achievements: string[];
  createdAt: number;
}

/**
 * A game in progress, kept so closing the tab does not lose it. The engine
 * state is stored as-is: it is plain data by design, which is exactly what
 * makes saving it a two-line job.
 */
export interface SavedGame {
  game: GameId;
  /** Serialised LudoState or SnakesState. */
  state: unknown;
  savedAt: number;
}

export interface AppData {
  version: number;
  settings: Settings;
  profiles: Profile[];
  activeProfileId: string | null;
  savedGame: SavedGame | null;
}

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  music: true,
  animation: "full",
  difficulty: "medium",
  language: "en",
};
