/**
 * The Ludo board.
 *
 * Purely presentational: it is handed a state, a set of display overrides
 * (used while a piece is mid-walk) and a set of highlighted tokens, and it
 * draws them. It decides nothing about the rules.
 *
 * Everything is positioned as a percentage of a square container, so the
 * board scales from a phone to a desktop without a single breakpoint.
 */

import { Fragment } from "react";

import { GRID, RING, SEATS, STAR_RING_INDICES, cellForProgress } from "../engine/ludo/board";
import { HOME_PROGRESS } from "../engine/ludo/rules";
import type { LudoState } from "../engine/ludo/rules";
import type { ColorId } from "../engine/types";
import { colorDarkVar, colorVar, colorWashVar } from "../lib/theme";

const UNIT = 100 / GRID;

function pct(value: number): string {
  return value * UNIT + "%";
}

/** Which seat owns a ring square as its start, if any. */
const ENTRY_SEAT = new Map(SEATS.map((seat) => [seat.entry, seat.index]));

interface LudoBoardProps {
  state: LudoState;
  /** tokenId -> progress to draw instead of the engine's value. */
  overrides: Map<number, number>;
  /** Tokens the player may tap right now. */
  selectable: Set<number>;
  /** Tokens being knocked back to base, for the capture animation. */
  capturing: Set<number>;
  /** The square a highlighted move would land on. */
  targets: Map<number, number>;
  onTokenClick: (tokenId: number) => void;
  activeSeat: number | null;
  labelFor: (tokenId: number) => string;
}

export function LudoBoard({
  state,
  overrides,
  selectable,
  capturing,
  targets,
  onTokenClick,
  activeSeat,
  labelFor,
}: LudoBoardProps) {
  /**
   * A corner is painted in the colour of WHOEVER IS SITTING IN IT, not the
   * fixed colour the seat happens to be named after.
   *
   * With two players the seats used are opposite corners (0 and 2, "red" and
   * "yellow"), so a player who picked green would otherwise get green tokens
   * standing in a yellow yard, running down a yellow home column. Colour is
   * how a child tracks whose piece is whose, so it has to agree everywhere.
   */
  const seatColor = new Map<number, ColorId>();
  state.seats.forEach((seat, playerIndex) => {
    seatColor.set(seat, state.players[playerIndex].color);
  });
  const paint = (seat: number) => {
    const color = seatColor.get(seat);
    return color ? colorVar(color) : "#e4dcf0";
  };
  const paintDark = (seat: number) => {
    const color = seatColor.get(seat);
    return color ? colorDarkVar(color) : "#b9aecd";
  };
  const paintWash = (seat: number) => {
    const color = seatColor.get(seat);
    return color ? colorWashVar(color) : "#f2edf8";
  };

  // Where each token is drawn right now, and how tokens sharing a square are
  // fanned out so none is completely hidden behind another.
  const placed = state.tokens.map((token) => {
    const progress = overrides.get(token.id) ?? token.progress;
    const cell = cellForProgress(token.seat, progress, token.slot);
    return { token, progress, cell };
  });

  const crowd = new Map<string, number[]>();
  for (const { token, progress, cell } of placed) {
    // Yard spots and finished spots are already laid out individually.
    if (progress < 0 || progress === HOME_PROGRESS) continue;
    const key = cell.x + "," + cell.y;
    const list = crowd.get(key) ?? [];
    list.push(token.id);
    crowd.set(key, list);
  }

  const targetCells = new Set<string>();
  for (const [tokenId, to] of targets) {
    const token = state.tokens.find((t) => t.id === tokenId);
    if (!token) continue;
    const cell = cellForProgress(token.seat, to, token.slot);
    targetCells.add(cell.x + "," + cell.y);
  }

  return (
    <div className="ludo" role="group" aria-label="Ludo board">
      {/* ---- Four yards ------------------------------------------------ */}
      {SEATS.map((seat) => {
        const seated = state.seats.includes(seat.index);
        return (
          <div
            key={"yard" + seat.index}
            className={
              "ludo-yard" +
              (seated ? "" : " ludo-yard--empty") +
              (activeSeat === seat.index ? " ludo-yard--active" : "")
            }
            style={{
              left: pct(seat.yardOrigin.x),
              top: pct(seat.yardOrigin.y),
              width: pct(6),
              height: pct(6),
              background: paint(seat.index),
            }}
            aria-hidden="true"
          >
            <div className="ludo-yard__inner">
              {seat.yard.map((spot, i) => (
                <span
                  key={i}
                  className="ludo-yard__slot"
                  style={{
                    left: pct(spot.x - seat.yardOrigin.x) ,
                    top: pct(spot.y - seat.yardOrigin.y),
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* ---- The 52 shared squares ------------------------------------- */}
      {RING.map((cell, index) => {
        const entrySeat = ENTRY_SEAT.get(index);
        const isStar = STAR_RING_INDICES.includes(index);
        const isTarget = targetCells.has(cell.x + "," + cell.y);
        return (
          <div
            key={"ring" + index}
            className={"ludo-cell" + (isTarget ? " ludo-cell--target" : "")}
            style={{
              left: pct(cell.x),
              top: pct(cell.y),
              width: pct(1),
              height: pct(1),
              background: entrySeat !== undefined ? paintWash(entrySeat) : undefined,
            }}
            aria-hidden="true"
          >
            {isStar && <span className="ludo-cell__star">★</span>}
            {entrySeat !== undefined && (
              <span className="ludo-cell__arrow" style={{ color: paintDark(entrySeat) }}>
                ➜
              </span>
            )}
          </div>
        );
      })}

      {/* ---- Home columns ---------------------------------------------- */}
      {SEATS.map((seat) => (
        <Fragment key={"home" + seat.index}>
          {seat.homeColumn.map((cell, i) => {
            const isTarget = targetCells.has(cell.x + "," + cell.y);
            return (
              <div
                key={i}
                className={"ludo-cell ludo-cell--path" + (isTarget ? " ludo-cell--target" : "")}
                style={{
                  left: pct(cell.x),
                  top: pct(cell.y),
                  width: pct(1),
                  height: pct(1),
                  background: paint(seat.index),
                  opacity: state.seats.includes(seat.index) ? 1 : 0.28,
                }}
                aria-hidden="true"
              />
            );
          })}
        </Fragment>
      ))}

      {/* ---- Centre: four triangles meeting at the middle -------------- */}
      <svg
        className="ludo-centre"
        viewBox="0 0 100 100"
        style={{ left: pct(6), top: pct(6), width: pct(3), height: pct(3) }}
        aria-hidden="true"
      >
        {/* Seat 0 is the bottom-left corner, 1 top-left, 2 top-right,
            3 bottom-right -- so each triangle faces its own yard. */}
        <polygon points="0,100 100,100 50,50" fill={paint(0)} />
        <polygon points="0,0 0,100 50,50" fill={paint(1)} />
        <polygon points="0,0 100,0 50,50" fill={paint(2)} />
        <polygon points="100,0 100,100 50,50" fill={paint(3)} />
        <circle cx="50" cy="50" r="13" fill="#fff" opacity="0.9" />
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="16"
        >
          🏠
        </text>
      </svg>

      {/* ---- Tokens ---------------------------------------------------- */}
      {placed.map(({ token, progress, cell }) => {
        const player = state.players[token.owner];
        const key = cell.x + "," + cell.y;
        const group = crowd.get(key) ?? [];
        const indexInGroup = group.indexOf(token.id);
        const stacked = group.length > 1 && indexInGroup >= 0;

        // Fan a crowded square out in a small ring so each piece stays visible.
        const angle = stacked ? (indexInGroup / group.length) * Math.PI * 2 : 0;
        const spread = stacked ? Math.min(0.26, 0.1 + group.length * 0.04) : 0;
        const dx = stacked ? Math.cos(angle) * spread : 0;
        const dy = stacked ? Math.sin(angle) * spread : 0;

        const isSelectable = selectable.has(token.id);
        const isCapturing = capturing.has(token.id);
        const finished = progress === HOME_PROGRESS;

        const classes = [
          "ludo-token",
          isSelectable ? "ludo-token--pick" : "",
          isCapturing ? "ludo-token--captured" : "",
          finished ? "ludo-token--home" : "",
          progress < 0 ? "ludo-token--base" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            key={token.id}
            type="button"
            className={classes}
            disabled={!isSelectable}
            onClick={() => onTokenClick(token.id)}
            aria-label={labelFor(token.id)}
            style={
              {
                left: pct(cell.x + 0.5 + dx),
                top: pct(cell.y + 0.5 + dy),
                "--token": colorVar(player.color),
                "--token-edge": colorDarkVar(player.color),
                zIndex: 20 + (isSelectable ? 6 : 0) + indexInGroup,
              } as React.CSSProperties
            }
          >
            <span className="ludo-token__body">
              <span className="ludo-token__face" aria-hidden="true">
                {player.avatar}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
