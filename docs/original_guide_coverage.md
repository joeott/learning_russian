# Original Guide Coverage Map

This maps `source/ekaterina_guide.md` to the current app course so future
iterations can close the real beginner-course gaps without inventing Russian.

## Current generated course

- Source of truth: `scripts/build_content.py`
- Generated content: 189 items across 13 modules, plus 20 generated conjugation drills
- Strongest coverage today:
  - greetings and first contact
  - politeness and repair phrases
  - toasts
  - family and in-law vocabulary
  - food/table compliments and requests
  - common listening questions
  - calendar and weather small talk
  - daily-routine and time-of-day answers
  - lawyer/work/client small talk
  - holiday, celebration, and family-plan recognition
  - Budva/Montenegro trip logistics and simple place descriptions
  - core-verb reactivation with typed conjugation drills

## Original-guide coverage status

| Original guide area | Evidence in source | Current coverage | Gap / next course work |
| --- | --- | --- | --- |
| Verb reactivation and conjugation | `source/ekaterina_guide.md:23`, `source/ekaterina_guide.md:120-220`, `source/ekaterina_guide.md:1289-1293`, `source/ekaterina_guide.md:1670-1675`, `source/ekaterina_guide.md:2031-2062`, `source/research/verb_drills.md` | Covered by `verbs` plus 20 generated `conjugate` drill cards | Later: add broader pronouns only if `я` and formal `вы` forms are automatic. |
| Greetings and lesson check-ins | `source/ekaterina_guide.md:840-848`, `source/ekaterina_guide.md:891-897`, `source/ekaterina_guide.md:1792-1803` | Partial: greetings plus several listening questions | Add more native-speed recognition drills for day, weather, week, and "what did you do" prompts. |
| Calendar, days, dates | `source/ekaterina_guide.md:303-317`, `source/ekaterina_guide.md:668-679`, `source/ekaterina_guide.md:820-850` | Covered by `calendar_weather` basics | Later: add dates/months only if they support actual travel/family prompts. |
| Weather and outside conditions | `source/ekaterina_guide.md:840-850`, `source/ekaterina_guide.md:897-910`, `source/ekaterina_guide.md:1799-1803` | Covered by `calendar_weather` basics | Later: add adjective-agreement contrast only if it improves spoken answers. |
| Budva/Montenegro trip logistics | `source/ekaterina_guide.md:1461-1467`, `source/ekaterina_guide.md:1501`, `source/ekaterina_guide.md:1969`, `source/ekaterina_guide.md:2031-2043`, `source/research/budva_travel.md` | Covered by `travel_budva` basics | Later: add airport-specific and hotel-check-in variants only if they are rehearsed with Kadriya. |
| Daily routine and time of day | `source/ekaterina_guide.md:1113-1120`, `source/ekaterina_guide.md:1198-1212`, `source/ekaterina_guide.md:1366-1368`, `source/ekaterina_guide.md:1378-1399`, `source/research/daily_routine.md` | Covered by `daily_routine` basics | Later: add fuller “my day” storytelling only if short-answer drills are already automatic. |
| Work, clients, business | `source/ekaterina_guide.md:820-839`, `source/ekaterina_guide.md:1028-1042`, `source/ekaterina_guide.md:1327-1334`, `source/ekaterina_guide.md:1679-1701`, `source/ekaterina_guide.md:1782-1803`, `source/ekaterina_guide.md:1829-1833`, `source/ekaterina_guide.md:1994-2012`, `source/ekaterina_guide.md:2516-2526`, `source/research/work_business.md` | Covered by `smalltalk` + `work_business` basics | Later: add only recognition-level legal vocabulary unless Kadriya confirms a production phrase is worth the risk. |
| Holidays and celebrations | `source/ekaterina_guide.md:889-895`, `source/ekaterina_guide.md:909-927`, `source/ekaterina_guide.md:981-989`, `source/ekaterina_guide.md:1017-1025`, `source/ekaterina_guide.md:1404-1405`, `source/ekaterina_guide.md:2234-2244`, `source/research/celebrations.md` | Covered by `celebrations` basics plus the existing toast module | Later: add recognition-only cultural extras only after mission-critical production phrases are automatic. |
| Idioms and proverbs | `source/ekaterina_guide.md:582-591`, `source/ekaterina_guide.md:864-881` | Missing | Keep as recognition-only bonus unless Kadriya verifies high value for the visit. |
| Adverbs, adjectives, and grammar notes | `source/ekaterina_guide.md:476-554`, `source/ekaterina_guide.md:1082-1107`, `source/ekaterina_guide.md:1917-1935` | Indirect only | Convert only the parts that improve oral survival: adjective agreement in weather/day phrases and adverbs for simple answers. |
| Family/baby questions | `source/ekaterina_guide.md:636-639` | Partial: family module | Add one scenario for family health/baby readiness if Kadriya wants this practiced. Mark uncertain/over-personal items `rehearse=True`. |
| Anecdotes/legal jokes | `source/ekaterina_guide.md:1979-1983` | Missing | Do not add as core beginner content; possible recognition-only cultural bonus after essentials. |

## Priority order for remaining build-out

1. Fuller `daily_routine` story mode if the short answers are already automatic.
2. Work/legal recognition-only vocabulary if family asks deeper lawyer questions.
3. Airport/hotel variants for Budva if Kadriya confirms they are useful.
4. Broader verb-pronoun drills only after `я` and formal `вы` are automatic.
5. Recognition-only bonus deck: idioms, proverbs, and legal jokes after the mission-critical modules are green.

## Rules for adding each gap

- Use only Russian found in `source/ekaterina_guide.md` or verified in
  `source/research/`.
- Preserve stress marks with combining acute before adding learner-facing items.
- Add uncertain or personal items with `rehearse=True`.
- Rebuild with `tools/zastolom build` and verify with `tools/zastolom verify`
  after each content patch.
