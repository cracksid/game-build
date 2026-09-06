/**
 * The dice roll, as a hook shared by both games.
 *
 * The number must NOT appear the instant the button is pressed. A die that
 * simply flips to its answer feels decided-for-you; one that tumbles for
 * half a second and lands feels thrown. So the face cycles while the roll is
 * in flight and the engine is only told the result at the end.
 *
 * The real value is drawn once, up front, and the cycling faces are pure
 * decoration -- if the animation is cut short (unmount, animation turned
 * off) the outcome is unchanged.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { playSound } from "../audio/sound";
import { rollDie } from "../engine/dice";
import type { AnimationLevel } from "../state/types";

const TUMBLE_MS = 720;
const FRAME_MS = 85;

export interface DiceRoller {
  face: number;
  rolling: boolean;
  roll: () => void;
  /** Set the shown face without animating -- used when resuming a game. */
  setFace: (value: number) => void;
}

export function useDice(
  onResult: (value: number) => void,
  animation: AnimationLevel,
): DiceRoller {
  const [face, setFace] = useState(1);
  const [rolling, setRolling] = useState(false);
  const timers = useRef<number[]>([]);
  // The callback changes on nearly every render; a ref keeps `roll` stable so
  // effects depending on it do not re-run each time.
  const resultRef = useRef(onResult);
  resultRef.current = onResult;
  const rollingRef = useRef(false);

  const clearTimers = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const roll = useCallback(() => {
    if (rollingRef.current) return;
    const value = rollDie();

    if (animation === "off") {
      setFace(value);
      playSound("diceResult");
      resultRef.current(value);
      return;
    }

    const duration = animation === "calm" ? TUMBLE_MS * 0.6 : TUMBLE_MS;
    rollingRef.current = true;
    setRolling(true);
    playSound("dice");

    let shown = face;
    for (let at = 0; at < duration - FRAME_MS; at += FRAME_MS) {
      timers.current.push(
        window.setTimeout(() => {
          // Never show the same face twice running: it reads as a stall.
          let next = shown;
          while (next === shown) next = rollDie();
          shown = next;
          setFace(next);
        }, at),
      );
    }

    timers.current.push(
      window.setTimeout(() => {
        setFace(value);
        setRolling(false);
        rollingRef.current = false;
        playSound("diceResult");
        resultRef.current(value);
      }, duration),
    );
  }, [animation, face]);

  return { face, rolling, roll, setFace };
}
