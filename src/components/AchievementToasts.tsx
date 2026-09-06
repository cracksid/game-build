/**
 * The little banner that slides up when a trophy is earned.
 *
 * It removes itself on a timer rather than needing a dismiss button: a
 * child should not have to tidy up a reward.
 */

import { useEffect } from "react";

import { playSound } from "../audio/sound";
import { useStore } from "../state/store";

export function AchievementToasts() {
  const { toasts, dismissToast, t } = useStore();

  useEffect(() => {
    if (toasts.length === 0) return;
    playSound("sparkle");
    const timers = toasts.map((achievement) =>
      window.setTimeout(() => dismissToast(achievement.id), 4200),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [toasts, dismissToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((achievement) => (
        <div className="toast" key={achievement.id}>
          <span className="toast__icon" aria-hidden="true">
            {achievement.icon}
          </span>
          <span>
            <span className="toast__label">{t("win.newAchievement")}</span>
            <br />
            {t(achievement.nameKey)}
          </span>
        </div>
      ))}
    </div>
  );
}
