# Mission-Readiness Reference (2026-05-31)

This is the current execution reference for the Russian family-visit system before
June 15. The goal remains **spoken dinner-table readiness**, not broad platform
generalization.

## What is in scope now

- Keep the current Russian-only stack, content, and offline-first PWA.
- Improve role-play transfer on realistic dinner scenarios.
- Validate that every merge remains crash-free offline and lesson-locked.

## Near-term priorities

1. **Scenario coverage first**
   - Ensure all protocol scenarios stay represented as structured `SCENARIOS` entries.
   - Keep required items, success criteria, and lesson boundaries present for each.
   - Use `docs/original_guide_coverage.md` to choose the next missing original-guide lane.
2. **Small, high-impact fixes only**
   - No generalization work unless it directly improves a June 15 use-case.
3. **Preflight every patch**
   - `tools/zastolom preflight http://localhost:8000/web/ --offline`
   - `tools/zastolom preflight http://localhost:8000/web/ --mobile --offline`
4. **Phone-first validation**
   - Run the app installed on the phone in offline mode and complete the minimal smoke flow:
     cache core/P1 audio, reboot with airplane mode, open at least one drill, and run one scenario.
5. **Manual source capture only when it converts directly**
   - Keep source scouting for spoken material when it creates immediate dinner-readiness drills:
     `tools/zastolom future-loop --spoken --easy --run --limit 3 --write-canvas`
   - Prefer clips/passages that map straight to role-play recovery or stress drills.

## Key files touched

- `scripts/build_content.py` (authoritative scenarios list)
- `content/content.json` / `web/content.js` (generated output)
- `tools/zastolom` (preflight + flow flags)
- `scripts/browser_flow_check.mjs` (offline-flow preflight)
- `tutor/roleplay_protocol.md` (scenario reference)
- `docs/original_guide_coverage.md` (original-guide gap map)

## Repeatable improvement loop

Use this in terminal once you launch the app at `http://localhost:8000/web/`:

- `/goal "Keep mission focus on transfer, not platform generalization."`
- `/loop "Run preflight + one focused scenario rehearsal. Fix only blocking regression for live role-play or offline behavior. Re-run preflight and document next blocking test."`

## Reference for immediate changes

- Structured scenario cards now follow protocol order in `scripts/build_content.py`.
- Any new scenario work should update all three:
  - `tutor/roleplay_protocol.md`
  - `scripts/build_content.py` (`SCENARIOS`)
  - generated `content/content.json` via `tools/zastolom build`
