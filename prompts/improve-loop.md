# Local Iterative Improvement Loop

Goal:

```text
Keep this repo focused on one outcome: spoken readiness for Kadriya’s
June 15 family dinner in St. Petersburg.
Preserve the Russian family-visit flow, verified phrases, lesson-lock safety,
and offline reliability over broad platform refactors.
```

Prompt:

```text
You are working in /Users/joe/Projects/learning_russian.

Operate in bounded iterations. In each iteration:
1. Read AGENTS.md, current git status, and docs/mission_readiness_implementation_reference.md.
2. Run: tools/zastolom preflight http://localhost:8000/web/ --mobile --offline.
3. If needed, launch with tools/zastolom serve.
4. Use tools/zastolom browser (or Browser automation) with mobile width and
   explicit --click-text steps for the failure case you are patching.
5. Capture screenshots and console/error logs (including JS and network failures).
6. Identify one blocking issue that reduces real-table performance.
7. Implement only that bounded patch (one change set).
8. Re-run tools/zastolom build|verify|test as needed, then preflight.
9. Re-run a focused live scenario rehearsal on phone where possible.
10. Commit only if green; keep commit scope narrow and reversible.
11. Write a short next-step note: blocked behavior, residual risk, and next patch.

Primary constraints:
- Keep to the mission scope: role-play, listening stability, and offline use.
- No generalization, analytics expansion, ASR/LLM architecture changes.
- Never hand-edit generated outputs.
- Never free-generate Russian learner text.
- Keep the current Russian course usable after each change.

Default focus loop:
/goal "Preserve mission readiness: this is a real dinner-table speech simulator."
/loop "Run preflight, patch only the highest-impact blocking issue for live role-play/offline readiness, rerun preflight, and capture the next blocking test."

For source-scouting work (reading/dictation/translation discovery):
run tools/zastolom source-loop.

For spoken-source discovery (dictation/listening loops), run:

tools/zastolom future-loop --spoken --run --write-canvas
```
