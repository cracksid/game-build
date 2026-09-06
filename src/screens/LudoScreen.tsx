/**
 * Ludo, played.
 *
 * This screen owns the clock. The engine is instantaneous -- `applyMove`
 * returns the finished position immediately -- but a child watching needs to
 * see the piece walk, see the capture, and hear it. So the screen keeps a
 * "walk" alongside the engine state and draws the moving piece where the
 * animation has got to, not where the rules already put it.
 *
 * That split is the reason the rules could be tested with no renderer at
 * all, and the reason a slow animation can never desynchronise the game.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { playSound } from "../audio/sound";
import { Confetti } from "../components/Confetti";
import { Dice } from "../components/Dice";
import { LudoBoard } from "../components/LudoBoard";
import { VictoryModal } from "../components/VictoryModal";
import type { VictoryStat } from "../components/VictoryModal";
import { Button, IconButton } from "../components/ui";
import { HOME_PROGRESS, TOKENS_PER_PLAYER } from "../engine/ludo/board";
import { chooseLudoMove } from "../engine/ludo/ai";
import { applyMove, applyRoll, createLudoGame, passTurn, tokensOf } from "../engine/ludo/rules";
import type { LudoState } from "../engine/ludo/rules";
import type { PlayerConfig } from "../engine/types";
import { useDice } from "../lib/useDice";
import { useStore } from "../state/store";

interface Walk {
  tokenId: number;
  path: number[];
  step: number;
  captured: number[];
  capturedFrom: Map<number, number>;
  reachedHome: boolean;
  /** True once the piece has arrived and only the capture flourish is left. */
  landed: boolean;
}

interface LudoScreenProps {
  players: PlayerConfig[];
  resume: boolean;
  onHome: () => void;
  onChangeGame: () => void;
  onHelp: () => void;
}

const STEP_MS = { full: 160, calm: 95, off: 0 } as const;
const AI_ROLL_DELAY = { full: 750, calm: 480, off: 120 } as const;
const AI_MOVE_DELAY = { full: 620, calm: 400, off: 100 } as const;
const AUTO_PASS_DELAY = { full: 1000, calm: 650, off: 150 } as const;

export function LudoScreen({ players, resume, onHome, onChangeGame, onHelp }: LudoScreenProps) {
  const { settings, savedGame, saveGame, clearSavedGame, recordResult, recordFirstRoll, pushToasts, t } =
    useStore();
  const anim = settings.animation;

  const [state, setState] = useState<LudoState>(() => {
    if (resume && savedGame?.game === "ludo") return savedGame.state as LudoState;
    return createLudoGame(players);
  });
  const [walk, setWalk] = useState<Walk | null>(null);
  const [confettiKey, setConfettiKey] = useState(0);
  const [showVictory, setShowVictory] = useState(false);
  const [starsEarned, setStarsEarned] = useState(0);

  const tokensLost = useRef(0);
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

  const player = state.players[state.turn];
  const isHumanTurn = player?.kind === "human" && state.phase !== "gameover";
  const busy = walk !== null;

  /* ---- Rolling ------------------------------------------------------- */

  const onRollResult = useCallback(
    (value: number) => {
      if (!firstRollDone.current) {
        firstRollDone.current = true;
        pushToasts(recordFirstRoll());
      }
      setState((current) => applyRoll(current, value));
    },
    [pushToasts, recordFirstRoll],
  );

  const dice = useDice(onRollResult, anim);

  /* ---- Making a move ------------------------------------------------- */

  const playMove = useCallback(
    (tokenId: number) => {
      setState((current) => {
        const move = current.moves.find((m) => m.tokenId === tokenId);
        if (!move) {
          playSound("error");
          return current;
        }

        const result = applyMove(current, tokenId);
        const capturedFrom = new Map<number, number>();
        for (const id of result.captured) {
          const victim = current.tokens.find((token) => token.id === id);
          if (victim) capturedFrom.set(id, victim.progress);
          if (victim && victim.owner === 0) tokensLost.current += 1;
        }

        if (anim === "off") {
          if (result.captured.length) playSound("capture");
          else if (result.reachedHome) playSound("home");
          else playSound("step");
        } else {
          setWalk({
            tokenId,
            path: result.path,
            step: 0,
            captured: result.captured,
            capturedFrom,
            reachedHome: result.reachedHome,
            landed: false,
          });
          playSound("step");
        }

        return result.state;
      });
    },
    [anim],
  );

  /* ---- The walking animation ------------------------------------------
   * One timer per square. The engine state is already final, so if this is
   * interrupted the game is still correct -- only the picture catches up.
   */
  useEffect(() => {
    if (!walk || walk.landed) return;
    const stepMs = STEP_MS[anim];

    if (walk.step < walk.path.length - 1) {
      const id = window.setTimeout(() => {
        playSound("step");
        setWalk((current) =>
          current && !current.landed ? { ...current, step: current.step + 1 } : current,
        );
      }, stepMs);
      return () => window.clearTimeout(id);
    }

    // Arrived on the final square.
    const id = window.setTimeout(() => {
      if (walk.captured.length) playSound("capture");
      else if (walk.reachedHome) playSound("home");
      setWalk((current) => (current ? { ...current, landed: true } : current));
    }, stepMs);
    return () => window.clearTimeout(id);
  }, [walk, anim]);

  // Once landed, hold the capture/arrival flourish briefly, then hand back.
  useEffect(() => {
    if (!walk?.landed) return;
    const hold = walk.captured.length || walk.reachedHome ? 620 : 120;
    const id = window.setTimeout(() => setWalk(null), anim === "off" ? 0 : hold);
    return () => window.clearTimeout(id);
  }, [walk, anim]);

  /* ---- Turn driving ---------------------------------------------------
   * One effect decides what happens next whenever the game is idle: pass a
   * dead turn, take the only move, or let the computer play.
   */
  useEffect(() => {
    if (busy || state.phase === "gameover") return;

    // Nothing this player can do -- say so, then move on.
    if (state.phase === "choose" && state.moves.length === 0) {
      const id = after(AUTO_PASS_DELAY[anim], () => setState((c) => passTurn(c)));
      return () => window.clearTimeout(id);
    }

    // Exactly one legal move: making the child hunt for the only tappable
    // token is busywork, so it plays itself after a beat.
    if (state.phase === "choose" && state.moves.length === 1) {
      const id = after(AI_MOVE_DELAY[anim], () => playMove(state.moves[0].tokenId));
      return () => window.clearTimeout(id);
    }

    const current = state.players[state.turn];
    if (current.kind !== "ai") return;

    if (state.phase === "roll" && !dice.rolling) {
      const id = after(AI_ROLL_DELAY[anim], () => dice.roll());
      return () => window.clearTimeout(id);
    }

    if (state.phase === "choose" && state.moves.length > 1) {
      const id = after(AI_MOVE_DELAY[anim], () => {
        const choice = chooseLudoMove(state, current.difficulty);
        if (choice) playMove(choice.tokenId);
      });
      return () => window.clearTimeout(id);
    }
  }, [state, busy, anim, dice, playMove, after]);

  /* ---- Victory -------------------------------------------------------- */

  useEffect(() => {
    if (state.phase !== "gameover" || busy || recorded.current) return;
    recorded.current = true;

    playSound("victory");
    setConfettiKey((n) => n + 1);
    clearSavedGame();

    const humanSeat = state.players.findIndex((p) => p.kind === "human");
    const seat = humanSeat >= 0 ? humanSeat : 0;
    const { unlocked, stars } = recordResult({
      game: "ludo",
      won: state.winner === seat,
      captures: state.captures[seat] ?? 0,
      laddersClimbed: 0,
      snakesHit: 0,
      tokensLost: tokensLost.current,
      turns: state.turnCount,
    });
    setStarsEarned(stars);
    after(900, () => {
      setShowVictory(true);
      pushToasts(unlocked);
    });
  }, [state, busy, clearSavedGame, recordResult, pushToasts, after]);

  /* ---- Saving --------------------------------------------------------- */

  useEffect(() => {
    if (state.phase === "gameover") return;
    saveGame("ludo", state);
  }, [state, saveGame]);

  /* ---- Keyboard ------------------------------------------------------- */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (state.phase === "gameover" || busy) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT")) return;

      if ((event.key === " " || event.key === "Enter") && isHumanTurn && state.phase === "roll") {
        event.preventDefault();
        dice.roll();
        return;
      }
      // 1-4 pick the nth movable token, so the whole game is playable
      // without a mouse.
      if (isHumanTurn && state.phase === "choose" && /^[1-4]$/.test(event.key)) {
        const move = state.moves[Number(event.key) - 1];
        if (move) {
          event.preventDefault();
          playMove(move.tokenId);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, busy, isHumanTurn, dice, playMove]);

  /* ---- Restart -------------------------------------------------------- */

  const restart = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
    tokensLost.current = 0;
    recorded.current = false;
    setWalk(null);
    setShowVictory(false);
    setStarsEarned(0);
    setState(createLudoGame(state.players));
  }, [state.players]);

  /* ---- Display --------------------------------------------------------- */

  const overrides = useMemo(() => {
    const map = new Map<number, number>();
    if (!walk) return map;
    if (!walk.landed) map.set(walk.tokenId, walk.path[walk.step]);
    if (!walk.landed) {
      for (const [id, progress] of walk.capturedFrom) map.set(id, progress);
    }
    return map;
  }, [walk]);

  const selectable = useMemo(() => {
    if (busy || !isHumanTurn || state.phase !== "choose" || state.moves.length < 2) {
      return new Set<number>();
    }
    return new Set(state.moves.map((m) => m.tokenId));
  }, [busy, isHumanTurn, state]);

  const targets = useMemo(() => {
    const map = new Map<number, number>();
    if (selectable.size === 0) return map;
    for (const move of state.moves) map.set(move.tokenId, move.to);
    return map;
  }, [selectable, state.moves]);

  const capturing = useMemo(
    () => new Set(walk?.landed ? walk.captured : []),
    [walk],
  );

  const homeCount = (index: number) =>
    tokensOf(state, index).filter((token) => token.progress === HOME_PROGRESS).length;

  const labelFor = useCallback(
    (tokenId: number) => {
      const token = state.tokens.find((tk) => tk.id === tokenId);
      if (!token) return "";
      const owner = state.players[token.owner];
      const move = state.moves.find((m) => m.tokenId === tokenId);
      const where =
        token.progress < 0
          ? t("game.base")
          : token.progress === HOME_PROGRESS
            ? t("game.home")
            : t("game.square", { n: token.progress + 1 });
      const action = move
        ? move.captures.length
          ? " — " + t("msg.captured")
          : move.kind === "finish"
            ? " — " + t("game.home")
            : ""
        : "";
      return owner.name + " " + owner.avatar + ", " + where + action;
    },
    [state, t],
  );

  const winner = state.winner !== null ? state.players[state.winner] : null;
  const victoryStats: VictoryStat[] = winner
    ? [
        { icon: "🔁", label: t("win.turns"), value: state.turnCount },
        { icon: "💥", label: t("win.captures"), value: state.captures[state.winner!] ?? 0 },
        { icon: "6️⃣", label: t("win.sixes"), value: state.sixes[state.winner!] ?? 0 },
      ]
    : [];

  return (
    <main className="screen game-screen">
      <div className="topbar">
        <IconButton label={t("app.home")} onClick={onHome}>
          🏠
        </IconButton>
        <h1 className="topbar__title">🎲 {t("home.ludo.name")}</h1>
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
          <LudoBoard
            state={state}
            overrides={overrides}
            selectable={selectable}
            capturing={capturing}
            targets={targets}
            onTokenClick={playMove}
            activeSeat={state.phase === "gameover" ? null : state.seats[state.turn]}
            labelFor={labelFor}
          />
        </div>

        <aside className="hud">
          <p className="hud__message" role="status" aria-live="polite" key={state.message.key}>
            {t(state.message.key, state.message.args)}
          </p>

          <Dice
            face={dice.face}
            rolling={dice.rolling}
            color={player?.color ?? "red"}
            disabled={!isHumanTurn || state.phase !== "roll" || busy}
            onRoll={dice.roll}
            label={t("game.roll")}
          />

          <div className="players-strip">
            {state.players.map((entry, index) => (
              <div
                key={entry.id}
                className={
                  "player-chip" + (state.turn === index && state.phase !== "gameover" ? " player-chip--active" : "")
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
                  {homeCount(index)}/{TOKENS_PER_PLAYER}
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
        title={"🎉 " + t("win.title")}
        stats={victoryStats}
        starsEarned={starsEarned}
        onPlayAgain={restart}
        onChangeGame={onChangeGame}
        onHome={onHome}
      />
    </main>
  );
}
