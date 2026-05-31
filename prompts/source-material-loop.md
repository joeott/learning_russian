# Russian Source-Material Loop (Reading → Dictation → Translation)

## Goal

Build a weekly loop that surfaces **easy, original Russian web content** and converts it
into short reading/dictation/back-translation drills while preserving the lesson lock and
offline-first constraints.

### Default success criteria

- Pull at least **2 new source texts per week**.
- Each selected text should be:
  - Cyrillic-based, preferably with built-in subtitles/transcripts,
  - culturally safe and non-offensive for family-meal contexts,
  - short enough for 30–90 seconds of focused practice,
  - understandable with mostly unlocked lesson vocabulary plus 1 new lexical item.
- For speaking/sound practice, a source should include audial cues (podcast, dialogue,
  video captions, transcript, or narrator audio).
- Every retained source must include:
  - a direct URL,
  - a short `why_relevant` note,
  - extraction level estimate,
  - one recommended drill mapping: read → dictation → translate.

## Loop (execute in bounded iterations)

1. Run the loop command to score fresh candidates:
   - `tools/zastolom source-loop --run --limit 5 --targets source/source_loop_targets.json`
   - This refreshes `tmp/source-loop-latest.json` and can optionally append approved pages to
     `source/candidate_materials.md` with `--write-canvas`.
   - For spoken/listening materials:  
     `tools/zastolom source-loop --spoken --run --limit 5 --targets source/source_loop_targets.json`
2. Or run the discovery-first variant to scan related links from each target section:
   - `tools/zastolom future-loop --run --limit 3 --targets source/source_loop_targets.json`
   - This opens each target, pulls in-page links that match discover paths in the target config, and scores them as candidate materials.
   - Spoken mode for source discovery:  
     `tools/zastolom future-loop --spoken --run --limit 3 --targets source/source_loop_targets.json`
3. Use `tools/zastolom browser <url> --both` to open a candidate source page and inspect
   readability on desktop and mobile.
4. Extract 1–2 short candidate passages and copy the exact source text.
5. For each passage, score:
   - `lexical_density` (hard vs. known words),
   - `speech_clarity` (clear narration / clean sentence pace),
   - `register` (family-safe / formal / neutral),
   - `origin` (`original` source, not translated subtitles).
6. Reject anything with hidden paywall friction or unstable content that breaks loading.
7. Save approved passages to `source/candidate_materials.md` under `## Week YYYY-MM-DD` with:
   - URL + title
   - why it is beginner-friendly
   - planned drill type (`read`, `dictation`, `translate`, `shadow`)
   - source status (`verified`, `needs_check`, `rehearse`)
8. Create 2–4 deterministic drill seeds in local notes:
   - one stress-targeted dictation prompt,
   - one translation prompt,
   - one cloze prompt,
   - one contrast / role-use prompt.
9. Validate any generated learner-facing text against lesson lock rules before adding to app content.
10. Build artifacts only through `tools/zastolom build` and verify with:
   - `tools/zastolom verify`
   - `tools/zastolom test`
   - `tools/zastolom flow`

## Browser-controller target list

Use these first, then expand by niche and source quality:

- `https://russian.rt.com/` (news snippets, short posts)
- `https://www.culture.ru/` (feature/interview summaries)
- `https://gramota.ru/` (short official materials)
- `https://www.russianpod101.com/welcome` (lesson transcripts)
- `https://www.youtube.com` + playlist of slow Russian story channels

Avoid:
- paywalled full-text articles,
- slang-heavy social media comments,
- machine-translated or dub-heavy sources.

## Deliverable

At the end of each source loop, produce:
- `source/candidate_materials.md` updated with 2–4 approved entries,
- a short log in `tmp/source-loop-latest.json` with scores and acceptance decisions.

For one-click spoken capture:

```bash
tools/zastolom future-loop --spoken --run --limit 3 --write-canvas
```

After each run, prefer adding 30–60 second audial passages first
(short dialogue, captioned clip, or podcast line) before any long reading material.
