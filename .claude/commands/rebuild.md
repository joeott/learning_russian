---
description: Regenerate all artifacts from content.json and run health checks
---
Rebuild the whole study system from the single source of truth and verify it.

Run:
```bash
tools/zastolom build       # content.json → web/content.js, anki deck (+media), cheatsheet
tools/zastolom audio coverage
tools/zastolom verify      # JSON + JS syntax + audio + deck checks
```

If `verify` reports missing audio, tell the user they can run `/audio` to fill it.
Report the final counts (items, audio coverage, anki rows). Do not edit generated
files by hand — if something is wrong, fix `scripts/build_content.py` and rebuild.
