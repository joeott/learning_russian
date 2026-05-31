#!/usr/bin/env python3
"""Validate course content and generated artifacts with stdlib checks."""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ACUTE = "\u0301"
REQUIRED_ITEM_FIELDS = {
    "id",
    "module",
    "ru",
    "ru_plain",
    "en",
    "priority",
    "syllables",
    "conf",
    "tags",
}


def strip_stress(value: str) -> str:
    return unicodedata.normalize("NFC", value).replace(ACUTE, "")


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def load_content() -> dict:
    return json.loads((ROOT / "content" / "content.json").read_text(encoding="utf-8"))


def validate_content(data: dict) -> list[str]:
    errors: list[str] = []
    if "course" not in data:
        fail(errors, "missing course metadata")
    course = data.get("course", {})
    if not course.get("course_id"):
        fail(errors, "course.course_id is required")
    if not course.get("mission", {}).get("target_date"):
        fail(errors, "course.mission.target_date is required")

    modules = {m.get("id") for m in data.get("modules", [])}
    ids: set[str] = set()
    plain_ru: dict[str, str] = {}
    for idx, item in enumerate(data.get("items", []), 1):
        missing = REQUIRED_ITEM_FIELDS - item.keys()
        if missing:
            fail(errors, f"item #{idx} missing fields: {sorted(missing)}")
        item_id = item.get("id", "")
        if item_id in ids:
            fail(errors, f"duplicate item id: {item_id}")
        ids.add(item_id)
        if item.get("module") not in modules:
            fail(errors, f"{item_id}: unknown module {item.get('module')}")
        if item.get("ru_plain") != strip_stress(item.get("ru", "")):
            fail(errors, f"{item_id}: ru_plain does not match stress-stripped ru")
        plain = item.get("ru_plain", "")
        if plain in plain_ru:
            fail(
                errors,
                f"{item_id}: duplicate Russian plain text with {plain_ru[plain]}",
            )
        plain_ru[plain] = item_id
        if item.get("priority") not in {1, 2, 3}:
            fail(errors, f"{item_id}: priority must be 1, 2, or 3")
        if item.get("conf") not in {"high", "med", "low"}:
            fail(errors, f"{item_id}: conf must be high/med/low")
        if item.get("rehearse") and not item.get("note") and item.get("conf") == "high":
            fail(
                errors,
                f"{item_id}: rehearse item should explain why in note or lower conf",
            )

    declared = data.get("meta", {}).get("total_items")
    if declared != len(data.get("items", [])):
        fail(errors, f"meta.total_items {declared} != actual item count")

    error_types = {e.get("id") for e in data.get("error_types", [])}
    for scenario in data.get("scenarios", []):
        for item_id in scenario.get("required_items", []):
            if item_id not in ids:
                fail(errors, f"scenario {scenario.get('id')}: unknown item {item_id}")
    for contrast in data.get("contrast_sets", []):
        if contrast.get("risk") == "high" and not contrast.get("usage_note"):
            fail(errors, f"contrast {contrast.get('id')}: high risk needs usage_note")
        for item_id in contrast.get("items", []):
            if item_id not in ids:
                fail(errors, f"contrast {contrast.get('id')}: unknown item {item_id}")
    for item in data.get("items", []):
        for error_type in item.get("error_types", []):
            if error_type not in error_types:
                fail(errors, f"{item.get('id')}: unknown error_type {error_type}")
    return errors


def validate_generated(data: dict) -> list[str]:
    errors: list[str] = []
    content_js = (ROOT / "web" / "content.js").read_text(encoding="utf-8")
    if "window.CONTENT_DATA = " not in content_js:
        fail(errors, "web/content.js missing CONTENT_DATA assignment")
    audio_js = (ROOT / "web" / "audio.js").read_text(encoding="utf-8")
    audio_ids = set(re.findall(r'"([a-z]{4}\d{3})"', audio_js))
    item_ids = {item["id"] for item in data["items"]}
    missing_audio = sorted(item_ids - audio_ids)
    if missing_audio:
        fail(errors, f"audio manifest missing ids: {', '.join(missing_audio[:12])}")
    anki_rows = (
        (ROOT / "anki" / "russian_family_visit.txt")
        .read_text(encoding="utf-8")
        .splitlines()
    )
    data_rows = max(0, len(anki_rows) - 3)
    if data_rows != len(data["items"]):
        fail(errors, f"anki rows {data_rows} != items {len(data['items'])}")
    service_worker = (ROOT / "web" / "service-worker.js").read_text(encoding="utf-8")
    for asset in ("./index.html", "./styles.css", "./app.js", "./content.js"):
        if asset not in service_worker:
            fail(errors, f"service worker shell missing {asset}")
    return errors


def main() -> int:
    data = load_content()
    errors = validate_content(data) + validate_generated(data)
    if errors:
        print("validate_content: FAILED")
        for error in errors:
            print(f"  - {error}")
        return 1
    print(f"validate_content: OK — {len(data['items'])} items")
    return 0


if __name__ == "__main__":
    sys.exit(main())
