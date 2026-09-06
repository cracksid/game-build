/**
 * The dice button.
 *
 * Drawn as pips rather than a numeral: a five-year-old who cannot yet read
 * numbers can still count dots, and counting the dots is half the fun.
 */

import type { ColorId } from "../engine/types";
import { colorDarkVar, colorVar } from "../lib/theme";

/** Pip positions on a 3x3 grid, per face. */
const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
  ],
  5: [
    [0, 0],
    [2, 0],
    [1, 1],
    [0, 2],
    [2, 2],
  ],
  6: [
    [0, 0],
    [2, 0],
    [0, 1],
    [2, 1],
    [0, 2],
    [2, 2],
  ],
};

interface DiceProps {
  face: number;
  rolling: boolean;
  disabled?: boolean;
  color: ColorId;
  onRoll: () => void;
  label: string;
}

export function Dice({ face, rolling, disabled, color, onRoll, label }: DiceProps) {
  const pips = PIPS[face] ?? PIPS[1];

  return (
    <button
      type="button"
      className={"dice" + (rolling ? " dice--rolling" : "") + (disabled ? " dice--idle" : "")}
      onClick={onRoll}
      disabled={disabled || rolling}
      aria-label={label}
      style={
        {
          "--dice-color": colorVar(color),
          "--dice-edge": colorDarkVar(color),
        } as React.CSSProperties
      }
    >
      <span className="dice__shadow" aria-hidden="true" />
      <span className="dice__cube">
        <span className="dice__face" key={face}>
          {pips.map(([x, y], i) => (
            <span
              className="dice__pip"
              key={i}
              style={{ gridColumn: x + 1, gridRow: y + 1 }}
              aria-hidden="true"
            />
          ))}
        </span>
      </span>
      {/* The value in text, for screen readers and for anyone who finds dots
          hard to count at a glance. */}
      <span className="sr-only">{rolling ? "Rolling" : "Rolled " + face}</span>
    </button>
  );
}
