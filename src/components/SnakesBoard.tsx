/**
 * The Snakes & Ladders board.
 *
 * The grid is HTML (it needs readable numbers that scale), and the snakes
 * and ladders are ONE SVG layer sitting on top of it. Drawing them as SVG
 * means a snake is a real curve between two squares rather than a picture
 * that only lines up at one screen size.
 */

import { BOARD_SIZE, LADDERS, SNAKES, coordOf, squaresInDrawOrder } from "../engine/snakes/board";
import type { SnakesState } from "../engine/snakes/rules";
import { colorDarkVar, colorVar } from "../lib/theme";

const CELL = 100 / BOARD_SIZE;

/** Centre of a square in SVG user units (the viewBox is 0..100). */
function centre(square: number): { x: number; y: number } {
  const { col, row } = coordOf(square);
  return { x: (col + 0.5) * CELL, y: (row + 0.5) * CELL };
}

/** A gentle pastel wash so the grid reads as a board, not a spreadsheet. */
const CELL_TINTS = [
  "var(--sky-light)",
  "var(--mint-light)",
  "var(--sun-light)",
  "var(--pink-light)",
  "var(--purple-light)",
  "var(--coral-light)",
];

function Ladder({ from, to, index }: { from: number; to: number; index: number }) {
  const a = centre(from);
  const b = centre(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  // Perpendicular unit vector: the two rails sit either side of the centre line.
  const nx = (-dy / length) * 1.6;
  const ny = (dx / length) * 1.6;
  const rungs = Math.max(3, Math.round(length / 6));

  return (
    <g className="sl-ladder" style={{ animationDelay: index * 0.12 + "s" }}>
      <line
        x1={a.x + nx}
        y1={a.y + ny}
        x2={b.x + nx}
        y2={b.y + ny}
        stroke="var(--sun-dark)"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <line
        x1={a.x - nx}
        y1={a.y - ny}
        x2={b.x - nx}
        y2={b.y - ny}
        stroke="var(--sun-dark)"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      {Array.from({ length: rungs }, (_, i) => {
        const t = (i + 0.5) / rungs;
        const x = a.x + dx * t;
        const y = a.y + dy * t;
        return (
          <line
            key={i}
            x1={x + nx}
            y1={y + ny}
            x2={x - nx}
            y2={y - ny}
            stroke="var(--sun)"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
}

const SNAKE_SKINS = [
  { body: "#5fbf6a", belly: "#a8e6a3" },
  { body: "#c86bd8", belly: "#eec2f5" },
  { body: "#f28c4b", belly: "#ffd0ab" },
  { body: "#4fb6d6", belly: "#b6e6f5" },
];

function Snake({ from, to, index }: { from: number; to: number; index: number }) {
  const head = centre(from);
  const tail = centre(to);
  const skin = SNAKE_SKINS[index % SNAKE_SKINS.length];

  const dx = tail.x - head.x;
  const dy = tail.y - head.y;
  const length = Math.hypot(dx, dy);
  // Two opposing control points give the body a soft S rather than an arc.
  const nx = (-dy / length) * Math.min(14, length * 0.34);
  const ny = (dx / length) * Math.min(14, length * 0.34);
  const c1 = { x: head.x + dx * 0.3 + nx, y: head.y + dy * 0.3 + ny };
  const c2 = { x: head.x + dx * 0.7 - nx, y: head.y + dy * 0.7 - ny };
  const path = `M ${head.x} ${head.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${tail.x} ${tail.y}`;

  // Point the head roughly back along the body so the face looks "up" the board.
  const angle = (Math.atan2(c1.y - head.y, c1.x - head.x) * 180) / Math.PI;

  return (
    <g className="sl-snake" style={{ animationDelay: index * 0.1 + "s" }}>
      <path d={path} fill="none" stroke={skin.body} strokeWidth="2.9" strokeLinecap="round" />
      <path
        d={path}
        fill="none"
        stroke={skin.belly}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeDasharray="1.5 2.3"
        opacity="0.85"
      />
      <g transform={`translate(${head.x} ${head.y}) rotate(${angle})`}>
        <ellipse rx="3.1" ry="2.5" fill={skin.body} />
        {/* Friendly, never fanged: big eyes, a smile, a little tongue. */}
        <circle cx="-1" cy="-1.1" r="0.95" fill="#fff" />
        <circle cx="1.1" cy="-1.1" r="0.95" fill="#fff" />
        <circle cx="-0.85" cy="-1" r="0.5" fill="#2b2b3d" />
        <circle cx="1.25" cy="-1" r="0.5" fill="#2b2b3d" />
        <path d="M -1.2 1 Q 0.1 2 1.4 1" stroke="#2b2b3d" strokeWidth="0.4" fill="none" strokeLinecap="round" />
        <path d="M -3.4 0 l -2 0 m 0 0 l -0.9 -0.7 m 0.9 0.7 l -0.9 0.7" stroke="#ff5c5c" strokeWidth="0.45" fill="none" strokeLinecap="round" />
      </g>
      <circle cx={tail.x} cy={tail.y} r="1.3" fill={skin.body} />
    </g>
  );
}

interface SnakesBoardProps {
  state: SnakesState;
  /** playerIndex -> square to draw instead of the engine's value. */
  overrides: Map<number, number>;
  /** Square the active player is heading for, highlighted while walking. */
  highlight: number | null;
  jumping: { kind: "snake" | "ladder"; player: number } | null;
}

export function SnakesBoard({ state, overrides, highlight, jumping }: SnakesBoardProps) {
  const squares = squaresInDrawOrder();

  // Group pieces by square so several players on one square fan out.
  const occupancy = new Map<number, number[]>();
  state.players.forEach((_, index) => {
    const square = overrides.get(index) ?? state.positions[index];
    // Pieces still waiting to start all share square 1's cell, so they are
    // grouped there too and fan out the same way.
    const key = square < 1 ? 1 : square;
    const list = occupancy.get(key) ?? [];
    list.push(index);
    occupancy.set(key, list);
  });

  return (
    <div className="sl" role="group" aria-label="Snakes and Ladders board">
      <div className="sl__grid">
        {squares.map((square) => {
          const jump = LADDERS.find((l) => l.from === square)
            ? "ladder"
            : SNAKES.find((s) => s.from === square)
              ? "snake"
              : null;
          return (
            <div
              key={square}
              className={
                "sl-cell" +
                (square === highlight ? " sl-cell--target" : "") +
                (square === 100 ? " sl-cell--finish" : "")
              }
              style={{ background: CELL_TINTS[(square + Math.floor((square - 1) / 10)) % CELL_TINTS.length] }}
            >
              <span className="sl-cell__num">{square}</span>
              {jump === "ladder" && <span className="sl-cell__hint" aria-hidden="true">🪜</span>}
              {jump === "snake" && <span className="sl-cell__hint" aria-hidden="true">🐍</span>}
              {square === 100 && <span className="sl-cell__hint" aria-hidden="true">🏁</span>}
            </div>
          );
        })}
      </div>

      <svg className="sl__art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {LADDERS.map((l, i) => (
          <Ladder key={"l" + l.from} from={l.from} to={l.to} index={i} />
        ))}
        {SNAKES.map((s, i) => (
          <Snake key={"s" + s.from} from={s.from} to={s.to} index={i} />
        ))}
      </svg>

      {/* ---- Pieces ------------------------------------------------------ */}
      {state.players.map((player, index) => {
        const square = overrides.get(index) ?? state.positions[index];
        const onBoard = square >= 1;
        const group = occupancy.get(onBoard ? square : 1) ?? [];
        const slot = group.indexOf(index);
        const fan = group.length > 1 ? (slot - (group.length - 1) / 2) * 2.6 : 0;

        // A piece that has not moved yet waits ON square 1, drawn smaller and
        // ringed, rather than parked off-canvas where a child cannot see it
        // at all. It steps off from there on the first roll.
        const position = onBoard ? centre(square) : centre(1);
        const isActive = state.turn === index && state.phase !== "gameover";
        const jumpClass =
          jumping && jumping.player === index
            ? jumping.kind === "ladder"
              ? " sl-piece--climb"
              : " sl-piece--slide"
            : "";

        return (
          <div
            key={player.id}
            className={
              "sl-piece" +
              (isActive ? " sl-piece--active" : "") +
              (onBoard ? "" : " sl-piece--waiting") +
              jumpClass
            }
            style={
              {
                left: position.x + fan + "%",
                top: position.y + "%",
                "--piece": colorVar(player.color),
                "--piece-edge": colorDarkVar(player.color),
                zIndex: 30 + slot + (isActive ? 5 : 0),
              } as React.CSSProperties
            }
          >
            <span className="sl-piece__face" aria-hidden="true">
              {player.avatar}
            </span>
          </div>
        );
      })}
    </div>
  );
}
