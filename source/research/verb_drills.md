# Verb Drill Ladder Research

Purpose: turn the existing core verb cards into an actual conjugation drill so
Joe practices the forms he must say at the table instead of only reading paired
forms on flashcards.

## Source-guide anchors

- `source/ekaterina_guide.md:23`
  - early verb list includes high-frequency forms such as `хотеть`, `мочь`,
    `говорить`, `понимать`, `любить`, `работать`, `жить`, `есть`, `пить`,
    and `знать`.
- `source/ekaterina_guide.md:120-220`
  - broader verb inventory and conjugation examples, including transportation
    and second-conjugation notes.
- `source/ekaterina_guide.md:1289-1293`
  - lesson guidance explicitly points Joe to verb conjugation exercises.
- `source/ekaterina_guide.md:1670-1675`
  - homework asks Joe to study and memorize the conjugation table.
- `source/ekaterina_guide.md:2031-2062`
  - pronoun/form exercises include `я`, `ты`, `он/она`, `мы`, `вы`, `они` and
    practical forms such as `я живу́`, `вы ду́маете`, `я люблю́`, `я обе́даю`,
    and `он рабо́тает`.

## Added drill decision

- The generated `verb_drill_cards` derive from the existing verified `verbs`
  module rather than introducing new Russian.
- Each core verb now creates six typed conjugation cards: `я`, `ты`,
  `он/она`, `мы`, formal `вы`, and `они` + infinitive.
- The app now has a separate `Conjugate` drill stage so `case_or_inflection`
  misses route to real verb-form repair practice.
- The first expansion deliberately stays inside the existing 10 core verbs:
  `хоте́ть`, `мочь`, `говори́ть`, `понима́ть`, `люби́ть`, `рабо́тать`,
  `жить`, `есть`, `пить`, and `знать`.

## Verification notes

- Stress-marked answers are accepted, but stress is optional for typed answers
  because the learner may type plain Cyrillic.
- This is a drill-card layer, not new phrase content; it should not change the
  phrase count or Anki row count.
- The saved guide's conjugation tables and exercises provide the pronoun ladder
  (`я`, `ты`, `он/она`, `мы`, `вы`, `они`) and several direct form examples;
  remaining forms are limited to the same core verbs already accepted into the
  course.
