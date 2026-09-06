/**
 * Confetti.
 *
 * A canvas particle burst rather than hundreds of DOM nodes: two hundred
 * animated divs will drop frames on a tablet, and this is exactly the moment
 * the app must not stutter.
 *
 * The canvas is fixed, full-screen and pointer-events: none, so it never
 * blocks the victory buttons underneath it.
 */

import { useEffect, useRef } from "react";

const PIECE_COLORS = [
  "#ff5c5c",
  "#ffc93c",
  "#3ecf8e",
  "#4d96ff",
  "#9b6be8",
  "#ff8fb1",
  "#ff7a5c",
];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  spin: number;
  angle: number;
  color: string;
  shape: "rect" | "circle";
}

interface ConfettiProps {
  /** Bursts again whenever this changes. */
  trigger: number;
  active: boolean;
  intensity?: number;
}

export function Confetti({ trigger, active, intensity = 1 }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const piecesRef = useRef<Piece[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const width = () => canvas.width / dpr;
    const height = () => canvas.height / dpr;

    // Two fountains from the bottom corners plus a shower from the top: the
    // shape reads as celebration rather than as weather.
    const count = Math.round(150 * intensity);
    const pieces: Piece[] = [];
    for (let i = 0; i < count; i += 1) {
      const fromLeft = i % 2 === 0;
      const fountain = i < count * 0.6;
      pieces.push(
        fountain
          ? {
              x: fromLeft ? 0 : width(),
              y: height(),
              vx: (fromLeft ? 1 : -1) * (5 + Math.random() * 7),
              vy: -(11 + Math.random() * 9),
              size: 6 + Math.random() * 8,
              spin: (Math.random() - 0.5) * 0.4,
              angle: Math.random() * Math.PI,
              color: PIECE_COLORS[i % PIECE_COLORS.length],
              shape: Math.random() < 0.35 ? "circle" : "rect",
            }
          : {
              x: Math.random() * width(),
              y: -20 - Math.random() * height() * 0.5,
              vx: (Math.random() - 0.5) * 3,
              vy: 2 + Math.random() * 4,
              size: 6 + Math.random() * 8,
              spin: (Math.random() - 0.5) * 0.4,
              angle: Math.random() * Math.PI,
              color: PIECE_COLORS[i % PIECE_COLORS.length],
              shape: Math.random() < 0.35 ? "circle" : "rect",
            },
      );
    }
    piecesRef.current = pieces;

    const gravity = 0.42;
    const drag = 0.995;
    let last = performance.now();

    const frame = (now: number) => {
      // Scale by real elapsed time so the fall looks the same at 60 and 120Hz.
      const dt = Math.min((now - last) / 16.667, 2.5);
      last = now;
      ctx.clearRect(0, 0, width(), height());

      let alive = 0;
      for (const p of piecesRef.current) {
        p.vy += gravity * dt;
        p.vx *= drag;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;

        if (p.y > height() + 40) continue;
        alive += 1;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        }
        ctx.restore();
      }

      if (alive > 0) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, width(), height());
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [trigger, active, intensity]);

  if (!active) return null;
  return <canvas ref={canvasRef} className="confetti-canvas" aria-hidden="true" />;
}
