// Entry point for the single-file standalone build (game.html).
// Bundled with esbuild — produces a double-clickable offline game.

import { createRoot } from "react-dom/client";
import GameRoot from "./components/GameRoot";

const el = document.getElementById("root")!;
createRoot(el).render(<GameRoot />);
