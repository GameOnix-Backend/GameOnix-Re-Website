import { StrictMode, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useLocation } from "react-router-dom";

import "./constants/colors.css";
import "./constants/fonts.css";
import "./constants/times.css";
import "./style/index.css";
import "./style/main-layout.css";
import "./style/sidebar-style.css";

import App from "./App.jsx";

function ScrollToTop() {
  const { key } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [key]);

  return null;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <App />
    </BrowserRouter>
  </StrictMode>,
);
