import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getCommunityApiToken } from "../api/session";
import { useAuth } from "../context/AuthContext";
import "../style/launcher-style.css";

export default function DesktopLogin() {
  const [params] = useSearchParams();
  const { user, authLoading } = useAuth();
  const [state, setState] = useState("waiting");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const port = Number(params.get("port"));
    const nonce = params.get("state") || "";
    if (!Number.isInteger(port) || port < 1024 || port > 65535 || !/^[a-f0-9]{64}$/.test(nonce)) {
      setState("error"); setError("This sign-in link is invalid. Return to GameOnix Desktop and try again.");
      return undefined;
    }
    if (authLoading || !user || state !== "waiting") return undefined;
    setState("connecting");
    (async () => {
      try {
        const token = await getCommunityApiToken();
        const response = await fetch(`http://127.0.0.1:${port}/session?state=${encodeURIComponent(nonce)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          credentials: "omit",
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) throw new Error(result.error || "Could not connect to GameOnix Desktop.");
        if (active) setState("complete");
      } catch (reason) {
        if (active) { setState("error"); setError(reason.message || "Could not complete sign-in."); }
      }
    })();
    return () => { active = false; };
  }, [params, user, authLoading, state]);

  return <main className="launcher-page"><section className="launcher-hero"><div className="launcher-copy"><span className="launcher-eyebrow">GAMEONIX DESKTOP</span><h1>{state === "complete" ? "You’re signed in." : state === "error" ? "Sign-in needs attention" : "Connecting your account"}</h1><p>{state === "complete" ? "Your website account is now connected to the desktop app. You can close this tab and return to GameOnix." : state === "error" ? error : authLoading ? "Checking your GameOnix session…" : user ? "Sending your active website session securely to the desktop app…" : "Sign in to the GameOnix website first. Once signed in, come back here to finish connecting the desktop app."}</p>{!authLoading && !user && <Link className="launcher-download-button" to="/login" state={{ from: "/desktop-login" }}>Sign in to GameOnix</Link>}{state === "complete" && <span className="launcher-download-note">Signed in as {user?.username || user?.name || "GameOnix user"}</span>}</div><div className="launcher-preview"><img src="/logo.png" alt="GameOnix" /><strong>GameOnix Desktop</strong><span>Secure website sign-in</span></div></section></main>;
}
