import { useEffect, useSyncExternalStore } from "react";

const GAMES_DATA_URL =
  "https://raw.githubusercontent.com/mhdpstudio/GameOnix-Data-Content/main/games-data.json";
const REFRESH_INTERVAL = 60_000;

let snapshot = { games: [], loading: true, error: "" };
let refreshTimer;
let activeRequest;
const listeners = new Set();

function publish(nextSnapshot) {
  snapshot = nextSnapshot;
  listeners.forEach((listener) => listener());
}

async function refreshGames() {
  if (activeRequest) return activeRequest;

  activeRequest = (async () => {
    try {
      const url = new URL(GAMES_DATA_URL);
      url.searchParams.set("_", String(Date.now()));
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to fetch games data");

      const data = await response.json();
      const games = (Array.isArray(data) ? data : data?.games || []).filter(
        (game) => game?.slug && game?.title
      );
      publish({ games, loading: false, error: "" });
    } catch {
      publish({
        ...snapshot,
        loading: false,
        error: snapshot.games.length ? "" : "Couldn't load games right now. Please try again.",
      });
    } finally {
      activeRequest = null;
    }
  })();

  return activeRequest;
}

function subscribe(listener) {
  listeners.add(listener);
  if (listeners.size === 1) {
    void refreshGames();
    refreshTimer = window.setInterval(() => void refreshGames(), REFRESH_INTERVAL);
    window.addEventListener("focus", refreshGames);
    document.addEventListener("visibilitychange", onVisibilityChange);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", refreshGames);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  };
}

function onVisibilityChange() {
  if (document.visibilityState === "visible") void refreshGames();
}

export function useGameCatalog() {
  const state = useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
  return { ...state, refreshGames };
}
