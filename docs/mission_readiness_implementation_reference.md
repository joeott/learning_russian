# Mission-Readiness Reference (2026-05-31)

This is the current execution reference for the Russian family-visit system before
June 15. The goal remains **spoken dinner-table readiness**, not broad platform
generalization.

## What is in scope now

- Keep the current Russian-only stack, content, and offline-first PWA.
- Improve role-play transfer on realistic dinner scenarios.
- Validate that every merge remains crash-free offline and lesson-locked.

## Near-term priorities

1. Complete structured role-play coverage from the scenario set:
   - Rapid host questions
   - How we met
   - Lawyer / Missouri small talk
   - Full dinner simulation
   - Noisy table recovery
2. Keep feature additions small and performance-focused.
3. Run the end-to-end preflight before each merge:
   - `tools/zastolom preflight http://localhost:8000/web/ --offline`
4. Curate spoken source materials only if it directly supports real transfer:
   - `tools/zastolom source-loop --spoken --run --limit 3 --write-canvas`
5. Rehearse on phone with real noise and validate P1 + repair phrases with Kadriya.

## Key files touched

- `scripts/build_content.py` (authoritative scenarios list)
- `content/content.json` / `web/content.js` (generated output)
- `tools/zastolom` (preflight + flow flags)
- `scripts/browser_flow_check.mjs` (offline-flow preflight)
- `tutor/roleplay_protocol.md` (scenario reference)

## Repeatable improvement loop

Use this in terminal once you launch the app at `http://localhost:8000/web/`:

- `/goal "Keep mission focus on transfer, not platform generalization."`
- `/loop "Run preflight, patch blocking issues from live role-play, run flow check + offline path, and re-run."`
