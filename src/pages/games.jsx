
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faGamepad,
  faRotate,
  faSearch,
} from "@fortawesome/free-solid-svg-icons";
import GameCard from "../components/GameCard";
import {
  getGameBadgeType,
  getGameReleaseTimestamp,
  isUpdatedGame,
} from "../utils/game-release";

import "./../style/games-style.css";
import { gameHasCategory, getGameCategories } from "../utils/game-categories";

const GAMES_DATA_URL =
  "https://raw.githubusercontent.com/mhdpstudio/GameOnix-Data-Content/main/games-data.json";

function getGameList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.games)) return data.games;
  return [];
}

function normalizePlatform(value) {
  const platform = String(value || "").trim().toLowerCase();

  if (["pc", "windows", "computer"].includes(platform)) return "pc";
  if (["ps", "playstation", "ps4", "ps5"].includes(platform)) return "ps";

  return platform;
}

function Games() {
  const [searchParams] = useSearchParams();

  const platform = normalizePlatform(searchParams.get("platform"));
  const type = searchParams.get("type") || "";
  const sort = searchParams.get("sort") || "";
  const now = Date.now();

  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [order, setOrder] = useState("recent");

  useEffect(() => {
    const controller = new AbortController();

    async function loadGames() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(GAMES_DATA_URL, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to fetch games data");
        }

        const data = await response.json();

        setGames(
          getGameList(data).filter((game) => game?.slug && game?.title)
        );
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Error loading games:", err);
          setError("Couldn't load games right now. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadGames();

    return () => controller.abort();
  }, []);

  const filteredGames = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    const matchingGames = games.filter((game) => {
      const matchesPlatform =
        !platform || normalizePlatform(game.platform) === platform;
      const matchesType =
        !type || gameHasCategory(game, type.trim());
      const releaseTimestamp = getGameReleaseTimestamp(game);
      const matchesRelease =
        sort === "recent"
          ? !isUpdatedGame(game) && releaseTimestamp !== null
          : sort === "updated"
            ? isUpdatedGame(game) && releaseTimestamp !== null
            : true;
      const matchesAvailability =
        availabilityFilter === "all" ||
        (availabilityFilter === "available"
          ? game.availability !== false
          : game.availability === false);
      const searchableText = [
        game.title,
        game.publisher,
        game.platform,
        ...getGameCategories(game),
        game.gameType,
      ].join(" ").toLocaleLowerCase();
      const matchesSearch = !needle || searchableText.includes(needle);
      return matchesPlatform && matchesType && matchesRelease && matchesAvailability && matchesSearch;
    });

    matchingGames.sort((first, second) => {
      if (order === "title") return String(first.title || "").localeCompare(String(second.title || ""));
      const firstDate = getGameReleaseTimestamp(first);
      const secondDate = getGameReleaseTimestamp(second);
      return firstDate !== null && secondDate !== null
        ? secondDate - firstDate
        : Number(second.id || 0) - Number(first.id || 0);
    });
    return matchingGames;
  }, [availabilityFilter, games, order, platform, search, sort, type]);

  const platformTitle =
    platform === "pc"
      ? "PC Games"
      : platform === "ps"
        ? "PlayStation Games"
        : "All Games";

  const pageTitle = sort === "updated"
    ? "Recently Updated Games"
    : sort === "recent"
      ? "Recently Added Games"
      : type ? `${type} Games` : platformTitle;

  if (loading) {
    return (
      <main className="games-page">
        <div className="games-status">
          <span className="games-loader" />
          <p>Loading games...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="games-page">
        <div className="games-status">
          <p>{error}</p>

          <button
            type="button"
            className="games-retry-button"
            onClick={() => window.location.reload()}
          >
            <FontAwesomeIcon icon={faRotate} />
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="games-page">
      <header className="games-page-header">
        <Link to="/" className="games-back-link">
          <FontAwesomeIcon icon={faChevronLeft} />
          Home
        </Link>

        <span className="games-platform-label">{platformTitle}</span>

        <h1>{pageTitle}</h1>

        <p>
          Explore {filteredGames.length}{" "}
          {filteredGames.length === 1 ? "game" : "games"}.
        </p>
      </header>

      <div className="games-toolbar" role="search">
        <label className="games-search">
          <FontAwesomeIcon icon={faSearch} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search games, publishers, platforms..."
            aria-label="Search games"
          />
        </label>
        <label className="games-filter-control">
          <span>Availability</span>
          <select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value)} aria-label="Filter by availability">
            <option value="all">All games</option>
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </label>
        <label className="games-filter-control">
          <span>Sort</span>
          <select value={order} onChange={(event) => setOrder(event.target.value)} aria-label="Sort games">
            <option value="recent">Recently added</option>
            <option value="title">Name A–Z</option>
          </select>
        </label>
      </div>

      {filteredGames.length === 0 ? (
        <div className="games-empty">
          <FontAwesomeIcon icon={faGamepad} />
          <h2>{search || availabilityFilter !== "all" ? "No matching games" : "No games found"}</h2>
          <p>{search || availabilityFilter !== "all" ? "Try changing your search or filters." : "There are no games matching this category yet."}</p>
          <Link to="/">Back to Home</Link>
        </div>
      ) : (
        <div className="games-grid">
          {filteredGames.map((game) => (
            <GameCard
              key={game.slug}
              game={game}
              badgeType={getGameBadgeType(game, now)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

export default Games;
