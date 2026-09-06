/**
 * Types shared by both game engines.
 *
 * Nothing in this folder imports React. The engines are plain data + pure
 * functions so they can be unit-tested without rendering anything, and so
 * the UI can never be the place where a rule accidentally lives.
 */

export type PlayerKind = "human" | "ai";

export type Difficulty = "easy" | "medium" | "hard";

/** The four Ludo colours. Snakes & Ladders reuses them for player pieces. */
export type ColorId = "red" | "green" | "yellow" | "blue";

export interface PlayerConfig {
  /** Seat index within the current game, 0-based, in turn order. */
  id: number;
  name: string;
  color: ColorId;
  /** Emoji character shown as the player's face everywhere in the UI. */
  avatar: string;
  kind: PlayerKind;
  difficulty: Difficulty;
}

export type GameId = "ludo" | "snakes";

/**
 * A line of on-screen text the engine wants shown, as a translation key plus
 * its arguments. The engine deliberately does not build the sentence: doing
 * so would pick a language for every player at once.
 */
export interface EngineMessage {
  key: string;
  args?: Record<string, string | number>;
}
