/**
 * The celebration.
 *
 * Shown once a game is over. Confetti and the fanfare are fired by the
 * screen that owns the game, not here, so the party starts the instant the
 * winning move lands rather than after this dialog animates in.
 */

import type { PlayerConfig } from "../engine/types";
import { useStore } from "../state/store";
import { Avatar, Button, Modal } from "./ui";

export interface VictoryStat {
  label: string;
  value: string | number;
  icon: string;
}

interface VictoryModalProps {
  open: boolean;
  winner: PlayerConfig | null;
  title: string;
  stats: VictoryStat[];
  starsEarned: number;
  onPlayAgain: () => void;
  onChangeGame: () => void;
  onHome: () => void;
}

export function VictoryModal({
  open,
  winner,
  title,
  stats,
  starsEarned,
  onPlayAgain,
  onChangeGame,
  onHome,
}: VictoryModalProps) {
  const { t } = useStore();
  if (!winner) return null;

  return (
    <Modal open={open} onClose={onHome} labelledBy="victory-title" dismissable={false}>
      <div className="victory">
        <div className="victory__crown" aria-hidden="true">
          {winner.kind === "ai" ? winner.avatar : "🏆"}
        </div>

        <h2 className="title" id="victory-title">
          {title}
        </h2>

        <p className="victory__winner">
          <Avatar emoji={winner.avatar} color={winner.color} size="1.6em" />
          {t("win.winner", { name: winner.name })}
        </p>

        {starsEarned > 0 && (
          <p className="pill pill--star" style={{ fontSize: "var(--t-md)" }}>
            ⭐ {t("win.starsEarned", { n: starsEarned })}
          </p>
        )}

        <div className="victory__stats">
          {stats.map((stat) => (
            <div className="stat" key={stat.label}>
              <div className="stat__value">
                <span aria-hidden="true">{stat.icon} </span>
                {stat.value}
              </div>
              <div className="stat__label">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="victory__actions">
          <Button variant="mint" size="lg" sound="select" onClick={onPlayAgain}>
            🔄 {t("game.restart")}
          </Button>
          <Button variant="purple" onClick={onChangeGame}>
            🔀 {t("game.changeGame")}
          </Button>
          <Button variant="ghost" onClick={onHome}>
            🏠 {t("app.home")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
