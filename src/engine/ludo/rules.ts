/**
 * Ludo rules.
 *
 * Every function here is pure: it takes a state and returns a new one. The
 * UI owns no rule of its own, which is why the same engine can be driven by
 * a click, by the AI, or by a test with no renderer at all.
 */

import type { EngineMessage, PlayerConfig } from "../types";
import {
  HOME_PROGRESS,
  LAST_RING_PROGRESS,
  SEATS,
  TOKENS_PER_PLAYER,
  isSafeRingIndex,
  ringIndexForProgress,
  seatsForPlayerCount,
} from "./board";

export interface LudoToken {
  id: number;
  /** Index into `state.players`. */
  owner: number;
  /** Board corner this token belongs to. */
  seat: number;
  /** Which of the four resting spots in the yard it uses when at home. */
  slot: number;
  /** -1 in yard, 0..55 on the track, 56 finished. */
  progress: number;
}

export type LudoMoveKind = "exit" | "advance" | "finish";

export interface LudoMove {
  tokenId: number;
  from: number;
  to: number;
  kind: LudoMoveKind;
  /** Ids of opponent tokens this move sends back to their yard. */
  captures: number[];
  /** True when the destination is a star or start square. */
  safe: boolean;
  /** True when the destination is inside the player's own home column. */
  homeColumn: boolean;
}

export type LudoPhase = "roll" | "choose" | "gameover";

/** Why the current player cannot move, when they cannot. */
export type LudoBlock = null | "no-moves" | "three-sixes" | "retry";

export interface LudoState {
  players: PlayerConfig[];
  /** seats[playerIndex] maps a player to a board corner. */
  seats: number[];
  tokens: LudoToken[];
  turn: number;
  dice: number | null;
  phase: LudoPhase;
  consecutiveSixes: number;
  /**
   * Rolls used so far this turn while every token is still in the yard.
   * A player stuck in base gets three tries to find a six -- see applyRoll.
   */
  attempts: number;
  moves: LudoMove[];
  blocked: LudoBlock;
  winner: number | null;
  ranking: number[];
  message: EngineMessage;
  turnCount: number;
  /** Per-player tallies, used by the victory screen. */
  captures: number[];
  sixes: number[];
  rolls: number[];
}

export interface LudoMoveResult {
  state: LudoState;
  /** Progress values the token passes through, for the walking animation. */
  path: number[];
  captured: number[];
  reachedHome: boolean;
  extraTurn: boolean;
  move: LudoMove;
}

export function createLudoGame(players: PlayerConfig[]): LudoState {
  const seats = seatsForPlayerCount(players.length);
  const tokens: LudoToken[] = [];
  players.forEach((_, playerIndex) => {
    for (let slot = 0; slot < TOKENS_PER_PLAYER; slot += 1) {
      tokens.push({
        id: playerIndex * TOKENS_PER_PLAYER + slot,
        owner: playerIndex,
        seat: seats[playerIndex],
        slot,
        progress: -1,
      });
    }
  });

  return {
    players,
    seats,
    tokens,
    turn: 0,
    dice: null,
    phase: "roll",
    consecutiveSixes: 0,
    attempts: 0,
    moves: [],
    blocked: null,
    winner: null,
    ranking: [],
    message: { key: "msg.rollDice", args: { name: players[0].name } },
    turnCount: 0,
    captures: players.map(() => 0),
    sixes: players.map(() => 0),
    rolls: players.map(() => 0),
  };
}

export function tokensOf(state: LudoState, playerIndex: number): LudoToken[] {
  return state.tokens.filter((t) => t.owner === playerIndex);
}

export function isFinished(state: LudoState, playerIndex: number): boolean {
  return tokensOf(state, playerIndex).every((t) => t.progress === HOME_PROGRESS);
}

/** Opponent tokens standing on `ringIndex`. Own tokens are never captured. */
function opponentsOn(state: LudoState, ringIndex: number, owner: number): LudoToken[] {
  return state.tokens.filter((t) => {
    if (t.owner === owner) return false;
    const idx = ringIndexForProgress(t.seat, t.progress);
    return idx !== null && idx === ringIndex;
  });
}

/** Every move the given player could legally make with the given roll. */
export function legalMoves(state: LudoState, playerIndex: number, dice: number): LudoMove[] {
  const moves: LudoMove[] = [];
  const seen = new Set<string>();

  for (const token of tokensOf(state, playerIndex)) {
    if (token.progress === HOME_PROGRESS) continue;

    let to: number;
    let kind: LudoMoveKind;

    if (token.progress < 0) {
      // Only a six lets a token out of the yard.
      if (dice !== 6) continue;
      to = 0;
      kind = "exit";
    } else {
      to = token.progress + dice;
      // The final square must be reached exactly; overshooting is no move.
      if (to > HOME_PROGRESS) continue;
      kind = to === HOME_PROGRESS ? "finish" : "advance";
    }

    // Four identical tokens sitting in the yard would otherwise offer four
    // identical "come out" moves. Offer one.
    const signature = token.progress + ":" + to;
    if (seen.has(signature)) continue;
    seen.add(signature);

    const ringIndex = ringIndexForProgress(token.seat, to);
    const safe = ringIndex !== null && isSafeRingIndex(ringIndex);
    const captures =
      ringIndex !== null && !safe
        ? opponentsOn(state, ringIndex, playerIndex).map((t) => t.id)
        : [];

    moves.push({
      tokenId: token.id,
      from: token.progress,
      to,
      kind,
      captures,
      safe,
      homeColumn: to > LAST_RING_PROGRESS && to < HOME_PROGRESS,
    });
  }

  return moves;
}

/** Record a dice value for the player whose turn it is. */
export function applyRoll(state: LudoState, value: number): LudoState {
  if (state.phase !== "roll") return state;

  const player = state.players[state.turn];
  const consecutiveSixes = value === 6 ? state.consecutiveSixes + 1 : 0;
  const rolls = state.rolls.slice();
  rolls[state.turn] += 1;
  const sixes = state.sixes.slice();
  if (value === 6) sixes[state.turn] += 1;

  // Three sixes in a row forfeits the turn -- otherwise a lucky streak can
  // run forever and nobody else gets to play.
  if (consecutiveSixes >= 3) {
    return {
      ...state,
      dice: value,
      moves: [],
      phase: "choose",
      blocked: "three-sixes",
      consecutiveSixes,
      attempts: state.attempts + 1,
      rolls,
      sixes,
      message: { key: "msg.threeSixes" },
    };
  }

  const moves = legalMoves(state, state.turn, value);
  const attempts = state.attempts + 1;

  /*
   * THREE TRIES TO GET OUT.
   *
   * Only a six frees a token, so a player whose four tokens are all still in
   * the yard can otherwise sit through turn after turn in which literally
   * nothing happens. That is the fastest way to lose a five-year-old's
   * attention, and it is also a standard Ludo rule rather than an invention:
   * with nothing on the board you may roll up to three times.
   *
   * It costs nothing in fairness -- everyone gets it, and it only applies
   * when there was no move to make anyway.
   */
  const stuckInBase = tokensOf(state, state.turn).every((t) => t.progress < 0);
  if (moves.length === 0 && stuckInBase && attempts < 3) {
    return {
      ...state,
      dice: value,
      moves: [],
      phase: "roll",
      blocked: "retry",
      consecutiveSixes,
      attempts,
      rolls,
      sixes,
      message: { key: "msg.tryAgain" },
    };
  }

  return {
    ...state,
    dice: value,
    moves,
    phase: "choose",
    blocked: moves.length === 0 ? "no-moves" : null,
    consecutiveSixes,
    attempts,
    rolls,
    sixes,
    message:
      moves.length === 0
        ? { key: "msg.noMoves", args: { name: player.name } }
        : moves.length === 1
          ? { key: "msg.onlyOneMove" }
          : { key: "msg.pickToken", args: { name: player.name } },
  };
}

/** Hand the turn to the next player who has not finished. */
export function passTurn(state: LudoState): LudoState {
  if (state.phase === "gameover") return state;
  let next = state.turn;
  for (let i = 1; i <= state.players.length; i += 1) {
    const candidate = (state.turn + i) % state.players.length;
    if (!isFinished(state, candidate)) {
      next = candidate;
      break;
    }
  }
  return {
    ...state,
    turn: next,
    dice: null,
    moves: [],
    blocked: null,
    consecutiveSixes: 0,
    attempts: 0,
    phase: "roll",
    turnCount: state.turnCount + 1,
    message: { key: "msg.rollDice", args: { name: state.players[next].name } },
  };
}

const NO_MOVE: LudoMove = {
  tokenId: -1,
  from: 0,
  to: 0,
  kind: "advance",
  captures: [],
  safe: false,
  homeColumn: false,
};

/** Move a token, resolving captures, home arrivals and extra turns. */
export function applyMove(state: LudoState, tokenId: number): LudoMoveResult {
  const move = state.moves.find((m) => m.tokenId === tokenId);
  if (!move) {
    return {
      state,
      path: [],
      captured: [],
      reachedHome: false,
      extraTurn: false,
      move: NO_MOVE,
    };
  }

  const tokens = state.tokens.map((t) => ({ ...t }));
  const moving = tokens.find((t) => t.id === tokenId)!;
  moving.progress = move.to;

  for (const id of move.captures) {
    const victim = tokens.find((t) => t.id === id)!;
    victim.progress = -1;
  }

  const captures = state.captures.slice();
  captures[state.turn] += move.captures.length;

  const reachedHome = move.to === HOME_PROGRESS;
  const rolledSix = state.dice === 6;
  const extraTurn = rolledSix || move.captures.length > 0 || reachedHome;

  // Walking path for the animation: every square the piece passes over.
  const path: number[] = [];
  if (move.kind === "exit") {
    path.push(0);
  } else {
    for (let p = move.from + 1; p <= move.to; p += 1) path.push(p);
  }

  let next: LudoState = { ...state, tokens, captures, moves: [], blocked: null };

  const playerDone = tokensOf(next, state.turn).every((t) => t.progress === HOME_PROGRESS);
  if (playerDone) {
    const ranking = [...next.ranking, state.turn];
    return {
      state: {
        ...next,
        ranking,
        winner: next.winner ?? state.turn,
        phase: "gameover",
        dice: state.dice,
        message: { key: "msg.wins", args: { name: state.players[state.turn].name } },
      },
      path,
      captured: move.captures,
      reachedHome,
      extraTurn: false,
      move,
    };
  }

  if (extraTurn) {
    next = {
      ...next,
      phase: "roll",
      dice: null,
      attempts: 0,
      message: move.captures.length
        ? { key: "msg.captured" }
        : reachedHome
          ? { key: "msg.tokenHome" }
          : { key: "msg.rolledSix" },
    };
  } else {
    next = passTurn({ ...next, phase: "roll" });
  }

  return { state: next, path, captured: move.captures, reachedHome, extraTurn, move };
}

export { HOME_PROGRESS, SEATS, TOKENS_PER_PLAYER };
