---
description: Add a verified Russian phrase to the content set (with sourcing), then rebuild
argument-hint: "<English meaning or topic to add>"
---
Add new phrase(s) for: **$ARGUMENTS**

Follow this exactly — accuracy matters more than speed:

1. **Verify, don't invent.** Confirm the Russian (spelling + stress) against at
   least one authoritative source. Prefer the `ff web` deep-research CLI:
   ```bash
   cd ~/Projects/final_fact && set -a; source ~/Projects/.env 2>/dev/null; set +a
   venv/bin/python -m final_fact.cli web search --query "…" --num 6 --json
   ```
   Save anything substantial under `source/research/`. If you can't confirm
   stress or naturalness, set `rehearse=True` so it's flagged for Kadriya.
2. **Add to the data table** in `scripts/build_content.py` via the `add(...)`
   helper: `add(module, ru_with_stress, english, hint, priority, **flags)`.
   - module ∈ {first_contact, politeness, toasts, family, food, smalltalk, listening, verbs}
   - stress = combining acute (U+0301) on the stressed vowel
   - flags: `conf="med"`, `gender="m"`, `recognize=True`, `rehearse=True`, `note="…"`, `tags=[…]`
3. **Rebuild + audio + verify:**
   ```bash
   tools/zastolom build
   tools/zastolom audio generate     # synth the new item(s) only
   tools/zastolom build anki
   tools/zastolom verify
   ```
4. Report what you added, the source(s) you verified against, and any ★ rehearse flags.
