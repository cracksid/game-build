import type { ColorId } from "../engine/types";

export const COLORS: ColorId[] = ["red", "green", "yellow", "blue"];

/** CSS custom-property names, so a colour is never written twice. */
export function colorVar(color: ColorId): string {
  return "var(--p-" + color + ")";
}

export function colorDarkVar(color: ColorId): string {
  return "var(--p-" + color + "-dark)";
}

export function colorWashVar(color: ColorId): string {
  return "var(--p-" + color + "-wash)";
}

/**
 * The computer's characters. The name and the face are ONE thing, because a
 * panda called "Foxy" is exactly the sort of small wrongness a child spots
 * immediately.
 */
export const AI_CHARACTERS: { name: string; avatar: string }[] = [
  { name: "Panda", avatar: "🐼" },
  { name: "Tiger", avatar: "🐯" },
  { name: "Bunny", avatar: "🐰" },
  { name: "Froggy", avatar: "🐸" },
];
