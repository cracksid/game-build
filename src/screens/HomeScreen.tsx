/**
 * The front door.
 *
 * Two enormous game cards and nothing else competing with them. Everything
 * secondary -- settings, sound, help, who is playing -- is a round icon in
 * the corners, out of the way of the only two decisions that matter.
 */

import { LADDERS, SNAKES } from "../engine/snakes/board";
import type { GameId } from "../engine/types";
import { useStore } from "../state/store";
import { Avatar, Button, IconButton } from "../components/ui";

interface HomeScreenProps {
  onPlay: (game: GameId) => void;
  onSettings: () => void;
  onHelp: () => void;
  onProfiles: () => void;
  onResume: () => void;
  onDiscardSaved: () => void;
}

/** A tiny Ludo board drawn for the card art. Decorative only. */
function LudoArt() {
  return (
    <svg viewBox="0 0 100 100" className="game-card__art" aria-hidden="true">
      <rect x="2" y="2" width="96" height="96" rx="14" fill="#fffdf8" />
      <rect x="8" y="8" width="34" height="34" rx="8" fill="var(--p-green)" />
      <rect x="58" y="8" width="34" height="34" rx="8" fill="var(--p-yellow)" />
      <rect x="8" y="58" width="34" height="34" rx="8" fill="var(--p-red)" />
      <rect x="58" y="58" width="34" height="34" rx="8" fill="var(--p-blue)" />
      <rect x="42" y="8" width="16" height="84" fill="#f6f1ff" />
      <rect x="8" y="42" width="84" height="16" fill="#f6f1ff" />
      <polygon points="42,42 58,42 50,50" fill="var(--p-yellow)" />
      <polygon points="42,58 58,58 50,50" fill="var(--p-red)" />
      <polygon points="42,42 42,58 50,50" fill="var(--p-green)" />
      <polygon points="58,42 58,58 50,50" fill="var(--p-blue)" />
      <g className="game-card__tokens">
        <circle cx="18" cy="18" r="6" fill="var(--p-green-dark)" />
        <circle cx="82" cy="18" r="6" fill="var(--p-yellow-dark)" />
        <circle cx="18" cy="82" r="6" fill="var(--p-red-dark)" />
        <circle cx="82" cy="82" r="6" fill="var(--p-blue-dark)" />
      </g>
    </svg>
  );
}

/** A tiny Snakes & Ladders board for the card art. */
function SnakesArt() {
  const cells = Array.from({ length: 25 }, (_, i) => i);
  return (
    <svg viewBox="0 0 100 100" className="game-card__art" aria-hidden="true">
      <rect x="2" y="2" width="96" height="96" rx="14" fill="#fffdf8" />
      {cells.map((i) => {
        const col = i % 5;
        const row = Math.floor(i / 5);
        const tints = ["#ddeaff", "#dbf7ea", "#fff2cf", "#ffe0e0", "#efe4fb"];
        return (
          <rect
            key={i}
            x={8 + col * 16.8}
            y={8 + row * 16.8}
            width="16"
            height="16"
            rx="4"
            fill={tints[(i + row) % tints.length]}
          />
        );
      })}
      <g stroke="var(--sun-dark)" strokeWidth="2.4" strokeLinecap="round">
        <line x1="26" y1="82" x2="58" y2="26" />
        <line x1="34" y1="86" x2="66" y2="30" />
      </g>
      <g stroke="var(--sun)" strokeWidth="2" strokeLinecap="round">
        <line x1="28" y1="74" x2="36" y2="78" />
        <line x1="36" y1="60" x2="44" y2="64" />
        <line x1="44" y1="46" x2="52" y2="50" />
        <line x1="52" y1="32" x2="60" y2="36" />
      </g>
      <path
        d="M 78 22 C 58 38, 92 52, 72 70 C 62 80, 74 84, 78 86"
        fill="none"
        stroke="#5fbf6a"
        strokeWidth="6"
        strokeLinecap="round"
        className="game-card__snake"
      />
      <circle cx="78" cy="22" r="5.5" fill="#5fbf6a" />
      <circle cx="76" cy="20.5" r="1.5" fill="#fff" />
      <circle cx="80.5" cy="20.5" r="1.5" fill="#fff" />
      <circle cx="76.2" cy="20.7" r="0.8" fill="#2b2b3d" />
      <circle cx="80.7" cy="20.7" r="0.8" fill="#2b2b3d" />
    </svg>
  );
}

export function HomeScreen({
  onPlay,
  onSettings,
  onHelp,
  onProfiles,
  onResume,
  onDiscardSaved,
}: HomeScreenProps) {
  const { settings, updateSettings, activeProfile, savedGame, t } = useStore();

  return (
    <main className="screen home">
      <div className="home__topbar">
        <button type="button" className="profile-button" onClick={onProfiles}>
          {activeProfile ? (
            <>
              <Avatar emoji={activeProfile.avatar} color={activeProfile.color} size="2.4em" />
              <span className="profile-button__text">
                <span className="profile-button__name">
                  {t("home.greeting", { name: activeProfile.name })}
                </span>
                <span className="profile-button__stars">⭐ {activeProfile.stars}</span>
              </span>
            </>
          ) : (
            <>
              <Avatar emoji="👋" size="2.4em" />
              <span className="profile-button__text">
                <span className="profile-button__name">{t("home.profile")}</span>
                <span className="profile-button__stars">{t("home.pickPlayer")}</span>
              </span>
            </>
          )}
        </button>

        <div className="row">
          <IconButton
            label={t("home.sound") + ": " + (settings.sound ? t("settings.on") : t("settings.off"))}
            state={settings.sound ? "on" : "off"}
            aria-pressed={settings.sound}
            onClick={() => updateSettings({ sound: !settings.sound })}
          >
            {settings.sound ? "🔊" : "🔇"}
          </IconButton>
          <IconButton
            label={t("home.music") + ": " + (settings.music ? t("settings.on") : t("settings.off"))}
            state={settings.music ? "on" : "off"}
            aria-pressed={settings.music}
            onClick={() => updateSettings({ music: !settings.music })}
          >
            {settings.music ? "🎵" : "🎶"}
          </IconButton>
          <IconButton label={t("home.help")} onClick={onHelp}>
            ❓
          </IconButton>
          <IconButton label={t("home.settings")} onClick={onSettings}>
            ⚙️
          </IconButton>
        </div>
      </div>

      <header className="home__header">
        <h1 className="home__title">
          <span className="home__title-emoji" aria-hidden="true">
            🎮
          </span>
          <span className="title">{t("app.title")}</span>
        </h1>
        <p className="subtitle">{t("app.subtitle")}</p>
      </header>

      {savedGame && (
        <div className="resume-bar">
          <span className="resume-bar__text">
            <span aria-hidden="true">⏸️ </span>
            {savedGame.game === "ludo" ? t("home.ludo.name") : t("home.snakes.name")}
          </span>
          <Button variant="mint" size="sm" onClick={onResume}>
            ▶ {t("home.continue")}
          </Button>
          <IconButton label={t("app.close")} onClick={onDiscardSaved}>
            ✕
          </IconButton>
        </div>
      )}

      <div className="game-cards">
        <button type="button" className="game-card game-card--ludo" onClick={() => onPlay("ludo")}>
          <LudoArt />
          <span className="game-card__body">
            <span className="game-card__name">
              <span aria-hidden="true">🎲 </span>
              {t("home.ludo.name")}
            </span>
            <span className="game-card__tagline">{t("home.ludo.tagline")}</span>
            <span className="game-card__cta">{t("home.play")} ▶</span>
          </span>
          <span className="game-card__dice" aria-hidden="true">
            🎲
          </span>
        </button>

        <button
          type="button"
          className="game-card game-card--snakes"
          onClick={() => onPlay("snakes")}
        >
          <SnakesArt />
          <span className="game-card__body">
            <span className="game-card__name">
              <span aria-hidden="true">🐍 </span>
              {t("home.snakes.name")}
            </span>
            <span className="game-card__tagline">{t("home.snakes.tagline")}</span>
            <span className="game-card__cta">{t("home.play")} ▶</span>
          </span>
          <span className="game-card__dice" aria-hidden="true">
            🪜
          </span>
        </button>
      </div>

      <p className="home__foot">
        {LADDERS.length} <span aria-hidden="true">🪜</span> · {SNAKES.length}{" "}
        <span aria-hidden="true">🐍</span> · 2–4 <span aria-hidden="true">🧒</span>
      </p>
    </main>
  );
}
