# Native-Speed Check-In Recognition Research

Purpose: expand the listening lane with recurring family-style questions from
the saved Ekaterina guide. These are recognition-first cards: Joe needs to catch
the question quickly, then answer with phrases already available elsewhere in
the course.

## Source-guide anchors

- `source/ekaterina_guide.md:840-850`
  - check-in questions around `Чем ты сегодня занимался?`, day/weather, and
    `Как на улице?`
- `source/ekaterina_guide.md:977-981`
  - weekend and holiday-plan prompts: `Что ты делал/вы делали на выходных?`
    and `Какие планы на Рождество?`
- `source/ekaterina_guide.md:1197-1211`
  - recurring personal check-ins: `Как дела?`, `Что ты сегодня делал?`,
    `Сколько часов ты работал?`, and usual work-hour questions.
- `source/ekaterina_guide.md:1224-1234`
  - `Что ты делал на прошлой неделе?` and another `Что ты делал?` review.
- `source/ekaterina_guide.md:1792-1803`
  - `Что ты делал на этой неделе? Чем был занят?` plus another weather prompt.

## Added phrase decisions

- All cards are `recognize=True`; they are fast input Joe should understand
  before choosing a short answer from `daily_routine`, `work_business`,
  `calendar_weather`, or `celebrations`.
- `Чем был за́нят?` and `Ско́лько часо́в ты рабо́тал?` are marked male because
  the questions address Joe with masculine past-tense agreement.
- The source has a `ты/вы` paired weekend prompt. The learner-facing card uses
  formal/plural `вы` because it is safer with elders and already matches the
  original guide's paired wording.

## Verification notes

- Stress marks use combining acute. `ё` marks stress when present.
- No new answer phrases are introduced in this lane; it is strictly a listening
  recognition layer over source-guide questions.
