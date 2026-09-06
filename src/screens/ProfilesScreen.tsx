/**
 * Players.
 *
 * A profile is a name, a face and a pile of stars kept in this browser. No
 * sign-in, no email, nothing that leaves the device -- which is the only
 * defensible shape for a children's app.
 */

import { useState } from "react";

import { playSound } from "../audio/sound";
import type { ColorId } from "../engine/types";
import { COLORS } from "../lib/theme";
import { ACHIEVEMENTS } from "../state/achievements";
import { AVATARS } from "../state/storage";
import { useStore } from "../state/store";
import { Avatar, Button, IconButton, Modal } from "../components/ui";

export function ProfilesScreen({ onBack }: { onBack: () => void }) {
  const { profiles, activeProfile, addProfile, removeProfile, selectProfile, t } = useStore();

  const [creating, setCreating] = useState(profiles.length === 0);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [color, setColor] = useState<ColorId>("red");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const create = () => {
    addProfile(name, avatar, color);
    setName("");
    setCreating(false);
    playSound("sparkle");
  };

  return (
    <main className="screen sheet">
      <div className="topbar">
        <IconButton label={t("app.back")} onClick={onBack}>
          ⬅️
        </IconButton>
        <h1 className="topbar__title">🧒 {t("profile.title")}</h1>
        <span className="topbar__spacer" />
        {!creating && (
          <IconButton label={t("profile.new")} onClick={() => setCreating(true)}>
            ➕
          </IconButton>
        )}
      </div>

      <div className="sheet__scroll">
        {creating && (
          <section className="card col">
            <h2 className="setting-label">✨ {t("profile.new")}</h2>

            <label className="field">
              <span className="field__label">{t("setup.name")}</span>
              <input
                value={name}
                maxLength={12}
                placeholder={t("profile.namePlaceholder")}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
            </label>

            <span className="player-card__label">{t("setup.avatar")}</span>
            <div className="avatar-strip avatar-strip--wrap" role="group" aria-label={t("setup.avatar")}>
              {AVATARS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={"avatar-pick" + (avatar === emoji ? " avatar-pick--on" : "")}
                  aria-label={emoji}
                  aria-pressed={avatar === emoji}
                  onClick={() => {
                    playSound("pop");
                    setAvatar(emoji);
                  }}
                >
                  <span aria-hidden="true">{emoji}</span>
                </button>
              ))}
            </div>

            <span className="player-card__label">{t("setup.color")}</span>
            <div className="swatches" role="group" aria-label={t("setup.color")}>
              {COLORS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={"swatch" + (color === option ? " swatch--on" : "")}
                  style={{ background: "var(--p-" + option + ")" }}
                  aria-label={option}
                  aria-pressed={color === option}
                  onClick={() => {
                    playSound("select");
                    setColor(option);
                  }}
                >
                  {color === option && <span aria-hidden="true">✓</span>}
                </button>
              ))}
            </div>

            <div className="row wrap">
              <Button variant="mint" onClick={create}>
                ✅ {t("profile.create")}
              </Button>
              {profiles.length > 0 && (
                <Button variant="ghost" onClick={() => setCreating(false)}>
                  {t("settings.cancel")}
                </Button>
              )}
            </div>
          </section>
        )}

        {profiles.map((profile) => {
          const isActive = profile.id === activeProfile?.id;
          return (
            <section
              className={"card profile-card" + (isActive ? " profile-card--active" : "")}
              key={profile.id}
            >
              <header className="profile-card__head">
                <Avatar emoji={profile.avatar} color={profile.color} size="3.2em" />
                <div className="grow">
                  <h2 className="profile-card__name">{profile.name}</h2>
                  <div className="row wrap">
                    <span className="pill pill--star">⭐ {profile.stars}</span>
                    <span className="pill">🏆 {profile.wins}</span>
                    <span className="pill">🎮 {profile.gamesPlayed}</span>
                    <span className="pill">🔥 {profile.bestStreak}</span>
                  </div>
                </div>
                {isActive ? (
                  <span className="pill" style={{ background: "var(--mint)", color: "#fff" }}>
                    ✓
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="mint"
                    onClick={() => {
                      playSound("select");
                      selectProfile(profile.id);
                    }}
                  >
                    {t("profile.select")}
                  </Button>
                )}
              </header>

              <h3 className="profile-card__sub">
                {t("profile.achievements")} · {profile.achievements.length}/{ACHIEVEMENTS.length}
              </h3>
              <div className="badges">
                {ACHIEVEMENTS.map((achievement) => {
                  const earned = profile.achievements.includes(achievement.id);
                  return (
                    <div
                      className={"badge" + (earned ? " badge--on" : "")}
                      key={achievement.id}
                      title={t(achievement.descKey)}
                    >
                      <span className="badge__icon" aria-hidden="true">
                        {earned ? achievement.icon : "🔒"}
                      </span>
                      <span className="badge__name">
                        {earned ? t(achievement.nameKey) : t("profile.locked")}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="row">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(profile.id)}
                >
                  🗑️ {t("profile.delete")}
                </Button>
              </div>
            </section>
          );
        })}
      </div>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        labelledBy="delete-title"
      >
        <h2 className="section-title" id="delete-title">
          🗑️ {t("profile.delete")}
        </h2>
        <p className="modal__text">{t("settings.resetConfirm")}</p>
        <div className="victory__actions">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
            {t("settings.cancel")}
          </Button>
          <Button
            variant="coral"
            onClick={() => {
              if (confirmDelete) removeProfile(confirmDelete);
              setConfirmDelete(null);
            }}
          >
            {t("settings.resetYes")}
          </Button>
        </div>
      </Modal>
    </main>
  );
}
