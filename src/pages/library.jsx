import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getFavorites } from "../api/favorites";
import { getFollows, removeFollow } from "../api/follows";
import GameCard from "../components/GameCard";
import "./../style/library-style.css";

const DATA_URL =
  "https://raw.githubusercontent.com/mhdpstudio/GameOnix-Data-Content/main/games-data.json";

function getGameList(data) {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.games) ? data.games : [];
}

function Library() {
  const [games, setGames] = useState([]);
  const [catalogGames, setCatalogGames] = useState([]);
  const [follows, setFollows] = useState([]);
  const [activeCollection, setActiveCollection] = useState("favorites");
  const [selectedFollowSlug, setSelectedFollowSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadLibrary() {
      try {
        setLoading(true);
        setError("");

        const [favoritesData, followsData, response] = await Promise.all([
          getFavorites(),
          getFollows(),
          fetch(DATA_URL),
        ]);

        if (!response.ok) {
          throw new Error("Couldn't load game details.");
        }

        const favoriteSlugs = Array.isArray(favoritesData.favorites)
          ? favoritesData.favorites
          : [];

        const data = await response.json();
        const allGames = getGameList(data);

        const favoriteGames = favoriteSlugs
          .map((slug) => allGames.find((game) => game.slug === slug))
          .filter(Boolean);

        const followed = Array.isArray(followsData.follows) ? followsData.follows : [];

        if (active) {
          setGames(favoriteGames);
          setCatalogGames(allGames);
          setFollows(followed.map((follow) => ({ ...follow, game: allGames.find((game) => game.slug === follow.slug) })).filter((follow) => follow.game));
        }
      } catch (err) {
        if (active) {
          setError(err.message || "Couldn't load your library.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadLibrary();

    return () => {
      active = false;
    };
  }, []);

  const followedGames = follows.map((item) => item.game);
  const updateAlerts = follows.filter(({ followedAt, addonCount, game }) => {
    const updatedAfterFollow = Date.parse(game.createdAt || "") > Date.parse(followedAt || "");
    const hasNewAddon = Array.isArray(game.addons) && game.addons.length > Number(addonCount || 0);
    return updatedAfterFollow || hasNewAddon;
  });
  const visibleGames = activeCollection === "favorites" ? games : activeCollection === "following" ? followedGames.filter((game) => !selectedFollowSlug || game.slug === selectedFollowSlug) : updateAlerts.map((item) => item.game);

  async function unfollow(slug) {
    try {
      const data = await removeFollow(slug);
      const updated = Array.isArray(data.follows) ? data.follows : follows.filter((item) => item.slug !== slug);
      setFollows(updated.map((follow) => ({ ...follow, game: catalogGames.find((game) => game.slug === follow.slug) })).filter((item) => item.game));
      if (selectedFollowSlug === slug) setSelectedFollowSlug("");
    } catch (err) {
      setError(err.message || "Couldn't update followed games.");
    }
  }

  return (
    <section className="library-page">
      <header className="library-welcome">
        <div className="library-welcome-copy">
          <span className="library-eyebrow">
            YOUR PERSONAL COLLECTION
          </span>

          <h1>
            My <span>Library</span>
          </h1>

          <p>
            All your favorite games, collected in one place.
            Pick up your next adventure.
          </p>
        </div>

        <div className="library-welcome-art" aria-hidden="true">
          ♡
        </div>
      </header>

      <div className="library-layout">
      <aside className="library-sidebar" aria-label="My library sections">
        {[{ id: "favorites", label: "Favorites", count: games.length }, { id: "following", label: "Following", count: follows.length }, { id: "updates", label: "Updates for you", count: updateAlerts.length }].map((item) => <button key={item.id} type="button" className={activeCollection === item.id ? "is-active" : ""} onClick={() => { setActiveCollection(item.id); setSelectedFollowSlug(""); }}><span>{item.label}</span><b>{item.count}</b></button>)}
        <div className="library-sidebar-games"><span className="library-sidebar-caption">FOLLOWED GAMES</span>{follows.length ? follows.map(({ slug, game }) => <button key={slug} type="button" className={activeCollection === "following" && selectedFollowSlug === slug ? "is-selected" : ""} onClick={() => { setActiveCollection("following"); setSelectedFollowSlug(slug); }}><img src={game.poster || game.game_poster || ""} alt="" /><span>{game.title || slug}</span></button>) : <small>Games you follow will appear here.</small>}</div>
      </aside>
      <section className="library-section">
        <div className="library-heading">
          <div>
            <span className="library-kicker">YOUR COLLECTION</span>
            <h2>{activeCollection === "favorites" ? "Favorite Games" : activeCollection === "following" ? "Games You Follow" : "Updates for You"}</h2>
            <p>{activeCollection === "updates" ? "New updates and add-ons from the games you follow." : activeCollection === "following" ? "New game releases are saved to your account." : "Your saved games are ready when you are."}</p>
          </div>

          {!loading && !error && (
            <span className="library-count">
              {visibleGames.length} {visibleGames.length === 1 ? "GAME" : "GAMES"}
            </span>
          )}
        </div>

        {loading ? (
          <div className="library-status">
            <span className="library-loader" />
            <p>Loading your library...</p>
          </div>
        ) : error ? (
          <div className="library-status" role="alert">
            <p>{error}</p>

            <button
              className="library-retry"
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        ) : visibleGames.length === 0 ? (
          <div className="library-empty">
            <div className="library-empty-icon" aria-hidden="true">
              ♡
            </div>

            <h2>Your library is waiting</h2>

            <p>
              {activeCollection === "updates" ? "When a followed game gets an update or a new add-on, it will show up here." : activeCollection === "following" ? "Follow a game to keep it in your library and hear about updates." : "Add games to your favorites and they will show up here."}
            </p>

            <Link to="/" className="library-explore">
              Explore Games <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : (
          <div className="library-games-grid">
            {visibleGames.map((game) => (
              <div className="library-game-item" key={game.slug}><GameCard game={game} />{activeCollection === "following" && <button type="button" className="library-unfollow" onClick={() => void unfollow(game.slug)}>Unfollow</button>}{activeCollection === "updates" && <span className="library-update-badge">New activity</span>}</div>
            ))}
          </div>
        )}
      </section>
      </div>
    </section>
  );
}

export default Library;
