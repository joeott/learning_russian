# ICALL Implementation Plan

This repo is evolving from a focused Russian family-visit kit into a lesson-locked
ICALL system for spoken Russian acquisition. The app must remain offline-first,
deterministic, and grounded in verified Russian phrases.

## North Star

A learner can open the PWA, set a current lesson boundary, study stress-marked
Cyrillic with audio, complete recognition, recall, cloze, dictation,
back-translation, production, listening, and role-play flows, receive targeted
Russian-specific repair feedback, and have all progress reflected in local
mastery state. Critical flows are verified by tests and browser automation before
merge.

## Non-Negotiables

- Do not free-generate Russian learner content.
- Keep verified phrases and cultural corrections authoritative.
- Do not expose API keys in client-side code.
- AI, ASR, and TTS integrations must be optional; local non-AI study must keep
  working offline.
- Generated artifacts must come from `tools/zastolom build`.

## Slices

1. Course and curriculum graph foundation.
2. Lesson-boundary validation for items, cloze, dictation, back-translation, and
   role-play scenarios.
3. Contextual cloze cards with stage-specific mastery.
4. Audio dictation cards with listening and stress repair metadata.
5. Back-translation cards with deterministic accepted variants.
6. Lesson-constrained AI tutor prompt cards generated from structured scenarios.
7. Error-profile dashboard and targeted repair queues.
8. Pronunciation and listening ladder: captions, fading hints, stress danger,
   and optional recording/ASR adapters.
9. Readiness analytics: delayed recall, listening accuracy, production accuracy,
   role-play pass rate, fragile high-priority items.
10. Offline media packs and travel readiness checks.
11. Richer Anki export with sibling control for production, listening, scenario,
    and contrast cards.
12. Course templates for reusable scenario-driven language courses.

## Validation Standard

Every slice should include the smallest useful vertical path:

- schema/content contract,
- generator update,
- validation rule,
- unit test,
- web UI/state integration when learner-facing,
- targeted browser automation with console-error checks,
- PR evidence before merge.

## Current Direction

After cloze, dictation, and back-translation, the next foundation is a
lesson-constrained tutor workflow. It should turn existing structured scenarios
and verified phrase banks into copyable AI tutor prompts that:

- name the current scenario and lesson boundary,
- list only verified target phrases,
- expose allowed vocabulary, structures, and error types,
- enforce short corrective feedback,
- prevent unguarded beginner-level Russian generation.
