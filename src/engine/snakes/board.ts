/**
 * Snakes & Ladders board.
 *
 * Squares are numbered 1..100 in boustrophedon order: row 1 runs left to
 * right along the bottom, row 2 runs right to left above it, and so on. That
 * is what makes the snake at 87 visually cross the board rather than drop
 * straight down.
 */

export const BOARD_SIZE = 10;
export const LAST_SQUARE = BOARD_SIZE * BOARD_SIZE;

export interface Jump {
  from: number;
  to: number;
}

/**
 * Ladders and snakes are chosen so that no ladder top is a snake head and no
 * snake tail is a ladder foot -- a chained jump is impossible to animate
 * clearly and confuses young players.
 */
export const LADDERS: readonly Jump[] = [
  { from: 1, to: 38 },
  { from: 4, to: 14 },
  { from: 9, to: 31 },
  { from: 21, to: 42 },
  { from: 28, to: 84 },
  { from: 36, to: 44 },
  { from: 51, to: 67 },
  { from: 71, to: 91 },
  { from: 80, to: 100 },
];

export const SNAKES: readonly Jump[] = [
  { from: 16, to: 6 },
  { from: 47, to: 26 },
  { from: 49, to: 11 },
  { from: 56, to: 53 },
  { from: 62, to: 19 },
  { from: 64, to: 60 },
  { from: 87, to: 24 },
  { from: 93, to: 73 },
  { from: 95, to: 75 },
  { from: 98, to: 78 },
];

const LADDER_MAP = new Map(LADDERS.map((l) => [l.from, l.to]));
const SNAKE_MAP = new Map(SNAKES.map((s) => [s.from, s.to]));

export type JumpKind = "ladder" | "snake";

export function jumpFrom(square: number): { to: number; kind: JumpKind } | null {
  const ladder = LADDER_MAP.get(square);
  if (ladder !== undefined) return { to: ladder, kind: "ladder" };
  const snake = SNAKE_MAP.get(square);
  if (snake !== undefined) return { to: snake, kind: "snake" };
  return null;
}

export interface Coord {
  /** Column, 0 at the left. */
  col: number;
  /** Row, 0 at the TOP -- the drawing order, not the counting order. */
  row: number;
}

/** Grid position of a square, for drawing. Square 1 is bottom-left. */
export function coordOf(square: number): Coord {
  const clamped = Math.min(Math.max(square, 1), LAST_SQUARE);
  const index = clamped - 1;
  const rowFromBottom = Math.floor(index / BOARD_SIZE);
  const withinRow = index % BOARD_SIZE;
  const leftToRight = rowFromBottom % 2 === 0;
  return {
    col: leftToRight ? withinRow : BOARD_SIZE - 1 - withinRow,
    row: BOARD_SIZE - 1 - rowFromBottom,
  };
}

/** Every square in drawing order, top-left first. Used to lay out the grid. */
export function squaresInDrawOrder(): number[] {
  const out: number[] = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    const rowFromBottom = BOARD_SIZE - 1 - row;
    const leftToRight = rowFromBottom % 2 === 0;
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const withinRow = leftToRight ? col : BOARD_SIZE - 1 - col;
      out.push(rowFromBottom * BOARD_SIZE + withinRow + 1);
    }
  }
  return out;
}
