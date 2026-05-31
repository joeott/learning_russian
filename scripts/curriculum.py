#!/usr/bin/env python3
"""Curriculum graph helpers for lesson-locked course content."""

from __future__ import annotations


def lesson_by_id(curriculum: dict) -> dict[str, dict]:
    return {lesson["lesson_id"]: lesson for lesson in curriculum.get("lessons", [])}


def lesson_boundary(content: dict, lesson_id: str | None = None) -> dict:
    """Return cumulative lessons/items/vocab/structures unlocked at lesson_id."""
    curriculum = content.get("curriculum", {})
    lessons = sorted(curriculum.get("lessons", []), key=lambda l: l["lesson_number"])
    if not lessons:
        return {
            "lesson_id": "",
            "lesson_number": 0,
            "lesson_ids": set(),
            "item_ids": set(),
            "active_vocab": set(),
            "passive_vocab": set(),
            "structures": set(),
        }

    if lesson_id:
        target_id = lesson_id
    else:
        target_id = curriculum.get("default_lesson_id") or lessons[0]["lesson_id"]
    lessons_by_id = lesson_by_id(curriculum)
    if target_id not in lessons_by_id:
        raise KeyError(f"unknown lesson_id: {target_id}")

    target_number = lessons_by_id[target_id]["lesson_number"]
    unlocked_lessons = [l for l in lessons if l["lesson_number"] <= target_number]
    lesson_ids = {l["lesson_id"] for l in unlocked_lessons}
    item_ids = {
        i["id"] for i in content.get("items", []) if i.get("lesson_id") in lesson_ids
    }
    active_vocab = set().union(
        *(set(l.get("active_vocab", [])) for l in unlocked_lessons)
    )
    passive_vocab = set().union(
        *(set(l.get("passive_vocab", [])) for l in unlocked_lessons)
    )
    structures = set().union(
        *(set(l.get("introduced_structures", [])) for l in unlocked_lessons)
    )

    return {
        "lesson_id": target_id,
        "lesson_number": target_number,
        "lesson_ids": lesson_ids,
        "item_ids": item_ids,
        "active_vocab": active_vocab,
        "passive_vocab": passive_vocab,
        "structures": structures,
    }
