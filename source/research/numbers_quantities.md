# Numbers, Months, Prices, And Quantities

Purpose: add a compact, source-backed survival lane for numbers that occur
throughout the original guide: prices, months, hours worked, years, and
headcounts. These are mission-critical because family, hotel, travel, and work
follow-ups often become number questions.

## Source anchors

- `source/ekaterina_guide.md:236` — `Сколько` as how many/how much.
- `source/ekaterina_guide.md:334` — month list in the original guide.
- `source/ekaterina_guide.md:823-824` — firm headcount and monthly money context.
- `source/ekaterina_guide.md:987-989` — `Сколько дней...` and a five-day answer.
- `source/ekaterina_guide.md:1023-1025` — `Сколько было человек?` and
  `Было 70 человек.`
- `source/ekaterina_guide.md:1205-1211` — hours-worked questions and answers:
  `4 часа 30 минут`, `ещё 2 часа`, and `7 часов`.
- `source/ekaterina_guide.md:1335` — `Сколько сейчас времени? Сейчас 3:12`.
- `source/ekaterina_guide.md:1471-1485` — `Сколько стоит?`, `Сколько стоят?`,
  `тысяча`, `две/три/четыре тысячи`, and larger thousand patterns.
- `source/ekaterina_guide.md:1491-1493` — years-in-house question and answer.
- `source/ekaterina_guide.md:2518` — seven/eight-hour workday story.

## Web verification

- Pinhok "Days & Months in Russian" confirms the stressed forms for month names:
  `янва́рь`, `февра́ль`, `апре́ль`, `ию́нь`, `ию́ль`, `а́вгуст`, `сентя́брь`,
  `октя́брь`, `ноя́брь`, and `дека́брь`.
  https://www.pinhok.com/kb/russian/262/russian-months-days/
- Wiktionary confirms `сколько это стоит` as a Russian phrase meaning "how much
  does this/that/it cost?", supporting the cost-question lane.
  https://en.wiktionary.org/wiki/%D1%81%D0%BA%D0%BE%D0%BB%D1%8C%D0%BA%D0%BE_%D1%8D%D1%82%D0%BE_%D1%81%D1%82%D0%BE%D0%B8%D1%82

## Course decisions

- Use a new `numbers_quantities` module because the content is cross-cutting and
  otherwise gets buried under calendar, work, and travel.
- Keep month cards recognition-first. Joe needs to recognize date/month prompts
  more than recite the calendar under dinner pressure.
- Include both `сто́ит` and `сто́ят` because the source guide drills both.
- Avoid long free-form number generation. The cards are fixed patterns from the
  guide, with notes to adapt exact numbers only after rehearsal.
