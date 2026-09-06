/**
 * Choosing who plays.
 *
 * Every choice is visible at once and made by tapping a picture -- no
 * dropdowns, no popovers, nothing that hides an option behind another tap.
 * A child who cannot read yet can still set up a game from the avatars and
 * the colour dots alone.
 *
 * It also opens with a sensible game already configured, so "Start" works
 * immediately without touching anything.
 */

import { useMemo, useState } from "react";

import { playSound } from "../audio/sound";
import { seatsForPlayerCount } from "../engine/ludo/board";
import type { ColorId, Difficulty, GameId, PlayerConfig, PlayerKind } from "../engine/types";
import { AI_CHARACTERS, COLORS } from "../lib/theme";
import { useStore } from "../state/store";
import { AVATARS } from "../state/storage";
import { Button, IconButton, Segmented } from "../components/ui";

interface SetupScreenProps {
  game: GameId;
  onBack: () => void;
  onStart: (players: PlayerConfig[]) => void;
  onHelp: () => void;
}

interface Draft {
  name: string;
  avatar: string;
  color: ColorId;
  kind: PlayerKind;
}

export function SetupScreen({ game, onBack, onStart, onHelp }: SetupScreenProps) {
  const { activeProfile, settings, updateSettings, t } = useStore();

  const [count, setCount] = useState(2);
  const [drafts, setDrafts] = useState<Draft[]>(() => {
    // Player one is whoever is signed in; the rest start as computer
    // opponents, which is the setup a single child playing alone wants.
    const first: Draft = {
      name: activeProfile?.name ?? "You",
      avatar: activeProfile?.avatar ?? AVATARS[0],
      color: activeProfile?.color ?? "red",
      kind: "human",
    };
    const rest = COLORS.filter((c) => c !== first.color).map((color, i) => ({
      name: AI_CHARACTERS[i % AI_CHARACTERS.length].name,
      avatar: AI_CHARACTERS[i % AI_CHARACTERS.length].avatar,
      color,
      kind: "ai" as PlayerKind,
    }));
    return [first, ...rest];
  });

  const active = drafts.slice(0, count);

  const update = (index: number, patch: Partial<Draft>) => {
    setDrafts((current) =>
      current.map((draft, i) => {
        if (i !== index) return draft;
        // Colours must stay unique: swap with whoever already holds the
        // wanted colour rather than refusing the tap.
        return { ...draft, ...patch };
      }),
    );
  };

  const chooseColor = (index: number, color: ColorId) => {
    playSound("select");
    setDrafts((current) => {
      const holder = current.findIndex((d, i) => i !== index && d.color === color);
      const next = current.map((d) => ({ ...d }));
      if (holder >= 0) next[holder].color = next[index].color;
      next[index].color = color;
      return next;
    });
  };

  const players: PlayerConfig[] = useMemo(
    () =>
      active.map((draft, index) => ({
        id: index,
        name: draft.name.trim() || t("setup.playerN", { n: index + 1 }),
        color: draft.color,
        avatar: draft.avatar,
        kind: draft.kind,
        difficulty: settings.difficulty,
      })),
    [active, settings.difficulty, t],
  );

  const seats = seatsForPlayerCount(count);
  const humanCount = active.filter((d) => d.kind === "human").length;

  return (
    <main className="screen setup">
      <div className="topbar">
        <IconButton label={t("app.back")} onClick={onBack}>
          ⬅️
        </IconButton>
        <h1 className="topbar__title">
          {game === "ludo" ? "🎲 " + t("home.ludo.name") : "🐍 " + t("home.snakes.name")}
        </h1>
        <span className="topbar__spacer" />
        <IconButton label={t("home.help")} onClick={onHelp}>
          ❓
        </IconButton>
      </div>

      <div className="setup__scroll">
        <h2 className="section-title center-text">{t("setup.title")}</h2>

        <div className="setup__count">
          <Segmented
            label={t("setup.title")}
            value={String(count)}
            onChange={(value) => setCount(Number(value))}
            options={[2, 3, 4].map((n) => ({
              value: String(n),
              label: t("setup.players", { count: n }),
            }))}
          />
        </div>

        <div className="setup__players">
          {active.map((draft, index) => (
            <section
              className="player-card"
              key={index}
              style={{ borderColor: "var(--p-" + draft.color + ")" }}
            >
              <header className="player-card__head">
                <span
                  className="player-card__badge"
                  style={{ background: "var(--p-" + draft.color + ")" }}
                  aria-hidden="true"
                >
                  {draft.avatar}
                </span>
                <label className="player-card__name">
                  <span className="sr-only">
                    {t("setup.name")} {index + 1}
                  </span>
                  <input
                    value={draft.name}
                    maxLength={12}
                    placeholder={t("setup.playerN", { n: index + 1 })}
                    onChange={(event) => update(index, { name: event.target.value })}
                  />
                </label>
                {game === "ludo" && (
                  <span className="pill" title={t("game.base")}>
                    {["🔻", "🔺", "🔶", "🔷"][seats[index]]}
                  </span>
                )}
              </header>

              <div className="player-card__row">
                <Segmented
                  label={t("setup.playerN", { n: index + 1 })}
                  value={draft.kind}
                  onChange={(kind) => update(index, { kind: kind as PlayerKind })}
                  options={[
                    { value: "human", label: "🧒 " + t("setup.human") },
                    { value: "ai", label: "🤖 " + t("setup.ai") },
                  ]}
                />
              </div>

              <div className="player-card__row">
                <span className="player-card__label">{t("setup.color")}</span>
                <div className="swatches" role="group" aria-label={t("setup.color")}>
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={"swatch" + (draft.color === color ? " swatch--on" : "")}
                      style={{ background: "var(--p-" + color + ")" }}
                      aria-label={color}
                      aria-pressed={draft.color === color}
                      onClick={() => chooseColor(index, color)}
                    >
                      {draft.color === color && <span aria-hidden="true">✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="player-card__row">
                <span className="player-card__label">{t("setup.avatar")}</span>
                <div className="avatar-strip" role="group" aria-label={t("setup.avatar")}>
                  {AVATARS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className={"avatar-pick" + (draft.avatar === emoji ? " avatar-pick--on" : "")}
                      aria-label={emoji}
                      aria-pressed={draft.avatar === emoji}
                      onClick={() => {
                        playSound("pop");
                        update(index, { avatar: emoji });
                      }}
                    >
                      <span aria-hidden="true">{emoji}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>

        {active.some((d) => d.kind === "ai") && (
          <div className="card setup__difficulty">
            <span className="player-card__label">🤖 {t("setup.difficulty")}</span>
            <Segmented
              label={t("setup.difficulty")}
              value={settings.difficulty}
              onChange={(difficulty) => updateSettings({ difficulty: difficulty as Difficulty })}
              options={[
                { value: "easy", label: "🙂 " + t("diff.easy") },
                { value: "medium", label: "😃 " + t("diff.medium") },
                { value: "hard", label: "😎 " + t("diff.hard") },
              ]}
            />
          </div>
        )}
      </div>

      <footer className="setup__foot">
        {humanCount === 0 && <p className="setup__hint">{t("setup.needTwo")}</p>}
        <Button
          variant="mint"
          size="lg"
          sound="select"
          onClick={() => onStart(players)}
          disabled={humanCount === 0}
        >
          {t("setup.start")} <span aria-hidden="true">🚀</span>
        </Button>
      </footer>
    </main>
  );
}
