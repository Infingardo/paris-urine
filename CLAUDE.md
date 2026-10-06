# paris-urine: instructions for Claude and Codex

Pathology decision-support tool, published on GitHub Pages. Single-page HTML/JS, no build step. Logic lives in: `app.js`, `classifier.js`, `referto.js`, `tps-data.js`; UI in `index.html`. Tests: `npm test`. PWA with `sw.js`: check how the cache is versioned before changing precached files.

## Rules
- Diagnostic content (entities, criteria, cutoffs, scoring, report wording) is curated by Filippo. Change it only on his instruction or from a cited source, never from memory. If code and source disagree, report it; do not choose.
- Before changing anything that can alter an output: plan first, state which outputs change, add or update tests (or, where none exist, say how you verified it) with at least one input per affected class, and run the tests before closing.
- After such a change, get an independent review against the agreed spec: `/verify-agent` in Claude Code, or a separate review pass against the cited source.
- Keep logic separate from the UI where the code allows it. No fake precision: show uncertainty and equivocal results.
- No patient data in code, tests, fixtures, docs or commit messages.
