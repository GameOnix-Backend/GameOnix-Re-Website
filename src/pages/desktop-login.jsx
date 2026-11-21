import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getCommunityApiToken } from "../api/session";
import { useAuth } from "../context/AuthContext";
import "../style/launcher-style.css";

function fromBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")), (character) => character.charCodeAt(0));
}

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export default function DesktopLogin() {
  const location = useLocation();
  const { user, authLoading } = useAuth();
  const [state, setState] = useState("waiting");
  const [error, setError] = useState("");
  const fragmentQuery = window.location.hash.slice(1).split("?").slice(1).join("?");
  const handoff = new URLSearchParams(fragmentQuery);
  const nonce = handoff.get("state") || "";
  const keyValue = handoff.get("key") || "";

  useEffect(() => {
    if (!/^[a-f0-9]{64}$/.test(nonce) || !/^[A-Za-z0-9_-]{43}$/.test(keyValue)) {
      setState("error");
      setError("This sign-in link is invalid. Return to GameOnix Desktop and try again.");
      return;
    }
    if (authLoading || !user || state !== "waiting") return;

    setState("connecting");
    (async () => {
      try {
        const token = await getCommunityApiToken();
        const key = await window.crypto.subtle.importKey("raw", fromBase64Url(keyValue), { name: "AES-GCM" }, false, ["encrypt"]);
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encrypted = new Uint8Array(await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(token)));
        const callback = new URL("gameonix://auth-callback");
        callback.searchParams.set("state", nonce);
        callback.searchParams.set("iv", toBase64Url(iv));
        callback.searchParams.set("payload", toBase64Url(encrypted));
        window.history.replaceState(window.history.state, "", `${location.pathname}${location.search}`);
        setState("opening");
        window.location.assign(callback.toString());
      } catch (reason) {
        setState("error");
        setError(reason.message || "Could not complete sign-in.");
      }
    })();
  }, [nonce, keyValue, user, authLoading, state, location.pathname, location.search]);

  const returnToApp = `${location.pathname}${location.search}${location.hash}`;
  const title = state === "error" ? "Sign-in needs attention" : state === "opening" ? "Returning to GameOnix" : state === "complete" ? "You’re signed in." : "Connecting your account";
  const description = state === "error" ? error : state === "opening" ? "Approve the browser prompt to open GameOnix Desktop. Your session is encrypted for this sign-in only." : authLoading ? "Checking your GameOnix session…" : user ? "Encrypting your website session for GameOnix Desktop…" : "Sign in to the GameOnix website first. Once signed in, return here to connect the desktop app.";

  return <main className="launcher-page"><section className="launcher-hero"><div className="launcher-copy"><span className="launcher-eyebrow">GAMEONIX DESKTOP</span><h1>{title}</h1><p>{description}</p>{!authLoading && !user && <Link className="launcher-download-button" to="/login" state={{ from: returnToApp }}>Sign in to GameOnix</Link>}{user && <span className="launcher-download-note">Account: {user.username || user.name || "GameOnix user"}</span>}</div><div className="launcher-preview"><img src="/logo.png" alt="GameOnix" /><strong>GameOnix Desktop</strong><span>Encrypted website sign-in</span></div></section></main>;
}
