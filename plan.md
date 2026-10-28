# CampusPulse — Implementation & Design Plan

## Product and implementation approach

Build a single-page, fully client-side web application. React + TypeScript + Vite will keep the interface modular and fast while ensuring that feedback never needs to leave the browser. No database, account system, network AI call, or hosted inference is required; the analyzed dataset remains in memory. Pin the package manager/toolchain and explicitly review lifecycle-script permissions before dependency installation.

The analyzer will process one nonblank line as one comment, trim and normalize whitespace, deduplicate only for computation while preserving every submitted row in visible results, and provide one deterministic Positive / Negative / Neutral classification for each comment. A locally bundled VADER implementation is the primary NLP engine; a TextBlob-compatible local adapter is checked second if available, followed by the built-in word-list scorer. Failures fall through automatically and the active engine is disclosed. Rule handling will account for negation, intensifiers, punctuation and emoji cues without sending text to a service. Analysis runs in a local Web Worker so larger datasets do not block typing or scrolling; charts and the VADER engine are loaded only when needed. Fonts are bundled locally and never fetched from a font service. CSV parsing is local, detects likely feedback fields, and exposes a column chooser when appropriate. Statistics, verdicts, lexical insights, entity/aspect signals and exports are derived from the current analyzed data.

## Project structure

- `src/app/` — dashboard shell, feedback input and sample prompts, CSV drop/upload and column selection, analysis state, theme, exports, and responsive navigation.
- `src/features/analyzer/` — searchable, paginated, accessible per-comment results, including sentiment and aspect clues.
- `src/features/insights/` — data-derived strengths, weaknesses, priorities, and campus entity summaries.
- `src/lib/sentiment/` — ordered engine adapters, normalization, deterministic fallback lexicon and unit-tested classification helpers.
- `src/lib/feedback/` — CSV parsing/column detection, aggregation, deduplication and export utilities.
- `src/components/` — reusable brand mark, accessible sentiment distribution chart, and shared dashboard elements.
- `public/manus-routes.json` — the one-page route manifest.

Dependencies will be limited to a local VADER package, local CSV parser, charting and icon utilities plus React/Vite/TypeScript; they must be bundled into the application. The client runtime requires no external API. The Vite development server will use the initialized port 3000. A static production build will be prepared for delivery.

## Product behavior

The empty state will explain that comments may be pasted one per line or imported from CSV. It will not invoke analysis for blank input. The analysis view will show the original comment with a textual sentiment label, emoji and accessible color cue; summary metrics will include all counts and mathematically correct percentages. The chart updates from the same computed dataset. Verdict language will be derived from the distribution, with meaningful ties/balanced and mixed cases. Positive/negative frequent terms, common campus entities, lightweight aspect cues, actionable strengths/weaknesses, and comment counts will be computed from submitted text rather than hardcoded. CSV and JSON exports plus print-friendly output will share the same analysis state. Malformed, empty or very large files receive clear feedback rather than raw errors or frozen UI.

## Design direction

**Design Movement:** Contemporary editorial analytics, borrowing the calm precision of Linear and Stripe dashboards while giving the product its own campus-focused character.

**Core Principles:** Insight before decoration; generous, deliberate spacing; clear semantics and accessible contrast; calm interactions that remain fast under large inputs.

**Color Philosophy:** Warm near-white surfaces and deep ink establish focus; a distinctive campus-jade green conveys constructive feedback, with muted coral for concerns and cool slate for neutral data. Color is paired with labels, icons and shape so meaning is never color-only.

**Layout Paradigm:** A compact persistent left rail anchors the workspace; a broad editorial overview leads into an asymmetric analysis workbench with input/results as the primary column and a narrower insights rail. On small screens the rail collapses into a top-level menu and the columns become a readable flow.

**Signature Elements:** A fine-grained “signal line” motif that connects sentiment proportions to insight cards; a jade accent used sparingly on action and positive signals; capsule sentiment chips with clear emoji and label.

**Interaction Philosophy:** One obvious Analyze action, drag-and-drop CSV, visible sample feedback, and contextual empty/error states reduce cognitive load. Keyboard-first controls and live status announcements make state transitions legible.

**Animation:** Short opacity/translate reveals on first results, restrained metric count transitions, and subtle hover/focus feedback; respect reduced-motion preferences and avoid repeated/disruptive chart motion.

**Typography System:** Inter for interface and body text, paired with a restrained editorial display face such as DM Sans for headings. Use tabular numerals for metrics, a compact but generous type scale, and avoid low-contrast microtext.

**Brand Essence:** CampusPulse turns everyday student comments into clear, actionable campus signals; **perceptive, calm, trustworthy**.

**Brand Voice:** Direct, warm, and evidence-led. Example lines: “Hear the pattern behind the comments.” “A clearer signal for what students need next.”

**Wordmark & Logo:** A custom compact mark formed from three rising signal bars inside a rounded campus-green tile, paired with a humanist wordmark; implement as a crisp inline SVG so it remains sharp without remote assets.

**Signature Brand Color:** Campus jade `#168B69`, reserved for primary actions and positive momentum.

## Serving and constraints

The application is served by Vite during development and builds to static assets for production. No server or database capability is needed. All text analysis and file handling happen locally. Optional local adapters may enhance the primary engine, but no optional component is allowed to block core classification. Source and dependencies will be organized for future additions such as institutional history or local model-based summaries without introducing those services now.
