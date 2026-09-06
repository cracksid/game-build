import { describe, expect, it } from "vitest";

import type { PlayerConfig } from "../types";
import { seededRng } from "../dice";
import {
  BOARD_SIZE,
  LADDERS,
  LAST_SQUARE,
  SNAKES,
  coordOf,
  jumpFrom,
  squaresInDrawOrder,
} from "./board";
import { applyRoll, createSnakesGame, walkPath } from "./rules";

function players(n: number): PlayerConfig[] {
  const colors = ["red", "green", "yellow", "blue"] as const;
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    name: "P" + (i + 1),
    color: colors[i],
    avatar: "🐼",
    kind: i === 0 ? ("human" as const) : ("ai" as const),
    difficulty: "medium" as const,
  }));
}

describe("board", () => {
  it("numbers squares from the bottom left, snaking upward", () => {
    expect(coordOf(1)).toEqual({ col: 0, row: 9 });
    expect(coordOf(10)).toEqual({ col: 9, row: 9 });
    expect(coordOf(11)).toEqual({ col: 9, row: 8 });
    expect(coordOf(20)).toEqual({ col: 0, row: 8 });
    expect(coordOf(100)).toEqual({ col: 0, row: 0 });
  });

  it("draws all 100 squares exactly once", () => {
    const order = squaresInDrawOrder();
    expect(order).toHaveLength(LAST_SQUARE);
    expect(new Set(order).size).toBe(LAST_SQUARE);
    // Drawn top-left first: row 10 runs 100..91, and the bottom row ends on 10.
    expect(order[0]).toBe(100);
    expect(order[9]).toBe(91);
    expect(order[90]).toBe(1);
    expect(order[order.length - 1]).toBe(10);
  });

  it("keeps consecutive squares next to each other on the grid", () => {
    for (let square = 1; square < LAST_SQUARE; square += 1) {
      const a = coordOf(square);
      const b = coordOf(square + 1);
      const distance = Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
      expect(distance).toBe(1);
    }
  });

  it("always sends ladders up and snakes down", () => {
    for (const l of LADDERS) expect(l.to).toBeGreaterThan(l.from);
    for (const s of SNAKES) expect(s.to).toBeLessThan(s.from);
  });

  it("never chains one jump straight into another", () => {
    const starts = new Set([...LADDERS, ...SNAKES].map((j) => j.from));
    for (const jump of [...LADDERS, ...SNAKES]) {
      expect(starts.has(jump.to)).toBe(false);
    }
  });

  it("gives every square at most one jump", () => {
    const froms = [...LADDERS, ...SNAKES].map((j) => j.from);
    expect(new Set(froms).size).toBe(froms.length);
  });

  it("keeps jumps inside the board", () => {
    for (const jump of [...LADDERS, ...SNAKES]) {
      expect(jump.from).toBeGreaterThanOrEqual(1);
      expect(jump.to).toBeGreaterThanOrEqual(1);
      expect(jump.from).toBeLessThanOrEqual(LAST_SQUARE);
      expect(jump.to).toBeLessThanOrEqual(LAST_SQUARE);
    }
    // Nothing may sit on 100 itself, or the game could never be won.
    expect(jumpFrom(LAST_SQUARE)).toBeNull();
  });

  it("has a 10 by 10 grid", () => {
    expect(BOARD_SIZE * BOARD_SIZE).toBe(LAST_SQUARE);
  });
});

describe("walking", () => {
  it("steps one square at a time", () => {
    expect(walkPath(0, 4).walk).toEqual([1, 2, 3, 4]);
    expect(walkPath(20, 3).walk).toEqual([21, 22, 23]);
  });

  it("lands exactly on 100", () => {
    const { walk, bounced } = walkPath(97, 3);
    expect(walk).toEqual([98, 99, 100]);
    expect(bounced).toBe(false);
  });

  it("bounces back off 100 when it overshoots", () => {
    const { walk, bounced } = walkPath(97, 5);
    expect(bounced).toBe(true);
    expect(walk).toEqual([98, 99, 100, 99, 98]);
    expect(walk[walk.length - 1]).toBe(98);
  });

  it("never walks past the last square", () => {
    for (let from = 90; from < LAST_SQUARE; from += 1) {
      for (let dice = 1; dice <= 6; dice += 1) {
        const { walk } = walkPath(from, dice);
        for (const square of walk) {
          expect(square).toBeLessThanOrEqual(LAST_SQUARE);
          expect(square).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });
});

describe("rules", () => {
  it("climbs a ladder when it lands on the foot", () => {
    const state = createSnakesGame(players(2));
    // Square 4 is the foot of a ladder to 14.
    const result = applyRoll(state, 4);
    expect(result.jump).toEqual({ from: 4, to: 14, kind: "ladder" });
    expect(result.state.positions[0]).toBe(14);
    expect(result.state.laddersClimbed[0]).toBe(1);
  });

  it("slides down a snake when it lands on the head", () => {
    let state = createSnakesGame(players(2));
    state = { ...state, positions: [14, 0] };
    // 14 + 2 = 16, the head of a snake down to 6.
    const result = applyRoll(state, 2);
    expect(result.jump).toEqual({ from: 16, to: 6, kind: "snake" });
    expect(result.state.positions[0]).toBe(6);
    expect(result.state.snakesHit[0]).toBe(1);
  });

  it("leaves the piece alone on a plain square", () => {
    let state = createSnakesGame(players(2));
    state = { ...state, positions: [40, 0] };
    const result = applyRoll(state, 3);
    expect(result.jump).toBeNull();
    expect(result.state.positions[0]).toBe(43);
  });

  it("passes the turn on anything but a six", () => {
    const state = createSnakesGame(players(3));
    expect(applyRoll(state, 3).state.turn).toBe(1);
    expect(applyRoll(state, 5).state.turn).toBe(1);
  });

  it("keeps the turn on a six", () => {
    const state = createSnakesGame(players(3));
    const result = applyRoll(state, 6);
    expect(result.extraTurn).toBe(true);
    expect(result.state.turn).toBe(0);
  });

  it("wraps the turn around to the first player", () => {
    let state = createSnakesGame(players(2));
    state = { ...state, turn: 1 };
    expect(applyRoll(state, 3).state.turn).toBe(0);
  });

  it("wins only by landing exactly on 100", () => {
    let state = createSnakesGame(players(2));
    state = { ...state, positions: [97, 0] };
    const win = applyRoll(state, 3);
    expect(win.won).toBe(true);
    expect(win.state.phase).toBe("gameover");
    expect(win.state.winner).toBe(0);

    let other = createSnakesGame(players(2));
    other = { ...other, positions: [97, 0] };
    const miss = applyRoll(other, 4);
    expect(miss.won).toBe(false);
    expect(miss.bounced).toBe(true);
    expect(miss.state.positions[0]).toBe(99);
  });

  it("still obeys a snake it bounces back onto", () => {
    let state = createSnakesGame(players(2));
    state = { ...state, positions: [97, 0] };
    // 97 + 5 overshoots to 102, bounces back to 98 -- which is a snake head.
    const result = applyRoll(state, 5);
    expect(result.bounced).toBe(true);
    expect(result.jump).toEqual({ from: 98, to: 78, kind: "snake" });
    expect(result.state.positions[0]).toBe(78);
  });

  it("can win by climbing the ladder at 80", () => {
    let state = createSnakesGame(players(2));
    state = { ...state, positions: [77, 0] };
    const result = applyRoll(state, 3);
    expect(result.jump).toEqual({ from: 80, to: 100, kind: "ladder" });
    expect(result.won).toBe(true);
  });

  it("refuses to move once the game is over", () => {
    let state = createSnakesGame(players(2));
    state = { ...state, positions: [97, 0] };
    const won = applyRoll(state, 3).state;
    const after = applyRoll(won, 4);
    expect(after.state.positions).toEqual(won.positions);
    expect(after.walk).toEqual([]);
  });

  it("counts rolls and sixes per player", () => {
    let state = createSnakesGame(players(2));
    state = applyRoll(state, 6).state;
    state = applyRoll(state, 2).state;
    expect(state.rolls[0]).toBe(2);
    expect(state.sixes[0]).toBe(1);
    expect(state.rolls[1]).toBe(0);
  });
});

describe("full games", () => {
  it("always ends with somebody exactly on 100", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const rng = seededRng(seed);
      let state = createSnakesGame(players(4));
      let guard = 0;

      while (state.phase !== "gameover" && guard < 5000) {
        guard += 1;
        const dice = Math.floor(rng() * 6) + 1;
        const result = applyRoll(state, dice);
        state = result.state;

        for (const position of state.positions) {
          expect(position).toBeGreaterThanOrEqual(0);
          expect(position).toBeLessThanOrEqual(LAST_SQUARE);
        }
        // A piece must never be left standing on a snake head or ladder foot.
        for (const position of state.positions) {
          if (position > 0) expect(jumpFrom(position)).toBeNull();
        }
      }

      expect(state.phase).toBe("gameover");
      expect(state.winner).not.toBeNull();
      expect(state.positions[state.winner!]).toBe(LAST_SQUARE);
    }
  });
});
