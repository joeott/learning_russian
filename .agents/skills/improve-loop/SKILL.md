---
name: improve-loop
description: Run a bounded local loop that verifies, serves, browser-inspects, improves, tests, commits, and reports on the PWA.
---

# Improve Loop

Use `prompts/improve-loop.md` as the loop prompt.

Local-only deployment is the default. Each iteration should:

```bash
tools/zastolom verify
tools/zastolom test
tools/zastolom serve --port 8000
```

Then inspect `http://localhost:8000/web/` with `tools/zastolom browser --both`
or browser automation at desktop and mobile widths. Make one bounded improvement, rebuild via `tools/zastolom build`,
rerun verification, and commit only when green.
