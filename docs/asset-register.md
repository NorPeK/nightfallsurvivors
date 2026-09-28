# Asset and dependency register

| Material | Source and handling |
| --- | --- |
| Hunter/enemy sprites, terrain and combat effects | Existing procedural drawing in `sprites.ts`/`render.ts`, extended in this repository; no downloaded artwork added. Repository owner must confirm rights to the pre-existing project/name before submission. |
| Sound effects and music | Locally synthesized in `audio.ts`; no third-party recordings or samples added. |
| Fonts | User/device system fonts (Georgia, Times New Roman, Avenir Next, Segoe UI, system sans-serif); no font files distributed or fetched. |
| Symbols and emoji | Unicode characters rendered by the device; text names accompany important icons. Appearance may vary across devices; a unified illustrated icon set remains a polish opportunity. |
| React, React DOM, Scheduler | MIT runtime dependencies. Full installed license notices are included in generated JavaScript and the Playables archive. |
| Next.js / Tailwind / esbuild / PostCSS / fflate / tsx | Build or development tooling declared in package.json/lockfile; Playables contains the bundled React game, not the Next runtime. |
| YouTube Playables SDK | Official external SDK loaded before game code in the Playables entry point. Supplied by YouTube, not copied or mocked in a production bundle. |
| Website icon | Original geometric N/crescent SVG created in `app/icon.svg`; replaces the scaffold favicon. No external artwork. |
| Default Next/Vercel public SVGs | Existing unused scaffold assets. Not referenced by the game or included in the dedicated Playables ZIP. |

No stock-image purchase, generated media, new brand claim or license attestation was made. This inventory records source provenance; it does not certify ownership of pre-existing material.
