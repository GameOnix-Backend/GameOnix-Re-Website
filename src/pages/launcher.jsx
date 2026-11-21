import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload } from "@fortawesome/free-solid-svg-icons";
import { faWindows } from "@fortawesome/free-brands-svg-icons";
import { useAuth } from "../context/AuthContext";
import "../style/launcher-style.css";

const RELEASE_API = "https://api.github.com/repos/mhdpstudio/GameOnix-App/releases/latest";
const ANALYTICS_API = "https://gameonix-backend.vercel.app/api/auth/favorites";

export default function Launcher() {
  const { user } = useAuth();
  const [asset, setAsset] = useState(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(RELEASE_API, { headers: { Accept: "application/vnd.github+json" } })
      .then((response) => { if (!response.ok) throw new Error("Could not load the latest launcher release."); return response.json(); })
      .then((release) => {
        const item = release.assets?.find((candidate) => candidate.name === "GameOnix-win-unpacked.zip");
        if (!item) throw new Error("The Windows launcher download is not available yet.");
        if (live) setAsset({ ...item, version: release.tag_name });
      })
      .catch((reason) => { if (live) setError(reason.message || "Could not load the launcher."); });
    return () => { live = false; };
  }, []);

  async function downloadLauncher() {
    if (!asset || downloading) return;
    setDownloading(true);
    setError("");
    try {
      await fetch(ANALYTICS_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "launcher-download", slug: "launcher" }), keepalive: true });
    } catch { /* Analytics must not block the download. */ }
    window.location.assign(asset.browser_download_url);
    window.setTimeout(() => setDownloading(false), 1500);
  }

  return <main className="launcher-page">
    <section className="launcher-hero">
      <div className="launcher-copy"><span className="launcher-eyebrow">GAMEONIX DESKTOP · WINDOWS</span><h1>Your games, ready to play.</h1><p>Browse your library, manage downloads, and keep GameOnix close at hand with the Windows desktop app.</p>
        <button type="button" className="launcher-download-button" onClick={() => void downloadLauncher()} disabled={!asset || downloading}><FontAwesomeIcon icon={faDownload} /> {downloading ? "Starting download…" : asset ? `Download ${asset.version}` : "Loading latest release…"}</button>
        <span className="launcher-download-note"><FontAwesomeIcon icon={faWindows} /> Windows · ZIP package · {asset?.size ? `${(asset.size / 1024 / 1024).toFixed(0)} MB` : "Checking size"}</span>
        {error && <p className="launcher-error" role="alert">{error}</p>}
        <p className="launcher-extract-note">Extract the ZIP, then launch <code>GameOnix.exe</code> from the extracted folder. No installer is included in this release.</p>
      </div><div className="launcher-preview"><img src="/logo.png" alt="GameOnix" /><strong>GameOnix Desktop</strong><span>{user ? `Welcome back, ${user.username || "gamer"}` : "Your game library in one place"}</span></div>
    </section>
    <section className="launcher-steps"><article><b>01</b><h2>Download</h2><p>Get the current Windows release from GitHub.</p></article><article><b>02</b><h2>Extract</h2><p>Unzip the package into a folder where you want to keep the app.</p></article><article><b>03</b><h2>Open GameOnix</h2><p>Run GameOnix.exe. Your app files stay in that folder.</p></article></section>
  </main>;
}
