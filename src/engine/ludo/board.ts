/**
 * Ludo board geometry.
 *
 * The board is a 15x15 grid. Everything the UI needs to draw a token is
 * derived from the numbers here, so the renderer never hard-codes a
 * coordinate and the rules never think in pixels.
 *
 * A token's position is a single number, `progress`:
 *
 *   -1        in its yard (base), not yet on the board
 *   0 .. 50   on the shared 52-square ring, 51 squares travelled
 *   51 .. 55  in its own five-square home column
 *   56        HOME (finished)
 *
 * So a token needs exactly 56 steps from its start square to finish, and
 * the last step must be exact. Converting `progress` to a grid cell is the
 * job of `cellForProgress`.
 */

import type { ColorId } from "../types";

export const GRID = 15;
export const RING_LENGTH = 52;
export const HOME_COLUMN_LENGTH = 5;
/** progress value that means "finished". */
export const HOME_PROGRESS = 56;
/** Highest progress still on the shared ring. */
export const LAST_RING_PROGRESS = 50;
export const TOKENS_PER_PLAYER = 4;

export interface Cell {
  x: number;
  y: number;
}

/**
 * The 52 shared squares in travel order. Index 0 is the green start square
 * at the left of the middle row; play proceeds clockwise with increasing
 * index. Written out rather than generated: it is read far more often than
 * it is edited, and a wrong turn in a loop is much harder to spot than a
 * wrong pair of numbers.
 */
export const RING: readonly Cell[] = [
  // left arm, heading right along row 6
  { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 },
  // up column 6
  { x: 6, y: 5 }, { x: 6, y: 4 }, { x: 6, y: 3 }, { x: 6, y: 2 }, { x: 6, y: 1 }, { x: 6, y: 0 },
  // across the top
  { x: 7, y: 0 },
  // down column 8
  { x: 8, y: 0 }, { x: 8, y: 1 }, { x: 8, y: 2 }, { x: 8, y: 3 }, { x: 8, y: 4 }, { x: 8, y: 5 },
  // right along row 6
  { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 }, { x: 12, y: 6 }, { x: 13, y: 6 }, { x: 14, y: 6 },
  // down the right edge
  { x: 14, y: 7 },
  // left along row 8
  { x: 14, y: 8 }, { x: 13, y: 8 }, { x: 12, y: 8 }, { x: 11, y: 8 }, { x: 10, y: 8 }, { x: 9, y: 8 },
  // down column 8
  { x: 8, y: 9 }, { x: 8, y: 10 }, { x: 8, y: 11 }, { x: 8, y: 12 }, { x: 8, y: 13 }, { x: 8, y: 14 },
  // across the bottom
  { x: 7, y: 14 },
  // up column 6
  { x: 6, y: 14 }, { x: 6, y: 13 }, { x: 6, y: 12 }, { x: 6, y: 11 }, { x: 6, y: 10 }, { x: 6, y: 9 },
  // left along row 8
  { x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }, { x: 1, y: 8 }, { x: 0, y: 8 },
  // up the left edge
  { x: 0, y: 7 }, { x: 0, y: 6 },
];

/**
 * A seat is a corner of the board: its colour, where its tokens wait, where
 * they join the ring, and the five squares of its private run to the middle.
 */
export interface Seat {
  index: number;
  color: ColorId;
  /** Ring index this seat's tokens step onto when they leave the yard. */
  entry: number;
  /** Four resting spots inside the yard, in grid units (may be fractional). */
  yard: readonly Cell[];
  /** The five home-column squares, in travel order. */
  homeColumn: readonly Cell[];
  /** Top-left corner of the seat's 6x6 yard block. */
  yardOrigin: Cell;
  /** Where a finished token parks, inside the centre triangle. */
  homeSpot: Cell;
}

export const SEATS: readonly Seat[] = [
  {
    index: 0,
    color: "red",
    entry: 39,
    yardOrigin: { x: 0, y: 9 },
    yard: [
      { x: 1.5, y: 10.5 }, { x: 3.5, y: 10.5 },
      { x: 1.5, y: 12.5 }, { x: 3.5, y: 12.5 },
    ],
    homeColumn: [
      { x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 }, { x: 7, y: 10 }, { x: 7, y: 9 },
    ],
    homeSpot: { x: 7, y: 7.75 },
  },
  {
    index: 1,
    color: "green",
    entry: 0,
    yardOrigin: { x: 0, y: 0 },
    yard: [
      { x: 1.5, y: 1.5 }, { x: 3.5, y: 1.5 },
      { x: 1.5, y: 3.5 }, { x: 3.5, y: 3.5 },
    ],
    homeColumn: [
      { x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 },
    ],
    homeSpot: { x: 6.25, y: 7 },
  },
  {
    index: 2,
    color: "yellow",
    entry: 13,
    yardOrigin: { x: 9, y: 0 },
    yard: [
      { x: 10.5, y: 1.5 }, { x: 12.5, y: 1.5 },
      { x: 10.5, y: 3.5 }, { x: 12.5, y: 3.5 },
    ],
    homeColumn: [
      { x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 7, y: 5 },
    ],
    homeSpot: { x: 7, y: 6.25 },
  },
  {
    index: 3,
    color: "blue",
    entry: 26,
    yardOrigin: { x: 9, y: 9 },
    yard: [
      { x: 10.5, y: 10.5 }, { x: 12.5, y: 10.5 },
      { x: 10.5, y: 12.5 }, { x: 12.5, y: 12.5 },
    ],
    homeColumn: [
      { x: 13, y: 7 }, { x: 12, y: 7 }, { x: 11, y: 7 }, { x: 10, y: 7 }, { x: 9, y: 7 },
    ],
    homeSpot: { x: 7.75, y: 7 },
  },
];

/**
 * Squares where a token cannot be captured: the four start squares, and a
 * star square eight steps beyond each of them.
 */
export const SAFE_RING_INDICES: readonly number[] = [0, 8, 13, 21, 26, 34, 39, 47];
export const STAR_RING_INDICES: readonly number[] = [8, 21, 34, 47];

export function isSafeRingIndex(index: number): boolean {
  return SAFE_RING_INDICES.includes(index);
}

/**
 * Which seats play, for a given number of players. Two players sit opposite
 * each other so neither has a shorter run to a capture than the other.
 */
export function seatsForPlayerCount(count: number): number[] {
  if (count <= 2) return [0, 2];
  if (count === 3) return [0, 1, 2];
  return [0, 1, 2, 3];
}

/** Ring index a token of this seat stands on, or null if it is off the ring. */
export function ringIndexForProgress(seat: number, progress: number): number | null {
  if (progress < 0 || progress > LAST_RING_PROGRESS) return null;
  return (SEATS[seat].entry + progress) % RING_LENGTH;
}

/** Grid cell for a token, used only for drawing. */
export function cellForProgress(seat: number, progress: number, yardSlot: number): Cell {
  const s = SEATS[seat];
  if (progress < 0) return s.yard[yardSlot];
  if (progress === HOME_PROGRESS) return s.homeSpot;
  if (progress > LAST_RING_PROGRESS) return s.homeColumn[progress - LAST_RING_PROGRESS - 1];
  return RING[(s.entry + progress) % RING_LENGTH];
}
