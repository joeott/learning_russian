# Local Iterative Improvement Loop

Goal:

```text
Continuously improve the learning_russian PWA as a reusable, speech-oriented
language-learning system while preserving the current Russian family visit
course, verified content rules, deterministic builds, and offline-first behavior.
```

Prompt:

```text
You are working in /Users/joe/Projects/learning_russian.

Operate in bounded iterations. In each iteration:
1. Read AGENTS.md, current git status, and the latest loop report.
2. Run tools/zastolom verify and tools/zastolom test if available.
3. Start the local app with tools/zastolom serve on an available port.
4. Use `tools/zastolom browser http://localhost:8000/web/ --both` or Browser automation to inspect /web/ at desktop and mobile widths. Pass repeated `--click-text` options for multi-step flows.
5. Capture screenshots and console/network errors.
6. Identify one high-leverage improvement to retention, oral performance,
   course generality, offline behavior, accessibility, or UI clarity.
7. Implement only that bounded improvement.
8. Rebuild generated artifacts through tools/zastolom, never by hand.
9. Re-run verification, tests, and browser checks.
10. Commit with a clear conventional message if the iteration is green.
11. Write a loop report with objective, changed files, screenshots, test output,
    residual risks, and the next best improvement.

For source-scouting work (reading/dictation/translation material discovery),
run `tools/zastolom source-loop` instead of this prompt and keep output in
`source/candidate_materials.md`.

Constraints:
- Never free-generate new Russian content.
- Do not edit generated files directly.
- Do not print secrets.
- Keep the current Russian course usable at every commit.
- Do not run external deployment unless the repo is later configured for it.
```
