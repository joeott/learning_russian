#!/usr/bin/env python3
"""Deterministic Anki deck generator for the Russian family-visit study set.

Reads content/content.json and writes anki/russian_family_visit.txt as a
TAB-separated import file (Anki "Notes in Plain Text" format) with a header
block. Tabs are used because the Russian/English glosses contain commas.

Columns (in order): English  Russian  Pronunciation  Note  Tags

- English  = the `en` gloss (PROMPT side; EN->RU production is the goal)
- Russian  = `ru` WITH stress marks, wrapped large; "(male form)" appended
             when gender == "m" (ANSWER side)
- Pronunciation = `hint`
- Note     = `note`, plus "(focus: understand when heard)" when recognize,
             plus a rehearse reminder when rehearse
- Tags     = module id, priority (p1/p2/p3), and `recognize` when recognize

The output is fully deterministic: same input JSON -> byte-identical output.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT_PATH = ROOT / "content" / "content.json"
OUTPUT_PATH = ROOT / "anki" / "russian_family_visit.txt"
AUDIO_SRC = ROOT / "web" / "assets" / "audio"  # {id}.mp3 from `zastolom audio generate`
MEDIA_DIR = ROOT / "anki" / "media"  # zastolom_{id}.mp3 for Anki import
MEDIA_PREFIX = "zastolom_"


def audio_filename(item_id: str) -> str:
    return f"{MEDIA_PREFIX}{item_id}.mp3"


def has_audio(item_id: str) -> bool:
    return (AUDIO_SRC / f"{item_id}.mp3").exists()


# Anki separates fields by tab and rows by newline. To keep every note on a
# single row we strip any stray tabs/newlines that might appear inside a field
# value and collapse internal whitespace runs to single spaces.
def clean(value: str) -> str:
    if value is None:
        return ""
    # Normalise newlines and tabs that would otherwise break the row layout.
    value = value.replace("\r\n", " ").replace("\r", " ").replace("\n", " ")
    value = value.replace("\t", " ")
    # Collapse runs of spaces (but preserve the single ellipsis spacing etc.).
    while "  " in value:
        value = value.replace("  ", " ")
    return value.strip()


def build_russian_field(item: dict) -> str:
    """Russian answer side: large render + optional (male form) marker + audio."""
    ru = clean(item["ru"])
    big = f'<div style="font-size:2em">{ru}</div>'
    if item.get("gender") == "m":
        big += '<div style="font-size:0.75em;color:#888">(male form)</div>'
    # Real ElevenLabs audio plays on the answer side via the [sound:] tag.
    if has_audio(item["id"]):
        big += f"[sound:{audio_filename(item['id'])}]"
    return big


def build_note_field(item: dict) -> str:
    parts: list[str] = []
    note = clean(item.get("note", ""))
    if note:
        parts.append(note)
    if item.get("recognize"):
        parts.append("(focus: understand when heard)")
    if item.get("rehearse"):
        parts.append("⚠ rehearse with your wife")
    return " ".join(parts)


def build_tags_field(item: dict) -> str:
    # Anki tags are space-separated; each individual tag must be space-free.
    tags = [clean(item["module"]), f"p{int(item['priority'])}"]
    if item.get("recognize"):
        tags.append("recognize")
    return " ".join(tags)


def build_rows(content: dict) -> list[str]:
    rows: list[str] = []
    for item in content["items"]:
        english = clean(item["en"])
        russian = build_russian_field(item)
        pronunciation = clean(item.get("hint", ""))
        note = build_note_field(item)
        tags = build_tags_field(item)
        rows.append("\t".join([english, russian, pronunciation, note, tags]))
    return rows


HEADER = [
    "#separator:tab",
    "#html:true",
    "#columns:English\tRussian\tPronunciation\tNote\tTags",
]


def main() -> None:
    content = json.loads(CONTENT_PATH.read_text(encoding="utf-8"))
    rows = build_rows(content)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    lines = HEADER + rows
    # Trailing newline after the last row; no blank lines anywhere.
    OUTPUT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")

    # Stage audio for Anki: copy {id}.mp3 -> anki/media/zastolom_{id}.mp3
    copied = 0
    if AUDIO_SRC.is_dir():
        MEDIA_DIR.mkdir(parents=True, exist_ok=True)
        for item in content["items"]:
            src = AUDIO_SRC / f"{item['id']}.mp3"
            if src.exists():
                shutil.copyfile(src, MEDIA_DIR / audio_filename(item["id"]))
                copied += 1

    print(f"Wrote {len(rows)} note rows to {OUTPUT_PATH}")
    print(f"(content.json declares total_items = {content['meta']['total_items']})")
    print(f"Staged {copied} audio files to {MEDIA_DIR}")


if __name__ == "__main__":
    main()
