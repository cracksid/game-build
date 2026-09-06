/**
 * Snakes & Ladders rules.
 *
 * Two decisions worth knowing about:
 *
 * - Overshooting 100 BOUNCES BACK rather than forfeiting the move. Needing
 *   an exact roll means a run of turns where nothing happens at all, which
 *   is the least fun place to be in a children's game. Bouncing keeps every
 *   turn eventful and is still exact: you land on 100 or you do not.
 * - Rolling a six earns another turn, which gives a losing player a way back.
 */

import type { EngineMessage, PlayerConfig } from "../types";
import { LAST_SQUARE, jumpFrom } from "./board";
import type { JumpKind } from "./board";

export type SnakesPhase = "roll" | "moving" | "gameover";

export interface SnakesState {
  players: PlayerConfig[];
  /** positions[playerIndex]: 0 means "not on the board yet". */
  positions: number[];
  turn: number;
  dice: number | null;
  phase: SnakesPhase;
  winner: number | null;
  ranking: number[];
  message: EngineMessage;
  turnCount: number;
  /** Per-player tallies for the victory screen and achievements. */
  laddersClimbed: number[];
  snakesHit: number[];
  sixes: number[];
  rolls: number[];
}

export interface SnakesMoveResult {
  state: SnakesState;
  /** Squares stepped through, including any bounce-back, for animation. */
  walk: number[];
  /** The ladder or snake taken after the walk, if any. */
  jump: { from: number; to: number; kind: JumpKind } | null;
  bounced: boolean;
  extraTurn: boolean;
  won: boolean;
}

export function createSnakesGame(players: PlayerConfig[]): SnakesState {
  return {
    players,
    positions: players.map(() => 0),
    turn: 0,
    dice: null,
    phase: "roll",
    winner: null,
    ranking: [],
    message: { key: "msg.rollDice", args: { name: players[0].name } },
    turnCount: 0,
    laddersClimbed: players.map(() => 0),
    snakesHit: players.map(() => 0),
    sixes: players.map(() => 0),
    rolls: players.map(() => 0),
  };
}

/**
 * Where a piece ends up after walking `dice` squares, and the squares it
 * passes over on the way. Past 100 it walks up to the top and back down.
 */
export function walkPath(from: number, dice: number): { walk: number[]; bounced: boolean } {
  const total = from + dice;
  const bounced = total > LAST_SQUARE;
  const walk: number[] = [];

  const top = Math.min(total, LAST_SQUARE);
  for (let square = from + 1; square <= top; square += 1) walk.push(square);

  if (bounced) {
    // Overshot: the leftover steps walk back down from 100.
    const end = LAST_SQUARE - (total - LAST_SQUARE);
    for (let square = LAST_SQUARE - 1; square >= end; square -= 1) walk.push(square);
  }

  return { walk, bounced };
}

/** Roll and move in one step: this game has no decision for a player to make. */
export function applyRoll(state: SnakesState, dice: number): SnakesMoveResult {
  if (state.phase === "gameover") {
    return { state, walk: [], jump: null, bounced: false, extraTurn: false, won: false };
  }

  const player = state.turn;
  const from = state.positions[player];
  const { walk, bounced } = walkPath(from, dice);
  const landed = walk.length ? walk[walk.length - 1] : from;

  const jumpTarget = jumpFrom(landed);
  const jump = jumpTarget ? { from: landed, to: jumpTarget.to, kind: jumpTarget.kind } : null;
  const final = jump ? jump.to : landed;

  const positions = state.positions.slice();
  positions[player] = final;

  const rolls = state.rolls.slice();
  rolls[player] += 1;
  const sixes = state.sixes.slice();
  if (dice === 6) sixes[player] += 1;
  const laddersClimbed = state.laddersClimbed.slice();
  const snakesHit = state.snakesHit.slice();
  if (jump?.kind === "ladder") laddersClimbed[player] += 1;
  if (jump?.kind === "snake") snakesHit[player] += 1;

  const won = final === LAST_SQUARE;

  if (won) {
    return {
      state: {
        ...state,
        positions,
        rolls,
        sixes,
        laddersClimbed,
        snakesHit,
        dice,
        phase: "gameover",
        winner: player,
        ranking: [...state.ranking, player],
        message: { key: "msg.reached100", args: { name: state.players[player].name } },
      },
      walk,
      jump,
      bounced,
      extraTurn: false,
      won: true,
    };
  }

  const extraTurn = dice === 6;
  const nextTurn = extraTurn ? player : (player + 1) % state.players.length;

  let message: EngineMessage;
  if (jump?.kind === "ladder") message = { key: "msg.ladder" };
  else if (jump?.kind === "snake") message = { key: "msg.snake" };
  else if (bounced) message = { key: "msg.bounce" };
  else if (extraTurn) message = { key: "msg.rolledSix" };
  else message = { key: "msg.rollDice", args: { name: state.players[nextTurn].name } };

  return {
    state: {
      ...state,
      positions,
      rolls,
      sixes,
      laddersClimbed,
      snakesHit,
      dice,
      turn: nextTurn,
      turnCount: state.turnCount + 1,
      phase: "roll",
      message,
    },
    walk,
    jump,
    bounced,
    extraTurn,
    won: false,
  };
}
