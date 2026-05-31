# ICALL Epic Plan

## Objective

Evolve За столо́м from a focused Russian family-visit PWA into a lesson-locked,
speech-first ICALL system while preserving the verified Russian course, offline
PWA behavior, deterministic builds, and no-free-generated-Russian rule.

The system should support structured curriculum progression, contextual
sentence-level SRS, dictation, back-translation, and lesson-constrained tutor
practice with immediate corrective feedback.

## Non-Negotiable Constraints

- Do not copy or redistribute copyrighted textbook text. Potapova-style means
  sequencing and curriculum structure, not source text ingestion.
- Do not add unverified Russian phrases. Reuse existing verified content unless
  a content-curation pass adds provenance.
- Do not put LLM, TTS, ASR, or other API secrets in `web/` or client-side JS.
- Preserve offline core practice. AI/ASR features must remain optional.
- Generated artifacts must come from `tools/zastolom build`.

## Implemented Foundation

Slice A is complete:

- `content/content.json` and `web/content.js` include a generated curriculum
  graph with ordered lessons.
- Items carry `lesson_id`, `lesson_number`, `lexemes`, `structures`,
  `prerequisites`, and `allowed_error_types`.
- Validation checks lesson ordering, item boundaries, cumulative structures,
  scenario references, and error-type references.
- Learn and Drill include a curriculum lock selector; default remains all
  lessons unlocked for the current family-visit workflow.

## Remaining Slices

### Slice B — Contextual Cloze SRS

Add deterministic cloze cards generated only from existing verified phrases.
Each card is tied to an item, lesson boundary, structure set, accepted answer,
and stage scheduling. Add a Cloze drill that respects the active curriculum
lock.

Acceptance:

- Cloze cards are generated into the content contract.
- Validation rejects cloze cards with invalid items, out-of-bound lessons, or
  answers not present in the verified source phrase.
- The PWA has a Cloze drill stage with stage-specific local scheduling.
- Lesson 1 cloze practice only shows Lesson 1 phrases and answers.

### Slice C — Dictation Foundation

Add audio-backed dictation cards constrained by unlocked lessons. Play a known
phrase, require Cyrillic typing, compare normalized stress-stripped text, and
log spelling/listening errors.

Acceptance:

- Dictation uses existing audio/TTS fallback and existing verified phrases.
- No ASR or external AI dependency.
- Errors route to listening/stress/vowel-reduction repair types.

### Slice D — Back-Translation Foundation

Digitize the deterministic Russian to English to Russian loop for existing
phrases. Start with accepted Russian variants only; defer LLM evaluation.

Acceptance:

- Learner sees Russian, records/types English meaning, hides Russian, then
  reproduces Russian.
- Evaluation uses normalized accepted Russian strings.
- Cards are lesson-bound and scheduled independently.

### Slice E — Lesson-Constrained Tutor Prompt Generator

Generate tutor prompts from curriculum, scenario, contrast-set, and error
taxonomy data. Prompts must list unlocked vocabulary/structures and explicitly
forbid out-of-bound generation.

Acceptance:

- Prompt generation is deterministic and offline.
- Tutor guardrails preserve existing correction philosophy.
- Prompts reference verified item IDs and scenario success criteria.

### Slice F — AI/ASR Adapter Contracts

Define optional backend/local adapter interfaces for LLM evaluation, tutor
conversation, and pronunciation/ASR hints. Do not expose secrets in the PWA.

Acceptance:

- Client can run without adapters.
- Adapter docs specify env-var/server boundary and content validation flow.
- Generated AI utterances must be checkable against unlocked vocabulary and
  structures before display.

### Slice G — Authoring Workflow

Add course-author guidance, template constraints, provenance requirements, and
tests that make new language packs safe to add.

Acceptance:

- Authors know how to add lessons, items, cloze/dictation/back-translation
  cards, source refs, and native-speaker review flags.
- CI/local tests enforce deterministic generated artifacts.

## Standard Validation Loop

For each slice:

```bash
tools/zastolom build
tools/zastolom verify
tools/zastolom test
npm run check:js
tools/zastolom serve --port 8000
tools/zastolom browser http://localhost:8000/web/#/learn --both
tools/zastolom browser http://localhost:8000/web/#/drill --both
```

Add targeted Playwright assertions when a feature depends on interaction state,
such as changing the active lesson boundary.
