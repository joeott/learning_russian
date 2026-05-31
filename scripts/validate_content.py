#!/usr/bin/env python3
"""Validate course content and generated artifacts with stdlib checks."""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

from curriculum import lesson_boundary

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
    "lesson_id",
    "lesson_number",
    "lexemes",
    "structures",
    "prerequisites",
    "allowed_error_types",
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
    curriculum = data.get("curriculum", {})
    lessons = curriculum.get("lessons", [])
    lesson_ids: set[str] = set()
    lesson_numbers: set[int] = set()
    lesson_modules: set[str] = set()
    lesson_by_id: dict[str, dict] = {}
    for lesson in lessons:
        lesson_id = lesson.get("lesson_id")
        lesson_number = lesson.get("lesson_number")
        if not lesson_id:
            fail(errors, "curriculum lesson missing lesson_id")
            continue
        if lesson_id in lesson_ids:
            fail(errors, f"duplicate lesson id: {lesson_id}")
        lesson_ids.add(lesson_id)
        lesson_by_id[lesson_id] = lesson
        if lesson_number in lesson_numbers:
            fail(errors, f"duplicate lesson number: {lesson_number}")
        lesson_numbers.add(lesson_number)
        lesson_modules.add(lesson.get("module", ""))
        if lesson.get("module") not in modules:
            fail(errors, f"lesson {lesson_id}: unknown module {lesson.get('module')}")
        for prereq in lesson.get("prerequisites", []):
            prior = lesson_by_id.get(prereq)
            if not prior:
                fail(errors, f"lesson {lesson_id}: unknown prerequisite {prereq}")
            elif prior.get("lesson_number", 0) >= lesson_number:
                fail(
                    errors, f"lesson {lesson_id}: prerequisite {prereq} is not earlier"
                )
    if lessons and sorted(lesson_numbers) != list(range(1, len(lessons) + 1)):
        fail(errors, "curriculum lesson numbers must be contiguous from 1")
    default_lesson_id = curriculum.get("default_lesson_id")
    if lessons and default_lesson_id not in lesson_ids:
        fail(errors, f"curriculum.default_lesson_id unknown: {default_lesson_id}")
    for module in modules:
        if module and module not in lesson_modules:
            fail(errors, f"module {module}: missing curriculum lesson")

    ids: set[str] = set()
    plain_ru: dict[str, str] = {}
    error_types = {e.get("id") for e in data.get("error_types", [])}
    item_by_id: dict[str, dict] = {}
    for idx, item in enumerate(data.get("items", []), 1):
        missing = REQUIRED_ITEM_FIELDS - item.keys()
        if missing:
            fail(errors, f"item #{idx} missing fields: {sorted(missing)}")
        item_id = item.get("id", "")
        if item_id in ids:
            fail(errors, f"duplicate item id: {item_id}")
        ids.add(item_id)
        item_by_id[item_id] = item
        if item.get("module") not in modules:
            fail(errors, f"{item_id}: unknown module {item.get('module')}")
        lesson = lesson_by_id.get(item.get("lesson_id"))
        if not lesson:
            fail(errors, f"{item_id}: unknown lesson_id {item.get('lesson_id')}")
        elif item.get("lesson_number") != lesson.get("lesson_number"):
            fail(
                errors,
                f"{item_id}: lesson_number does not match {item.get('lesson_id')}",
            )
        elif item.get("module") != lesson.get("module"):
            fail(errors, f"{item_id}: lesson module does not match item module")
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
        for error_type in item.get("allowed_error_types", []):
            if error_type not in error_types:
                fail(errors, f"{item_id}: unknown allowed_error_type {error_type}")
        if set(item.get("error_types", [])) - set(item.get("allowed_error_types", [])):
            fail(errors, f"{item_id}: error_types must be allowed_error_types")
        try:
            boundary = lesson_boundary(data, item.get("lesson_id"))
            locked_structures = set(item.get("structures", [])) - boundary["structures"]
            if locked_structures:
                fail(
                    errors,
                    f"{item_id}: structures outside lesson boundary: {sorted(locked_structures)}",
                )
        except KeyError as exc:
            fail(errors, f"{item_id}: {exc}")

    declared = data.get("meta", {}).get("total_items")
    if declared != len(data.get("items", [])):
        fail(errors, f"meta.total_items {declared} != actual item count")

    cloze_ids: set[str] = set()
    for card in data.get("cloze_cards", []):
        card_id = card.get("id", "")
        if card_id in cloze_ids:
            fail(errors, f"duplicate cloze card id: {card_id}")
        cloze_ids.add(card_id)
        source = item_by_id.get(card.get("item_id"))
        if not source:
            fail(errors, f"{card_id}: unknown source item {card.get('item_id')}")
            continue
        if card.get("lesson_id") != source.get("lesson_id"):
            fail(errors, f"{card_id}: lesson_id does not match source item")
        if card.get("lesson_number") != source.get("lesson_number"):
            fail(errors, f"{card_id}: lesson_number does not match source item")
        if card.get("module") != source.get("module"):
            fail(errors, f"{card_id}: module does not match source item")
        answer = card.get("answer", "")
        if answer not in source.get("ru_plain", ""):
            fail(errors, f"{card_id}: answer is not present in source phrase")
        if "____" not in card.get("prompt_ru", ""):
            fail(errors, f"{card_id}: prompt_ru must contain a blank")
        if card.get("prompt_ru", "").replace("____", answer) != source.get("ru_plain"):
            fail(
                errors,
                f"{card_id}: prompt_ru plus answer must reconstruct source phrase",
            )
        try:
            boundary = lesson_boundary(data, card.get("lesson_id"))
            if source["id"] not in boundary["item_ids"]:
                fail(errors, f"{card_id}: source item outside lesson boundary")
            locked_structures = set(card.get("structures", [])) - boundary["structures"]
            if locked_structures:
                fail(
                    errors,
                    f"{card_id}: structures outside lesson boundary: {sorted(locked_structures)}",
                )
        except KeyError as exc:
            fail(errors, f"{card_id}: {exc}")
        for error_type in card.get("allowed_error_types", []):
            if error_type not in error_types:
                fail(errors, f"{card_id}: unknown allowed_error_type {error_type}")

    for card in data.get("dictation_cards", []):
        card_id = card.get("id", "")
        source = item_by_id.get(card.get("item_id"))
        if not source:
            fail(errors, f"{card_id}: unknown source item {card.get('item_id')}")
            continue
        if card.get("lesson_id") != source.get("lesson_id"):
            fail(errors, f"{card_id}: lesson_id does not match source item")
        if card.get("lesson_number") != source.get("lesson_number"):
            fail(errors, f"{card_id}: lesson_number does not match source item")
        if card.get("module") != source.get("module"):
            fail(errors, f"{card_id}: module does not match source item")
        if source.get("ru_plain") not in card.get("accepted_answers", []):
            fail(errors, f"{card_id}: accepted answers must include source ru_plain")
        if card.get("ru_plain") != source.get("ru_plain"):
            fail(errors, f"{card_id}: ru_plain does not match source item")
        try:
            boundary = lesson_boundary(data, card.get("lesson_id"))
            if source["id"] not in boundary["item_ids"]:
                fail(errors, f"{card_id}: source item outside lesson boundary")
            locked_structures = set(card.get("structures", [])) - boundary["structures"]
            if locked_structures:
                fail(
                    errors,
                    f"{card_id}: structures outside lesson boundary: {sorted(locked_structures)}",
                )
        except KeyError as exc:
            fail(errors, f"{card_id}: {exc}")
        for required_error in ("listening_misparse", "stress", "vowel_reduction"):
            if required_error not in card.get("allowed_error_types", []):
                fail(
                    errors, f"{card_id}: missing dictation error type {required_error}"
                )
        for error_type in card.get("allowed_error_types", []):
            if error_type not in error_types:
                fail(errors, f"{card_id}: unknown allowed_error_type {error_type}")

    for card in data.get("backtranslation_cards", []):
        card_id = card.get("id", "")
        source = item_by_id.get(card.get("item_id"))
        if not source:
            fail(errors, f"{card_id}: unknown source item {card.get('item_id')}")
            continue
        if card.get("lesson_id") != source.get("lesson_id"):
            fail(errors, f"{card_id}: lesson_id does not match source item")
        if card.get("lesson_number") != source.get("lesson_number"):
            fail(errors, f"{card_id}: lesson_number does not match source item")
        if card.get("module") != source.get("module"):
            fail(errors, f"{card_id}: module does not match source item")
        if source.get("ru_plain") not in card.get("accepted_answers", []):
            fail(errors, f"{card_id}: accepted answers must include source ru_plain")
        if card.get("ru_plain") != source.get("ru_plain"):
            fail(errors, f"{card_id}: ru_plain does not match source item")
        try:
            boundary = lesson_boundary(data, card.get("lesson_id"))
            if source["id"] not in boundary["item_ids"]:
                fail(errors, f"{card_id}: source item outside lesson boundary")
            locked_structures = set(card.get("structures", [])) - boundary["structures"]
            if locked_structures:
                fail(
                    errors,
                    f"{card_id}: structures outside lesson boundary: {sorted(locked_structures)}",
                )
        except KeyError as exc:
            fail(errors, f"{card_id}: {exc}")
        for required_error in ("forgot_phrase", "case_or_inflection", "word_order"):
            if required_error not in card.get("allowed_error_types", []):
                fail(
                    errors,
                    f"{card_id}: missing back-translation error type {required_error}",
                )
        for error_type in card.get("allowed_error_types", []):
            if error_type not in error_types:
                fail(errors, f"{card_id}: unknown allowed_error_type {error_type}")

    for scenario in data.get("scenarios", []):
        scenario_lesson_id = scenario.get("lesson_id")
        if scenario_lesson_id and scenario_lesson_id not in lesson_ids:
            fail(
                errors,
                f"scenario {scenario.get('id')}: unknown lesson_id {scenario_lesson_id}",
            )
        scenario_boundary = None
        if scenario_lesson_id:
            try:
                scenario_boundary = lesson_boundary(data, scenario_lesson_id)
            except KeyError as exc:
                fail(errors, f"scenario {scenario.get('id')}: {exc}")
        for item_id in scenario.get("required_items", []):
            if item_id not in ids:
                fail(errors, f"scenario {scenario.get('id')}: unknown item {item_id}")
            elif scenario_boundary and item_id not in scenario_boundary["item_ids"]:
                fail(
                    errors,
                    f"scenario {scenario.get('id')}: item {item_id} outside lesson boundary",
                )
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
    missing_dictation_audio = sorted(
        {
            card["item_id"]
            for card in data.get("dictation_cards", [])
            if card["item_id"] not in audio_ids
        }
    )
    if missing_dictation_audio:
        fail(
            errors,
            f"dictation cards missing audio ids: {', '.join(missing_dictation_audio[:12])}",
        )
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
