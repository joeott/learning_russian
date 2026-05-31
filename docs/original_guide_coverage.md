# Original Guide Coverage Map

This maps `source/ekaterina_guide.md` to the current app course so future
iterations can close the real beginner-course gaps without inventing Russian.

## Current generated course

- Source of truth: `scripts/build_content.py`
- Generated content: 159 items across 11 modules
- Strongest coverage today:
  - greetings and first contact
  - politeness and repair phrases
  - toasts
  - family and in-law vocabulary
  - food/table compliments and requests
  - common listening questions
  - calendar and weather small talk
  - daily-routine and time-of-day answers
  - Budva/Montenegro trip logistics and simple place descriptions
  - a small core-verb reactivation set

## Original-guide coverage status

| Original guide area | Evidence in source | Current coverage | Gap / next course work |
| --- | --- | --- | --- |
| Verb reactivation and conjugation | `source/ekaterina_guide.md:23`, `source/ekaterina_guide.md:120-220`, `source/ekaterina_guide.md:1289-1293`, `source/ekaterina_guide.md:1670-1675` | Partial: `verbs` module has 10 high-frequency verbs | Add a structured verb-drill ladder: present-tense recognition, `я` production, `вы` recognition, and dinner-safe answers. |
| Greetings and lesson check-ins | `source/ekaterina_guide.md:840-848`, `source/ekaterina_guide.md:891-897`, `source/ekaterina_guide.md:1792-1803` | Partial: greetings plus several listening questions | Add more native-speed recognition drills for day, weather, week, and "what did you do" prompts. |
| Calendar, days, dates | `source/ekaterina_guide.md:303-317`, `source/ekaterina_guide.md:668-679`, `source/ekaterina_guide.md:820-850` | Covered by `calendar_weather` basics | Later: add dates/months only if they support actual travel/family prompts. |
| Weather and outside conditions | `source/ekaterina_guide.md:840-850`, `source/ekaterina_guide.md:897-910`, `source/ekaterina_guide.md:1799-1803` | Covered by `calendar_weather` basics | Later: add adjective-agreement contrast only if it improves spoken answers. |
| Budva/Montenegro trip logistics | `source/ekaterina_guide.md:1461-1467`, `source/ekaterina_guide.md:1501`, `source/ekaterina_guide.md:1969`, `source/ekaterina_guide.md:2031-2043`, `source/research/budva_travel.md` | Covered by `travel_budva` basics | Later: add airport-specific and hotel-check-in variants only if they are rehearsed with Kadriya. |
| Daily routine and time of day | `source/ekaterina_guide.md:1113-1120`, `source/ekaterina_guide.md:1198-1212`, `source/ekaterina_guide.md:1366-1368`, `source/ekaterina_guide.md:1378-1399`, `source/research/daily_routine.md` | Covered by `daily_routine` basics | Later: add fuller “my day” storytelling only if short-answer drills are already automatic. |
| Work, clients, business | `source/ekaterina_guide.md:820-839`, `source/ekaterina_guide.md:977-987`, `source/ekaterina_guide.md:1782-1803` | Partial: "lawyer" and smalltalk basics | Add short lawyer/work answers and listening prompts for occupation, busy week, and clients. |
| Holidays and celebrations | `source/ekaterina_guide.md:891-930`, `source/ekaterina_guide.md:981-987` | Partial: toast module only | Add a holiday/celebration scenario for family-table small talk. |
| Idioms and proverbs | `source/ekaterina_guide.md:582-591`, `source/ekaterina_guide.md:864-881` | Missing | Keep as recognition-only bonus unless Kadriya verifies high value for the visit. |
| Adverbs, adjectives, and grammar notes | `source/ekaterina_guide.md:476-554`, `source/ekaterina_guide.md:1082-1107`, `source/ekaterina_guide.md:1917-1935` | Indirect only | Convert only the parts that improve oral survival: adjective agreement in weather/day phrases and adverbs for simple answers. |
| Family/baby questions | `source/ekaterina_guide.md:636-639` | Partial: family module | Add one scenario for family health/baby readiness if Kadriya wants this practiced. Mark uncertain/over-personal items `rehearse=True`. |
| Anecdotes/legal jokes | `source/ekaterina_guide.md:1979-1983` | Missing | Do not add as core beginner content; possible recognition-only cultural bonus after essentials. |

## Priority order for remaining build-out

1. `work_business`: lets Joe answer predictable questions about being a lawyer without overexplaining.
2. `holiday_celebration`: handles Christmas/holiday prompts and family-table storytelling.
3. Fuller `daily_routine` story mode if the short answers are already automatic.
4. Airport/hotel variants for Budva if Kadriya confirms they are useful.
5. Recognition-only bonus deck: idioms, proverbs, and legal jokes after the mission-critical modules are green.

## Rules for adding each gap

- Use only Russian found in `source/ekaterina_guide.md` or verified in
  `source/research/`.
- Preserve stress marks with combining acute before adding learner-facing items.
- Add uncertain or personal items with `rehearse=True`.
- Rebuild with `tools/zastolom build` and verify with `tools/zastolom verify`
  after each content patch.
