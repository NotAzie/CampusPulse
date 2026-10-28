# CampusPulse — Feedback Intelligence

A browser-based campus feedback analyzer that turns student comments into transparent, actionable signals. Feedback stays in memory on the current device; analysis, CSV import, charts, and report exports require no hosted AI, account, database, or server-side inference.

## Run locally

CampusPulse uses Node 22 and pnpm 11. The package manager is pinned in `package.json`.

```sh
pnpm install
pnpm dev
```

The Vite development server listens on `http://localhost:3000`. Build the static, self-hostable site with `pnpm build`; the production assets are written to `dist/`. Run the analysis and import tests with `pnpm test`.

Dependencies must be installed once before first use. After installation/build, the application has no runtime CDN or network dependency: fonts, sentiment code, charts, icons, and CSV parsing are bundled locally. The VADER analyzer runs in a browser worker so larger inputs do not block interaction.

## Analysis behavior

Each nonblank line is one comment. Whitespace is normalized for analysis; blank lines are ignored. Duplicate text is classified once per analysis run, but every submitted row remains visible. The app reports exactly one Positive, Negative, or Neutral label per comment, VADER compound score, total counts, percentages, a derived verdict, frequent sentiment-specific terms, common campus entities, and contrastive aspect clues.

The engine tries bundled VADER first, then an optional same-origin TextBlob bridge exposed as `globalThis.campusPulseTextBlob.polarity(text)`, followed by the deterministic built-in word-list fallback. The fallback compares positive and negative word/emoji occurrences, handles simple negation and intensifiers, and never trains a model. Campus-specific cues supplement VADER only when it returns a neutral score for clearly sentiment-bearing terms. No feedback text is uploaded by the app.

CSV import is local and capped at 5 MB; valid one-column files are accepted and quoted multiline cells remain one feedback comment. The analyzer handles up to 5,000 comments per run to preserve responsiveness. Likely feedback columns are detected from headers and content, with a column selector shown when several candidates exist. CSV and JSON exports include comment-level results, statistics, data-derived summaries, campus entities, and sentiment keywords. The print-friendly browser report includes the complete transcript, independent of on-screen search or pagination.

## Project map

- `src/app/` — dashboard shell, analysis state, CSV interaction, themes, and report actions.
- `src/features/analyzer/` — searchable, paginated per-comment results.
- `src/features/insights/` — campus entity summaries and data-derived narrative insights.
- `src/lib/sentiment/` — VADER-first classification, local adapter path, normalization, and fallback lexicon.
- `src/lib/feedback/` — CSV utilities, sentiment metrics, verdicts, and keyword/entity analysis.
- `src/workers/` — off-main-thread sentiment analysis.
- `public/manus-routes.json` — the page-route declaration used by WebDev.
