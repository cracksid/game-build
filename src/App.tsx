/**
 * The app shell and its router.
 *
 * Routing is a single piece of state rather than a router library. There are
 * seven screens, no URLs to share and no deep links to support, and this way
 * the built app also runs straight off the filesystem.
 */

import { useCallback, useEffect, useState } from "react";

import { AchievementToasts } from "./components/AchievementToasts";
import { Decor } from "./components/ui";
import type { GameId, PlayerConfig } from "./engine/types";
import { HelpScreen } from "./screens/HelpScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { LudoScreen } from "./screens/LudoScreen";
import { ProfilesScreen } from "./screens/ProfilesScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { SetupScreen } from "./screens/SetupScreen";
import { SnakesScreen } from "./screens/SnakesScreen";
import { useStore } from "./state/store";

export type Route =
  | { name: "home" }
  | { name: "setup"; game: GameId }
  | { name: "play"; game: GameId; players: PlayerConfig[]; resume: boolean }
  | { name: "settings" }
  | { name: "help"; game?: GameId }
  | { name: "profiles" };

export function App() {
  const [route, setRoute] = useState<Route>({ name: "home" });
  const { savedGame, clearSavedGame } = useStore();

  const go = useCallback((next: Route) => setRoute(next), []);
  const goHome = useCallback(() => setRoute({ name: "home" }), []);

  /**
   * The browser Back button (and Android's hardware back) should leave the
   * current screen, not the whole app. Pushing one history entry per screen
   * makes Back mean "go back to the menu".
   *
   * The guard matters: React runs effects twice in development to surface
   * exactly this kind of bug, and without it every screen would stack two
   * identical entries, so Back would need pressing twice.
   */
  useEffect(() => {
    if (route.name === "home") return;
    const current = window.history.state as { screen?: string } | null;
    if (current?.screen !== route.name) {
      window.history.pushState({ screen: route.name }, "");
    }
    const onPop = () => setRoute({ name: "home" });
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [route.name]);

  const startGame = useCallback((game: GameId, players: PlayerConfig[]) => {
    setRoute({ name: "play", game, players, resume: false });
  }, []);

  const resumeGame = useCallback(() => {
    if (!savedGame) return;
    setRoute({ name: "play", game: savedGame.game, players: [], resume: true });
  }, [savedGame]);

  return (
    <div className="app">
      <Decor />

      {route.name === "home" && (
        <HomeScreen
          onPlay={(game) => go({ name: "setup", game })}
          onSettings={() => go({ name: "settings" })}
          onHelp={() => go({ name: "help" })}
          onProfiles={() => go({ name: "profiles" })}
          onResume={resumeGame}
          onDiscardSaved={clearSavedGame}
        />
      )}

      {route.name === "setup" && (
        <SetupScreen
          game={route.game}
          onBack={goHome}
          onStart={(players) => startGame(route.game, players)}
          onHelp={() => go({ name: "help", game: route.game })}
        />
      )}

      {route.name === "play" && route.game === "ludo" && (
        <LudoScreen
          players={route.players}
          resume={route.resume}
          onHome={goHome}
          onChangeGame={() => go({ name: "setup", game: "snakes" })}
          onHelp={() => go({ name: "help", game: "ludo" })}
        />
      )}

      {route.name === "play" && route.game === "snakes" && (
        <SnakesScreen
          players={route.players}
          resume={route.resume}
          onHome={goHome}
          onChangeGame={() => go({ name: "setup", game: "ludo" })}
          onHelp={() => go({ name: "help", game: "snakes" })}
        />
      )}

      {route.name === "settings" && <SettingsScreen onBack={goHome} />}
      {route.name === "help" && <HelpScreen onBack={goHome} initial={route.game} />}
      {route.name === "profiles" && <ProfilesScreen onBack={goHome} />}

      <AchievementToasts />
    </div>
  );
}
