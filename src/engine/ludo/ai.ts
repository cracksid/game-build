/**
 * Ludo opponents.
 *
 * The AI never sees anything a human player could not see, and it never
 * touches the dice -- it only picks among the moves the rules already
 * declared legal. That is deliberate: an opponent that cheats is the fastest
 * way to make a child stop trusting a game.
 *
 * Difficulty is how much of the scoring it listens to, not how good its
 * dice are.
 */

import type { Difficulty } from "../types";
import type { Rng } from "../dice";
import { defaultRng } from "../dice";
import { HOME_PROGRESS, LAST_RING_PROGRESS, RING_LENGTH } from "./board";
import { isSafeRingIndex, ringIndexForProgress } from "./board";
import type { LudoMove, LudoState } from "./rules";

/** How exposed a square is: how many opponents sit 1..6 steps behind it. */
function threatAt(state: LudoState, seat: number, progress: number, owner: number): number {
  const target = ringIndexForProgress(seat, progress);
  if (target === null) return 0;
  if (isSafeRingIndex(target)) return 0;

  let threats = 0;
  for (const token of state.tokens) {
    if (token.owner === owner) continue;
    const from = ringIndexForProgress(token.seat, token.progress);
    if (from === null) continue;
    const gap = (target - from + RING_LENGTH) % RING_LENGTH;
    if (gap >= 1 && gap <= 6) threats += 1;
  }
  return threats;
}

/** Higher is better. Every term is a rule of thumb a child could describe. */
export function scoreMove(state: LudoState, move: LudoMove): number {
  const owner = state.turn;
  const token = state.tokens.find((t) => t.id === move.tokenId)!;
  let score = 0;

  // Sending someone home is worth more the further they had travelled.
  for (const id of move.captures) {
    const victim = state.tokens.find((t) => t.id === id)!;
    score += 90 + Math.max(0, victim.progress) * 0.8;
  }

  if (move.kind === "finish") score += 85;
  if (move.kind === "exit") {
    const onBoard = state.tokens.filter(
      (t) => t.owner === owner && t.progress >= 0 && t.progress < HOME_PROGRESS,
    ).length;
    // Getting out matters most when there is nobody out yet.
    score += onBoard === 0 ? 75 : 45 - onBoard * 8;
  }

  if (move.homeColumn) score += 40;
  if (move.safe && move.kind !== "exit") score += 22;

  // Running away from danger, and not walking into it.
  const dangerBefore = threatAt(state, token.seat, token.progress, owner);
  const dangerAfter = threatAt(state, token.seat, move.to, owner);
  score += dangerBefore * 14;
  score -= dangerAfter * 16;

  // All else equal, push the piece that is nearest home.
  score += move.to * 0.25;

  // A token one square from finishing is worth nudging along.
  if (move.to >= LAST_RING_PROGRESS) score += 10;

  return score;
}

function pickRandom(moves: LudoMove[], rng: Rng): LudoMove {
  return moves[Math.floor(rng() * moves.length)];
}

function pickBest(state: LudoState, moves: LudoMove[], rng: Rng): LudoMove {
  let best = moves[0];
  let bestScore = -Infinity;
  for (const move of moves) {
    // A whisker of noise so two equally good moves are not always resolved
    // the same way -- it makes repeat games feel less scripted.
    const score = scoreMove(state, move) + rng() * 2;
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

export function chooseLudoMove(
  state: LudoState,
  difficulty: Difficulty,
  rng: Rng = defaultRng,
): LudoMove | null {
  const moves = state.moves;
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  if (difficulty === "easy") {
    // Random, but it will still take a free capture about half the time --
    // an opponent that never notices an obvious move reads as broken.
    const captures = moves.filter((m) => m.captures.length > 0);
    if (captures.length && rng() < 0.5) return pickRandom(captures, rng);
    return pickRandom(moves, rng);
  }

  if (difficulty === "medium") {
    if (rng() < 0.3) return pickRandom(moves, rng);
    return pickBest(state, moves, rng);
  }

  return pickBest(state, moves, rng);
}
