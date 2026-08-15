import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/500.css";
import "@fontsource/public-sans/600.css";
import "@fontsource/public-sans/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";

import "./tokens.css";
import "./app.css";
import App from "./App.tsx";
import { themeInitial, appliquerTheme } from "./lib/themes.ts";

// Appliqué avant le premier rendu pour éviter un flash du thème par défaut.
appliquerTheme(themeInitial());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
