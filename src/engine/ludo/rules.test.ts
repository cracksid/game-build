import { describe, expect, it } from "vitest";

import type { PlayerConfig } from "../types";
import { seededRng } from "../dice";
import { HOME_PROGRESS, RING, SAFE_RING_INDICES, SEATS, ringIndexForProgress } from "./board";
import { chooseLudoMove } from "./ai";
import {
  applyMove,
  applyRoll,
  createLudoGame,
  isFinished,
  legalMoves,
  passTurn,
  tokensOf,
} from "./rules";
import type { LudoState } from "./rules";

function players(n: number): PlayerConfig[] {
  const colors = ["red", "green", "yellow", "blue"] as const;
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    name: "P" + (i + 1),
    color: colors[i],
    avatar: "🦊",
    kind: i === 0 ? ("human" as const) : ("ai" as const),
    difficulty: "medium" as const,
  }));
}

/** Put a specific token at a specific progress, bypassing the rules. */
function place(state: LudoState, tokenId: number, progress: number): LudoState {
  return {
    ...state,
    tokens: state.tokens.map((t) => (t.id === tokenId ? { ...t, progress } : t)),
  };
}

describe("board geometry", () => {
  it("has 52 distinct ring squares", () => {
    const seen = new Set<string>();
    for (const cell of RING) seen.add(cell.x + "," + cell.y);
    expect(RING.length).toBe(52);
    expect(seen.size).toBe(52);
  });

  it("steps one square at a time, turning exactly four corners", () => {
    // The track wraps around the central home block, so at each of its four
    // corners two squares meet corner-to-corner rather than edge-to-edge.
    // Four such steps is right; a fifth would mean a typo in the path.
    let diagonals = 0;
    for (let i = 0; i < RING.length; i += 1) {
      const a = RING[i];
      const b = RING[(i + 1) % RING.length];
      const dx = Math.abs(a.x - b.x);
      const dy = Math.abs(a.y - b.y);
      expect(dx).toBeLessThanOrEqual(1);
      expect(dy).toBeLessThanOrEqual(1);
      expect(dx + dy).toBeGreaterThan(0);
      if (dx === 1 && dy === 1) diagonals += 1;
    }
    expect(diagonals).toBe(4);
  });

  it("never puts a home column square on the shared ring", () => {
    const ring = new Set(RING.map((c) => c.x + "," + c.y));
    for (const seat of SEATS) {
      for (const cell of seat.homeColumn) {
        expect(ring.has(cell.x + "," + cell.y)).toBe(false);
      }
    }
  });

  it("gives every seat a start square that is safe", () => {
    for (const seat of SEATS) {
      expect(SAFE_RING_INDICES).toContain(seat.entry);
    }
  });

  it("puts each seat 13 ring squares from the next", () => {
    const entries = SEATS.map((s) => s.entry).sort((a, b) => a - b);
    expect(entries).toEqual([0, 13, 26, 39]);
  });

  it("needs 56 steps from the start square to home", () => {
    expect(HOME_PROGRESS).toBe(56);
  });
});

describe("leaving base", () => {
  it("allows no move at all on a roll that is not six", () => {
    const state = createLudoGame(players(2));
    for (const roll of [1, 2, 3, 4, 5]) {
      expect(legalMoves(state, 0, roll)).toHaveLength(0);
    }
  });

  it("offers exactly one exit move on a six, not four identical ones", () => {
    const state = createLudoGame(players(2));
    const moves = legalMoves(state, 0, 6);
    expect(moves).toHaveLength(1);
    expect(moves[0].kind).toBe("exit");
    expect(moves[0].to).toBe(0);
  });

  it("puts the token on the seat's start square", () => {
    let state = createLudoGame(players(2));
    state = applyRoll(state, 6);
    const result = applyMove(state, state.moves[0].tokenId);
    const token = result.state.tokens.find((t) => t.id === state.moves[0].tokenId)!;
    expect(token.progress).toBe(0);
    expect(ringIndexForProgress(token.seat, 0)).toBe(SEATS[token.seat].entry);
  });
});

describe("moving", () => {
  it("advances by the dice value", () => {
    let state = createLudoGame(players(2));
    state = place(state, 0, 5);
    state = applyRoll(state, 3);
    const result = applyMove(state, 0);
    expect(result.state.tokens[0].progress).toBe(8);
  });

  it("reports every square walked over so the piece can be animated", () => {
    let state = createLudoGame(players(2));
    state = place(state, 0, 5);
    state = applyRoll(state, 4);
    const result = applyMove(state, 0);
    expect(result.path).toEqual([6, 7, 8, 9]);
  });

  it("refuses to overshoot the final square", () => {
    let state = createLudoGame(players(2));
    state = place(state, 0, 54);
    expect(legalMoves(state, 0, 3)).toHaveLength(0);
    expect(legalMoves(state, 0, 2)).toHaveLength(1);
  });

  it("requires the exact number to finish", () => {
    let state = createLudoGame(players(2));
    state = place(state, 0, 53);
    const exact = legalMoves(state, 0, 3);
    expect(exact).toHaveLength(1);
    expect(exact[0].kind).toBe("finish");
    expect(exact[0].to).toBe(HOME_PROGRESS);
  });

  it("never moves a token that has already finished", () => {
    let state = createLudoGame(players(2));
    state = place(state, 0, HOME_PROGRESS);
    const moves = legalMoves(state, 0, 3);
    expect(moves.every((m) => m.tokenId !== 0)).toBe(true);
  });
});

describe("capturing", () => {
  it("captures when the destination holds an opponent and is not safe", () => {
    let state = createLudoGame(players(2));
    // Player 0 (seat 0, entry 39) moving to progress 3 lands on ring 42.
    // Player 1 (seat 2, entry 13) sits on ring 42 at progress 29.
    state = place(state, 0, 1);
    state = place(state, 4, 29);
    expect(ringIndexForProgress(0, 3)).toBe(42);
    expect(ringIndexForProgress(2, 29)).toBe(42);

    state = applyRoll(state, 2);
    const move = state.moves.find((m) => m.tokenId === 0)!;
    expect(move.captures).toEqual([4]);

    const result = applyMove(state, 0);
    expect(result.state.tokens.find((t) => t.id === 4)!.progress).toBe(-1);
    expect(result.captured).toEqual([4]);
    expect(result.extraTurn).toBe(true);
    expect(result.state.captures[0]).toBe(1);
  });

  it("cannot capture on a safe square", () => {
    let state = createLudoGame(players(2));
    // Ring 47 is a star square. Player 0 reaches it at progress 8.
    expect(SAFE_RING_INDICES).toContain(47);
    // Player 1 (entry 13) is on ring 47 at progress 34.
    state = place(state, 0, 5);
    state = place(state, 4, 34);
    expect(ringIndexForProgress(2, 34)).toBe(47);

    state = applyRoll(state, 3);
    const move = state.moves.find((m) => m.tokenId === 0)!;
    expect(move.to).toBe(8);
    expect(move.safe).toBe(true);
    expect(move.captures).toEqual([]);

    const result = applyMove(state, 0);
    expect(result.state.tokens.find((t) => t.id === 4)!.progress).toBe(34);
  });

  it("never captures its own colour", () => {
    let state = createLudoGame(players(2));
    state = place(state, 0, 1);
    state = place(state, 1, 3);
    state = applyRoll(state, 2);
    const move = state.moves.find((m) => m.tokenId === 0)!;
    expect(move.captures).toEqual([]);
  });

  it("cannot be captured inside the home column", () => {
    let state = createLudoGame(players(2));
    state = place(state, 0, 52); // home column
    // No ring index exists for a home-column square, so nobody can share it.
    expect(ringIndexForProgress(0, 52)).toBeNull();
    state = place(state, 4, 30);
    state = { ...state, turn: 1 };
    for (let roll = 1; roll <= 6; roll += 1) {
      const moves = legalMoves(state, 1, roll);
      expect(moves.every((m) => m.captures.length === 0)).toBe(true);
    }
  });
});

describe("turn management", () => {
  it("grants another turn after a six", () => {
    let state = createLudoGame(players(2));
    state = place(state, 0, 4);
    state = applyRoll(state, 6);
    const result = applyMove(state, 0);
    expect(result.extraTurn).toBe(true);
    expect(result.state.turn).toBe(0);
    expect(result.state.phase).toBe("roll");
  });

  it("passes the turn after a plain move", () => {
    let state = createLudoGame(players(2));
    state = place(state, 0, 4);
    state = applyRoll(state, 3);
    const result = applyMove(state, 0);
    expect(result.extraTurn).toBe(false);
    expect(result.state.turn).toBe(1);
  });

  it("grants another turn for getting a token home", () => {
    let state = createLudoGame(players(2));
    state = place(state, 0, 53);
    state = applyRoll(state, 3);
    const result = applyMove(state, 0);
    expect(result.reachedHome).toBe(true);
    expect(result.extraTurn).toBe(true);
  });

  it("forfeits the turn on three consecutive sixes", () => {
    let state = createLudoGame(players(2));
    state = { ...state, consecutiveSixes: 2 };
    state = applyRoll(state, 6);
    expect(state.blocked).toBe("three-sixes");
    expect(state.moves).toHaveLength(0);
    expect(passTurn(state).turn).toBe(1);
  });

  it("resets the six counter on any other roll", () => {
    let state = createLudoGame(players(2));
    state = { ...state, consecutiveSixes: 2 };
    state = applyRoll(state, 4);
    expect(state.consecutiveSixes).toBe(0);
  });

  it("gives three tries to leave the yard, then passes", () => {
    let state = createLudoGame(players(2));

    state = applyRoll(state, 3);
    expect(state.blocked).toBe("retry");
    expect(state.phase).toBe("roll");
    expect(state.turn).toBe(0);

    state = applyRoll(state, 2);
    expect(state.blocked).toBe("retry");
    expect(state.turn).toBe(0);

    // Third try is the last one: now it is a real dead turn.
    state = applyRoll(state, 4);
    expect(state.blocked).toBe("no-moves");
    expect(state.phase).toBe("choose");
    expect(passTurn(state).turn).toBe(1);
    expect(passTurn(state).attempts).toBe(0);
  });

  it("stops offering retries once a token is on the board", () => {
    let state = createLudoGame(players(2));
    state = place(state, 0, 10);
    state = applyRoll(state, 3);
    // A token is out, so a useless roll is simply a dead turn, not a retry.
    expect(state.blocked).toBeNull();
    expect(state.moves.length).toBeGreaterThan(0);

    let stuck = createLudoGame(players(2));
    stuck = place(stuck, 0, 54);
    stuck = applyRoll(stuck, 5);
    expect(stuck.blocked).toBe("no-moves");
  });

  it("resets the retry allowance when an extra turn is earned", () => {
    let state = createLudoGame(players(2));
    state = applyRoll(state, 2);
    expect(state.attempts).toBe(1);
    state = applyRoll(state, 6);
    const result = applyMove(state, state.moves[0].tokenId);
    expect(result.extraTurn).toBe(true);
    expect(result.state.attempts).toBe(0);
  });

  it("flags a roll with no legal move and moves on", () => {
    let state = createLudoGame(players(2));
    state = place(state, 0, 55); // out of the yard, but nothing can move
    const rolled = applyRoll(state, 4);
    expect(rolled.blocked).toBe("no-moves");
    expect(passTurn(rolled).turn).toBe(1);
  });

  it("skips a player who has already finished", () => {
    let state = createLudoGame(players(3));
    for (const t of tokensOf(state, 1)) state = place(state, t.id, HOME_PROGRESS);
    expect(isFinished(state, 1)).toBe(true);
    expect(passTurn(state).turn).toBe(2);
  });

  it("ignores a move that is not in the legal list", () => {
    let state = createLudoGame(players(2));
    state = applyRoll(state, 3);
    const result = applyMove(state, 0);
    expect(result.path).toEqual([]);
    expect(result.state).toBe(state);
  });

  it("ignores a roll when it is not time to roll", () => {
    let state = createLudoGame(players(2));
    state = place(state, 0, 4);
    state = applyRoll(state, 3);
    const again = applyRoll(state, 5);
    expect(again.dice).toBe(3);
  });
});

describe("winning", () => {
  it("declares a winner when all four tokens are home", () => {
    let state = createLudoGame(players(2));
    state = place(state, 0, HOME_PROGRESS);
    state = place(state, 1, HOME_PROGRESS);
    state = place(state, 2, HOME_PROGRESS);
    state = place(state, 3, 53);
    state = applyRoll(state, 3);
    const result = applyMove(state, 3);
    expect(result.state.phase).toBe("gameover");
    expect(result.state.winner).toBe(0);
    expect(result.state.ranking).toEqual([0]);
  });

  it("does not declare a winner one token early", () => {
    let state = createLudoGame(players(2));
    state = place(state, 0, HOME_PROGRESS);
    state = place(state, 1, HOME_PROGRESS);
    state = place(state, 2, 53);
    state = applyRoll(state, 3);
    const result = applyMove(state, 2);
    expect(result.state.phase).not.toBe("gameover");
    expect(result.state.winner).toBeNull();
  });
});

describe("ai", () => {
  it("returns null when there is nothing to do", () => {
    const state = applyRoll(createLudoGame(players(2)), 3);
    expect(chooseLudoMove(state, "hard", seededRng(1))).toBeNull();
  });

  it("only ever returns a legal move", () => {
    const rng = seededRng(99);
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      let state = createLudoGame(players(4));
      for (let i = 0; i < 400 && state.phase !== "gameover"; i += 1) {
        const roll = Math.floor(rng() * 6) + 1;
        state = applyRoll(state, roll);
        if (state.moves.length === 0) {
          state = passTurn(state);
          continue;
        }
        const move = chooseLudoMove(state, difficulty, rng)!;
        expect(state.moves.some((m) => m.tokenId === move.tokenId)).toBe(true);
        state = applyMove(state, move.tokenId).state;
      }
    }
  });

  it("takes a free capture on hard", () => {
    let state = createLudoGame(players(2));
    state = place(state, 0, 1); // capture at ring 42 with a 2
    state = place(state, 1, 20); // a harmless alternative
    state = place(state, 4, 29);
    state = applyRoll(state, 2);
    const move = chooseLudoMove(state, "hard", seededRng(7))!;
    expect(move.captures).toEqual([4]);
  });
});

describe("full games", () => {
  it("always reaches a winner and never leaves an impossible state", () => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const rng = seededRng(seed);
      let state = createLudoGame(players(4));
      let guard = 0;

      while (state.phase !== "gameover" && guard < 8000) {
        guard += 1;
        const roll = Math.floor(rng() * 6) + 1;
        state = applyRoll(state, roll);

        if (state.moves.length === 0) {
          state = passTurn(state);
        } else {
          const move = chooseLudoMove(state, "medium", rng)!;
          state = applyMove(state, move.tokenId).state;
        }

        // Invariants that must hold after every single half-turn.
        expect(state.tokens).toHaveLength(16);
        for (const token of state.tokens) {
          expect(token.progress).toBeGreaterThanOrEqual(-1);
          expect(token.progress).toBeLessThanOrEqual(HOME_PROGRESS);
        }
        // Two tokens of different colours can never share an unsafe square.
        const occupied = new Map<number, number>();
        for (const token of state.tokens) {
          const ring = ringIndexForProgress(token.seat, token.progress);
          if (ring === null || SAFE_RING_INDICES.includes(ring)) continue;
          const owner = occupied.get(ring);
          if (owner !== undefined) expect(owner).toBe(token.owner);
          occupied.set(ring, token.owner);
        }
      }

      expect(state.phase).toBe("gameover");
      expect(state.winner).not.toBeNull();
      expect(isFinished(state, state.winner!)).toBe(true);
    }
  });
});
