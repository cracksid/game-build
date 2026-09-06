/**
 * Snakes & Ladders, played.
 *
 * Same shape as the Ludo screen: the engine resolves the whole turn at once
 * and this screen replays it. The replay has three beats -- walk square by
 * square, pause on the landing square, then take the snake or the ladder --
 * because a piece that arrives at its final square in one motion hides the
 * very thing the game is about.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { playSound } from "../audio/sound";
import { Confetti } from "../components/Confetti";
import { Dice } from "../components/Dice";
import { SnakesBoard } from "../components/SnakesBoard";
import { VictoryModal } from "../components/VictoryModal";
import type { VictoryStat } from "../components/VictoryModal";
import { Button, IconButton } from "../components/ui";
import { LAST_SQUARE } from "../engine/snakes/board";
import { applyRoll, createSnakesGame } from "../engine/snakes/rules";
import type { SnakesState } from "../engine/snakes/rules";
import type { PlayerConfig } from "../engine/types";
import { useDice } from "../lib/useDice";
import { useStore } from "../state/store";

interface Walk {
  player: number;
  squares: number[];
  step: number;
  jump: { from: number; to: number; kind: "snake" | "ladder" } | null;
  stage: "walking" | "pausing" | "jumping";
}

interface SnakesScreenProps {
  players: PlayerConfig[];
  resume: boolean;
  onHome: () => void;
  onChangeGame: () => void;
  onHelp: () => void;
}

const STEP_MS = { full: 175, calm: 105, off: 0 } as const;
const PAUSE_MS = { full: 380, calm: 220, off: 0 } as const;
const JUMP_MS = { full: 900, calm: 520, off: 0 } as const;
const AI_DELAY = { full: 800, calm: 500, off: 120 } as const;

export function SnakesScreen({ players, resume, onHome, onChangeGame, onHelp }: SnakesScreenProps) {
  const { settings, savedGame, saveGame, clearSavedGame, recordResult, recordFirstRoll, pushToasts, t } =
    useStore();
  const anim = settings.animation;

  const [state, setState] = useState<SnakesState>(() => {
    if (resume && savedGame?.game === "snakes") return savedGame.state as SnakesState;
    return createSnakesGame(players);
  });
  const [walk, setWalk] = useState<Walk | null>(null);
  const [confettiKey, setConfettiKey] = useState(0);
  const [showVictory, setShowVictory] = useState(false);
  const [starsEarned, setStarsEarned] = useState(0);

  const recorded = useRef(false);
  const firstRollDone = useRef(false);
  const timers = useRef<number[]>([]);

  const after = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  }, []);

  useEffect(
    () => () => {
      for (const id of timers.current) window.clearTimeout(id);
      timers.current = [];
    },
    [],
  );

  const busy = walk !== null;
  const player = state.players[state.turn];
  const isHumanTurn = player?.kind === "human" && state.phase !== "gameover";

  const onRollResult = useCallback(
    (value: number) => {
      if (!firstRollDone.current) {
        firstRollDone.current = true;
        pushToasts(recordFirstRoll());
      }
      setState((current) => {
        const mover = current.turn;
        const result = applyRoll(current, value);

        if (anim === "off") {
          if (result.jump?.kind === "ladder") playSound("ladder");
          else if (result.jump?.kind === "snake") playSound("snake");
        } else if (result.walk.length) {
          setWalk({
            player: mover,
            squares: result.walk,
            step: 0,
            jump: result.jump,
            stage: "walking",
          });
          playSound("step");
        }

        return result.state;
      });
    },
    [anim, pushToasts, recordFirstRoll],
  );

  const dice = useDice(onRollResult, anim);

  /* ---- Replaying the turn --------------------------------------------- */

  useEffect(() => {
    if (!walk) return;

    if (walk.stage === "walking") {
      if (walk.step < walk.squares.length - 1) {
        const id = window.setTimeout(() => {
          playSound("step");
          setWalk((c) => (c && c.stage === "walking" ? { ...c, step: c.step + 1 } : c));
        }, STEP_MS[anim]);
        return () => window.clearTimeout(id);
      }
      // Landed. If there is nothing special here, the turn is over.
      const id = window.setTimeout(
        () => {
          setWalk((c) => (c ? (c.jump ? { ...c, stage: "pausing" } : null) : c));
        },
        walk.jump ? STEP_MS[anim] : PAUSE_MS[anim],
      );
      return () => window.clearTimeout(id);
    }

    if (walk.stage === "pausing") {
      // A beat on the snake's head or the ladder's foot, so it registers.
      const id = window.setTimeout(() => {
        if (walk.jump?.kind === "ladder") playSound("ladder");
        else playSound("snake");
        setWalk((c) => (c ? { ...c, stage: "jumping" } : c));
      }, PAUSE_MS[anim]);
      return () => window.clearTimeout(id);
    }

    const id = window.setTimeout(() => setWalk(null), JUMP_MS[anim]);
    return () => window.clearTimeout(id);
  }, [walk, anim]);

  /* ---- The computer's turn -------------------------------------------- */

  useEffect(() => {
    if (busy || state.phase === "gameover" || dice.rolling) return;
    if (state.players[state.turn].kind !== "ai") return;
    const id = after(AI_DELAY[anim], () => dice.roll());
    return () => window.clearTimeout(id);
  }, [state, busy, anim, dice, after]);

  /* ---- Victory --------------------------------------------------------- */

  useEffect(() => {
    if (state.phase !== "gameover" || busy || recorded.current) return;
    recorded.current = true;

    playSound("victory");
    setConfettiKey((n) => n + 1);
    clearSavedGame();

    const humanSeat = state.players.findIndex((p) => p.kind === "human");
    const seat = humanSeat >= 0 ? humanSeat : 0;
    const { unlocked, stars } = recordResult({
      game: "snakes",
      won: state.winner === seat,
      captures: 0,
      laddersClimbed: state.laddersClimbed[seat] ?? 0,
      snakesHit: state.snakesHit[seat] ?? 0,
      tokensLost: 0,
      turns: state.turnCount,
    });
    setStarsEarned(stars);
    after(900, () => {
      setShowVictory(true);
      pushToasts(unlocked);
    });
  }, [state, busy, clearSavedGame, recordResult, pushToasts, after]);

  useEffect(() => {
    if (state.phase === "gameover") return;
    saveGame("snakes", state);
  }, [state, saveGame]);

  /* ---- Keyboard --------------------------------------------------------- */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isHumanTurn || busy || dice.rolling) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT")) return;
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        dice.roll();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isHumanTurn, busy, dice]);

  const restart = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
    recorded.current = false;
    setWalk(null);
    setShowVictory(false);
    setStarsEarned(0);
    setState(createSnakesGame(state.players));
  }, [state.players]);

  /* ---- Display ---------------------------------------------------------- */

  const overrides = useMemo(() => {
    const map = new Map<number, number>();
    if (!walk) return map;
    if (walk.stage === "jumping" && walk.jump) map.set(walk.player, walk.jump.to);
    else map.set(walk.player, walk.squares[walk.step]);
    return map;
  }, [walk]);

  const jumping = useMemo(
    () =>
      walk?.stage === "jumping" && walk.jump
        ? { kind: walk.jump.kind, player: walk.player }
        : null,
    [walk],
  );

  const highlight = walk ? (overrides.get(walk.player) ?? null) : null;

  const winner = state.winner !== null ? state.players[state.winner] : null;
  const victoryStats: VictoryStat[] = winner
    ? [
        { icon: "🔁", label: t("win.turns"), value: state.turnCount },
        { icon: "🪜", label: t("win.ladders"), value: state.laddersClimbed[state.winner!] ?? 0 },
        { icon: "🐍", label: t("win.snakes"), value: state.snakesHit[state.winner!] ?? 0 },
      ]
    : [];

  return (
    <main className="screen game-screen">
      <div className="topbar">
        <IconButton label={t("app.home")} onClick={onHome}>
          🏠
        </IconButton>
        <h1 className="topbar__title">🐍 {t("home.snakes.name")}</h1>
        <span className="topbar__spacer" />
        <IconButton label={t("home.help")} onClick={onHelp}>
          ❓
        </IconButton>
        <IconButton label={t("game.restart")} onClick={restart}>
          🔄
        </IconButton>
      </div>

      <div className="game-body">
        <div className="board-wrap">
          <SnakesBoard state={state} overrides={overrides} highlight={highlight} jumping={jumping} />
        </div>

        <aside className="hud">
          <p className="hud__message" role="status" aria-live="polite" key={state.message.key}>
            {t(state.message.key, state.message.args)}
          </p>

          <Dice
            face={dice.face}
            rolling={dice.rolling}
            color={player?.color ?? "blue"}
            disabled={!isHumanTurn || busy}
            onRoll={dice.roll}
            label={t("game.roll")}
          />

          <div className="players-strip">
            {state.players.map((entry, index) => (
              <div
                key={entry.id}
                className={
                  "player-chip" +
                  (state.turn === index && state.phase !== "gameover" ? " player-chip--active" : "")
                }
                style={{ color: "var(--p-" + entry.color + ")" }}
              >
                <span
                  className="player-chip__dot"
                  style={{ background: "var(--p-" + entry.color + ")" }}
                  aria-hidden="true"
                />
                <span aria-hidden="true">{entry.avatar}</span>
                <span className="player-chip__name" style={{ color: "var(--ink)" }}>
                  {entry.name}
                  {entry.kind === "ai" && <span aria-hidden="true"> 🤖</span>}
                </span>
                <span className="player-chip__progress">
                  {state.positions[index]}/{LAST_SQUARE}
                </span>
                {state.turn === index && state.phase !== "gameover" && (
                  <span className="player-chip__marker" aria-hidden="true">
                    {entry.kind === "ai" ? "🤔" : "▶"}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="row wrap center hud__actions">
            <Button variant="ghost" size="sm" onClick={restart}>
              🔄 {t("game.restart")}
            </Button>
            <Button variant="ghost" size="sm" onClick={onHome}>
              🏠 {t("app.home")}
            </Button>
          </div>
        </aside>
      </div>

      <Confetti trigger={confettiKey} active={confettiKey > 0} />

      <VictoryModal
        open={showVictory}
        winner={winner}
        title={"🏆 " + t("win.titleSnakes")}
        stats={victoryStats}
        starsEarned={starsEarned}
        onPlayAgain={restart}
        onChangeGame={onChangeGame}
        onHome={onHome}
      />
    </main>
  );
}
