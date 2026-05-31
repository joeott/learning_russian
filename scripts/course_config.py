#!/usr/bin/env python3
"""Course metadata helpers.

The project intentionally stays stdlib-only, so this reads the small YAML
subset used by courses/*/course.yaml instead of requiring PyYAML.
"""

from __future__ import annotations

import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_COURSE_ID = "russian_family_visit"

DEFAULT_COURSE = {
    "course_id": DEFAULT_COURSE_ID,
    "title": "Russian for Kadriya's Family",
    "target_language": "ru",
    "learner_language": "en",
    "script": "cyrillic",
    "storage_namespace": "zastolom.russian_family_visit.v2",
    "mission": {
        "scenario": "family dinner",
        "target_date": "2026-06-15",
        "performance_goal": "survive and participate politely at the table",
    },
    "learner_profile": {
        "known_languages": ["en"],
        "pain_points": ["stress", "listening speed", "gendered forms"],
    },
    "outputs": {
        "web": True,
        "anki": True,
        "cheat_sheet": True,
        "tutor_protocol": True,
    },
    "audio": {
        "model": "eleven_multilingual_v2",
        "format": "mp3_44100_128",
        "preferred_voice": "ScaQ3utur72x93jqMMeU",
        "preferred_voice_name": "Elena (Warm, Calm & Clear)",
    },
    "curriculum": {
        "default_lesson_id": "family_visit_008",
    },
}


def _parse_scalar(value: str):
    value = value.strip()
    if value in {"true", "false"}:
        return value == "true"
    if value.startswith("[") and value.endswith("]"):
        return ast.literal_eval(value)
    if (value.startswith('"') and value.endswith('"')) or (
        value.startswith("'") and value.endswith("'")
    ):
        return ast.literal_eval(value)
    return value


def _read_simple_yaml(path: Path) -> dict:
    root: dict = {}
    stack: list[tuple[int, dict]] = [(-1, root)]
    for raw in path.read_text(encoding="utf-8").splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        indent = len(raw) - len(raw.lstrip(" "))
        line = raw.strip()
        if ":" not in line:
            raise ValueError(f"unsupported YAML line in {path}: {raw!r}")
        key, value = line.split(":", 1)
        while stack and indent <= stack[-1][0]:
            stack.pop()
        parent = stack[-1][1]
        if value.strip():
            parent[key] = _parse_scalar(value)
        else:
            child: dict = {}
            parent[key] = child
            stack.append((indent, child))
    return root


def _deep_merge(base: dict, override: dict) -> dict:
    merged = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def load_course(course_id: str = DEFAULT_COURSE_ID) -> dict:
    path = ROOT / "courses" / course_id / "course.yaml"
    if not path.exists():
        if course_id == DEFAULT_COURSE_ID:
            return dict(DEFAULT_COURSE)
        raise FileNotFoundError(path)
    course = _deep_merge(DEFAULT_COURSE, _read_simple_yaml(path))
    course["course_id"] = course_id
    return course
