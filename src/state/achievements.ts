/**
 * Rewards.
 *
 * Stars and trophies only. No streak that punishes a day off, no currency,
 * no timers, nothing that can be bought -- a child should be able to put the
 * game down without losing anything.
 */

import type { GameId } from "../engine/types";
import type { Profile } from "./types";

export interface Achievement {
  id: string;
  icon: string;
  nameKey: string;
  descKey: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "firstRoll", icon: "🎲", nameKey: "ach.firstRoll.name", descKey: "ach.firstRoll.desc" },
  { id: "capture", icon: "💥", nameKey: "ach.capture.name", descKey: "ach.capture.desc" },
  { id: "firstWin", icon: "🏆", nameKey: "ach.firstWin.name", descKey: "ach.firstWin.desc" },
  { id: "played5", icon: "⭐", nameKey: "ach.played5.name", descKey: "ach.played5.desc" },
  { id: "ladderClimber", icon: "🪜", nameKey: "ach.ladderClimber.name", descKey: "ach.ladderClimber.desc" },
  { id: "snakeSurvivor", icon: "🐍", nameKey: "ach.snakeSurvivor.name", descKey: "ach.snakeSurvivor.desc" },
  { id: "streak3", icon: "🔥", nameKey: "ach.streak3.name", descKey: "ach.streak3.desc" },
  { id: "ludoChampion", icon: "👑", nameKey: "ach.ludoChampion.name", descKey: "ach.ludoChampion.desc" },
  { id: "perfect", icon: "🛡️", nameKey: "ach.perfect.name", descKey: "ach.perfect.desc" },
];

/** What happened in the game that just ended, from this profile's side. */
export interface GameResult {
  game: GameId;
  won: boolean;
  captures: number;
  laddersClimbed: number;
  snakesHit: number;
  tokensLost: number;
  turns: number;
}

/** Stars are for taking part; winning is worth more, but losing is never 0. */
export function starsFor(result: GameResult): number {
  let stars = 1;
  if (result.won) stars += 2;
  stars += Math.min(2, result.laddersClimbed);
  stars += Math.min(2, result.captures);
  return stars;
}

/** Apply a finished game to a profile, returning the profile and what is new. */
export function applyResult(
  profile: Profile,
  result: GameResult,
): { profile: Profile; unlocked: Achievement[]; stars: number } {
  const stars = starsFor(result);
  const currentStreak = result.won ? profile.currentStreak + 1 : 0;

  const next: Profile = {
    ...profile,
    gamesPlayed: profile.gamesPlayed + 1,
    wins: profile.wins + (result.won ? 1 : 0),
    stars: profile.stars + stars,
    currentStreak,
    bestStreak: Math.max(profile.bestStreak, currentStreak),
    laddersClimbed: profile.laddersClimbed + result.laddersClimbed,
    snakesHit: profile.snakesHit + result.snakesHit,
    captures: profile.captures + result.captures,
    ludoWins: profile.ludoWins + (result.won && result.game === "ludo" ? 1 : 0),
    snakesWins: profile.snakesWins + (result.won && result.game === "snakes" ? 1 : 0),
  };

  const earned = new Set(next.achievements);
  const unlock = (id: string) => earned.add(id);

  unlock("firstRoll");
  if (next.captures > 0) unlock("capture");
  if (next.wins > 0) unlock("firstWin");
  if (next.gamesPlayed >= 5) unlock("played5");
  if (result.laddersClimbed >= 3) unlock("ladderClimber");
  if (result.won && result.game === "snakes" && result.snakesHit > 0) unlock("snakeSurvivor");
  if (next.bestStreak >= 3) unlock("streak3");
  if (next.ludoWins >= 3) unlock("ludoChampion");
  if (result.won && result.game === "ludo" && result.tokensLost === 0) unlock("perfect");

  const unlocked = ACHIEVEMENTS.filter(
    (a) => earned.has(a.id) && !profile.achievements.includes(a.id),
  );

  return { profile: { ...next, achievements: [...earned] }, unlocked, stars };
}

/** Awarded the moment a die is first thrown, so the first turn already pays. */
export function markFirstRoll(profile: Profile): { profile: Profile; unlocked: Achievement[] } {
  if (profile.achievements.includes("firstRoll")) return { profile, unlocked: [] };
  return {
    profile: { ...profile, achievements: [...profile.achievements, "firstRoll"] },
    unlocked: ACHIEVEMENTS.filter((a) => a.id === "firstRoll"),
  };
}
