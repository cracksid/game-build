/**
 * How to play.
 *
 * Every step is a small ANIMATED scene rather than a paragraph. A child who
 * cannot read the caption can still watch the token hop out of its corner,
 * bump another piece and send it home -- which is the whole rule.
 *
 * The scenes are CSS animations over a few divs; nothing here is a video or
 * an image file.
 */

import { useState } from "react";
import type { ReactElement } from "react";

import type { GameId } from "../engine/types";
import { useStore } from "../state/store";
import { Button, IconButton, Segmented } from "../components/ui";

/* ---- Tiny animated scenes -------------------------------------------- */

function SceneRoll() {
  return (
    <div className="scene">
      <div className="scene__dice" aria-hidden="true">
        <span>🎲</span>
      </div>
      <div className="scene__tap" aria-hidden="true" />
    </div>
  );
}

function SceneExit() {
  return (
    <div className="scene" aria-hidden="true">
      <div className="scene__yard" />
      <div className="scene__track">
        {[0, 1, 2, 3].map((i) => (
          <span className="scene__cell" key={i} />
        ))}
      </div>
      <div className="scene__six">6</div>
      <div className="scene__token scene__token--exit" style={{ background: "var(--p-red)" }}>
        🦊
      </div>
    </div>
  );
}

function ScenePick() {
  return (
    <div className="scene" aria-hidden="true">
      <div className="scene__track">
        {[0, 1, 2, 3].map((i) => (
          <span className="scene__cell" key={i} />
        ))}
      </div>
      <div
        className="scene__token scene__token--glow"
        style={{ left: "18%", background: "var(--p-green)" }}
      >
        🐼
      </div>
      <div
        className="scene__token scene__token--glow"
        style={{ left: "58%", background: "var(--p-green)", animationDelay: "0.25s" }}
      >
        🐼
      </div>
      <div className="scene__finger">👆</div>
    </div>
  );
}

function SceneCapture() {
  return (
    <div className="scene" aria-hidden="true">
      <div className="scene__track">
        {[0, 1, 2, 3].map((i) => (
          <span className="scene__cell" key={i} />
        ))}
      </div>
      <div className="scene__token scene__token--chase" style={{ background: "var(--p-blue)" }}>
        🐯
      </div>
      <div
        className="scene__token scene__token--flee"
        style={{ left: "62%", background: "var(--p-yellow)" }}
      >
        🐰
      </div>
      <span className="scene__star">⭐</span>
    </div>
  );
}

function SceneHome() {
  return (
    <div className="scene" aria-hidden="true">
      <div className="scene__track scene__track--home">
        {[0, 1, 2, 3].map((i) => (
          <span className="scene__cell" key={i} style={{ background: "var(--p-red-wash)" }} />
        ))}
      </div>
      <div className="scene__house">🏠</div>
      <div className="scene__token scene__token--arrive" style={{ background: "var(--p-red)" }}>
        🦊
      </div>
    </div>
  );
}

function SceneWalk() {
  return (
    <div className="scene" aria-hidden="true">
      <div className="scene__track">
        {[1, 2, 3, 4].map((i) => (
          <span className="scene__cell" key={i}>
            {i}
          </span>
        ))}
      </div>
      <div className="scene__token scene__token--walk" style={{ background: "var(--p-blue)" }}>
        🐧
      </div>
    </div>
  );
}

function SceneLadder() {
  return (
    <div className="scene" aria-hidden="true">
      <svg viewBox="0 0 100 100" className="scene__svg">
        <line x1="30" y1="88" x2="66" y2="14" stroke="var(--sun-dark)" strokeWidth="3" strokeLinecap="round" />
        <line x1="42" y1="92" x2="78" y2="18" stroke="var(--sun-dark)" strokeWidth="3" strokeLinecap="round" />
        {[0, 1, 2, 3, 4].map((i) => {
          const t = (i + 0.5) / 5;
          return (
            <line
              key={i}
              x1={30 + 36 * t}
              y1={88 - 74 * t}
              x2={42 + 36 * t}
              y2={92 - 74 * t}
              stroke="var(--sun)"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <div className="scene__token scene__token--climb" style={{ background: "var(--p-green)" }}>
        🐸
      </div>
    </div>
  );
}

function SceneSnake() {
  return (
    <div className="scene" aria-hidden="true">
      <svg viewBox="0 0 100 100" className="scene__svg">
        <path
          d="M 70 16 C 40 34, 88 54, 56 74 C 44 82, 34 84, 28 86"
          fill="none"
          stroke="#5fbf6a"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <circle cx="70" cy="16" r="8" fill="#5fbf6a" />
        <circle cx="67" cy="14" r="2.2" fill="#fff" />
        <circle cx="73" cy="14" r="2.2" fill="#fff" />
        <circle cx="67.4" cy="14.4" r="1.1" fill="#2b2b3d" />
        <circle cx="73.4" cy="14.4" r="1.1" fill="#2b2b3d" />
        <path d="M 66 19 Q 70 22 74 19" stroke="#2b2b3d" strokeWidth="1" fill="none" strokeLinecap="round" />
      </svg>
      <div className="scene__token scene__token--slide" style={{ background: "var(--p-pink, #ff8fb1)" }}>
        🐨
      </div>
    </div>
  );
}

function SceneFinish() {
  return (
    <div className="scene" aria-hidden="true">
      <div className="scene__finish">100</div>
      <div className="scene__token scene__token--win" style={{ background: "var(--p-yellow)" }}>
        🦄
      </div>
      <span className="scene__pop scene__pop--a">🎉</span>
      <span className="scene__pop scene__pop--b">✨</span>
      <span className="scene__pop scene__pop--c">🎊</span>
    </div>
  );
}

interface Step {
  scene: () => ReactElement;
  titleKey: string;
  bodyKey: string;
}

const LUDO_STEPS: Step[] = [
  { scene: SceneRoll, titleKey: "help.ludo.1.title", bodyKey: "help.ludo.1.body" },
  { scene: SceneExit, titleKey: "help.ludo.2.title", bodyKey: "help.ludo.2.body" },
  { scene: ScenePick, titleKey: "help.ludo.3.title", bodyKey: "help.ludo.3.body" },
  { scene: SceneCapture, titleKey: "help.ludo.4.title", bodyKey: "help.ludo.4.body" },
  { scene: SceneHome, titleKey: "help.ludo.5.title", bodyKey: "help.ludo.5.body" },
];

const SNAKES_STEPS: Step[] = [
  { scene: SceneWalk, titleKey: "help.snakes.1.title", bodyKey: "help.snakes.1.body" },
  { scene: SceneLadder, titleKey: "help.snakes.2.title", bodyKey: "help.snakes.2.body" },
  { scene: SceneSnake, titleKey: "help.snakes.3.title", bodyKey: "help.snakes.3.body" },
  { scene: SceneFinish, titleKey: "help.snakes.4.title", bodyKey: "help.snakes.4.body" },
];

export function HelpScreen({ onBack, initial }: { onBack: () => void; initial?: GameId }) {
  const { t } = useStore();
  const [tab, setTab] = useState<GameId>(initial ?? "ludo");
  const steps = tab === "ludo" ? LUDO_STEPS : SNAKES_STEPS;

  return (
    <main className="screen sheet">
      <div className="topbar">
        <IconButton label={t("app.back")} onClick={onBack}>
          ⬅️
        </IconButton>
        <h1 className="topbar__title">❓ {t("help.title")}</h1>
      </div>

      <div className="sheet__tabs">
        <Segmented
          label={t("help.title")}
          value={tab}
          onChange={(value) => setTab(value as GameId)}
          options={[
            { value: "ludo", label: "🎲 " + t("help.ludoTab") },
            { value: "snakes", label: "🐍 " + t("help.snakesTab") },
          ]}
        />
      </div>

      <div className="sheet__scroll">
        <ol className="help-steps">
          {steps.map((step, index) => {
            const Scene = step.scene;
            return (
              <li className="help-step card" key={step.titleKey}>
                <span className="help-step__num" aria-hidden="true">
                  {index + 1}
                </span>
                <Scene />
                <div className="help-step__text">
                  <h2 className="help-step__title">{t(step.titleKey)}</h2>
                  <p className="help-step__body">{t(step.bodyKey)}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="row center" style={{ padding: "8px 0 20px" }}>
          <Button variant="mint" size="lg" onClick={onBack}>
            {t("help.gotIt")} 👍
          </Button>
        </div>
      </div>
    </main>
  );
}
