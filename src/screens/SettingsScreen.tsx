/**
 * Settings.
 *
 * Big rows, one control each, and the destructive one is at the bottom
 * behind a confirmation -- a child tapping around should not be able to
 * erase a sibling's trophies in one press.
 */

import { useState } from "react";

import type { Difficulty } from "../engine/types";
import { LANGUAGES } from "../lib/i18n";
import type { Lang } from "../lib/i18n";
import { useStore } from "../state/store";
import type { AnimationLevel } from "../state/types";
import { Button, IconButton, Modal, Segmented, Switch } from "../components/ui";

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { settings, updateSettings, resetProgress, t } = useStore();
  const [confirmReset, setConfirmReset] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  return (
    <main className="screen sheet">
      <div className="topbar">
        <IconButton label={t("app.back")} onClick={onBack}>
          ⬅️
        </IconButton>
        <h1 className="topbar__title">⚙️ {t("settings.title")}</h1>
      </div>

      <div className="sheet__scroll">
        <section className="card col">
          <Switch
            label={t("settings.sound")}
            icon="🔊"
            checked={settings.sound}
            onChange={(sound) => updateSettings({ sound })}
          />
          <Switch
            label={t("settings.music")}
            icon="🎵"
            checked={settings.music}
            onChange={(music) => updateSettings({ music })}
          />
        </section>

        <section className="card col">
          <h2 className="setting-label">✨ {t("settings.animation")}</h2>
          <Segmented
            label={t("settings.animation")}
            value={settings.animation}
            onChange={(animation) => updateSettings({ animation: animation as AnimationLevel })}
            options={[
              { value: "full", label: t("settings.anim.full") },
              { value: "calm", label: t("settings.anim.calm") },
              { value: "off", label: t("settings.anim.off") },
            ]}
          />
        </section>

        <section className="card col">
          <h2 className="setting-label">🤖 {t("settings.difficulty")}</h2>
          <Segmented
            label={t("settings.difficulty")}
            value={settings.difficulty}
            onChange={(difficulty) => updateSettings({ difficulty: difficulty as Difficulty })}
            options={[
              { value: "easy", label: "🙂 " + t("diff.easy") },
              { value: "medium", label: "😃 " + t("diff.medium") },
              { value: "hard", label: "😎 " + t("diff.hard") },
            ]}
          />
        </section>

        <section className="card col">
          <h2 className="setting-label">🌍 {t("settings.language")}</h2>
          <Segmented
            label={t("settings.language")}
            value={settings.language}
            onChange={(language) => updateSettings({ language: language as Lang })}
            options={LANGUAGES.map((lang) => ({
              value: lang.id,
              label: lang.flag + " " + lang.label,
            }))}
          />
        </section>

        <section className="card col">
          <Button variant="ghost" onClick={() => setShowAbout(true)}>
            ℹ️ {t("settings.about")}
          </Button>
          <Button variant="coral" onClick={() => setConfirmReset(true)}>
            🗑️ {t("settings.reset")}
          </Button>
        </section>
      </div>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} labelledBy="reset-title">
        <h2 className="section-title" id="reset-title">
          ⚠️ {t("settings.reset")}
        </h2>
        <p className="modal__text">{t("settings.resetConfirm")}</p>
        <div className="victory__actions">
          <Button variant="ghost" onClick={() => setConfirmReset(false)}>
            {t("settings.cancel")}
          </Button>
          <Button
            variant="coral"
            onClick={() => {
              resetProgress();
              setConfirmReset(false);
            }}
          >
            {t("settings.resetYes")}
          </Button>
        </div>
      </Modal>

      <Modal open={showAbout} onClose={() => setShowAbout(false)} labelledBy="about-title">
        <h2 className="section-title" id="about-title">
          🎮 {t("app.title")}
        </h2>
        <p className="modal__text">{t("settings.aboutText")}</p>
        <div className="victory__actions">
          <Button onClick={() => setShowAbout(false)}>{t("help.gotIt")}</Button>
        </div>
      </Modal>
    </main>
  );
}
