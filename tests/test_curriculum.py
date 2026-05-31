#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from curriculum import lesson_boundary  # noqa: E402


class CurriculumBoundaryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.content = json.loads(
            (ROOT / "content" / "content.json").read_text(encoding="utf-8")
        )

    def test_lesson_one_unlocks_first_contact_only(self) -> None:
        boundary = lesson_boundary(self.content, "family_visit_001")
        modules = {
            item["module"]
            for item in self.content["items"]
            if item["id"] in boundary["item_ids"]
        }
        self.assertEqual(modules, {"first_contact"})
        self.assertEqual(len(boundary["item_ids"]), 13)
        self.assertIn("phrase:greeting", boundary["structures"])

    def test_default_lesson_unlocks_first_lesson_only(self) -> None:
        boundary = lesson_boundary(self.content)
        first_lesson = self.content["curriculum"]["lessons"][0]["lesson_id"]
        self.assertEqual(
            boundary["lesson_id"], self.content["curriculum"]["default_lesson_id"]
        )
        self.assertEqual(boundary["lesson_id"], first_lesson)
        self.assertEqual(len(boundary["item_ids"]), 13)

    def test_boundaries_are_cumulative(self) -> None:
        lesson_two = lesson_boundary(self.content, "family_visit_002")
        lesson_one = lesson_boundary(self.content, "family_visit_001")
        self.assertTrue(lesson_one["item_ids"] < lesson_two["item_ids"])
        self.assertTrue(lesson_one["structures"] <= lesson_two["structures"])
        self.assertIn("phrase:repair", lesson_two["structures"])

    def test_lessons_carry_prerequisites_and_bound_vocab(self) -> None:
        curriculum = self.content["curriculum"]
        lessons = curriculum.get("lessons", [])
        self.assertTrue(len(lessons) > 0)
        unlocked = set()
        for lesson in lessons:
            lesson_id = lesson["lesson_id"]
            lesson_num = lesson["lesson_number"]
            self.assertIsInstance(lesson.get("introduced_lexemes"), list)
            self.assertIsInstance(lesson.get("active_vocab"), list)
            self.assertIsInstance(lesson.get("passive_vocab"), list)
            self.assertIsInstance(lesson.get("introduced_structures"), list)
            self.assertIsInstance(lesson.get("prerequisites"), list)
            for prerequisite_id in lesson.get("prerequisites", []):
                self.assertIn(
                    prerequisite_id,
                    unlocked,
                    f"{lesson_id} prerequisite {prerequisite_id} not unlocked yet",
                )
            self.assertGreaterEqual(lesson_num, 1)
            unlocked.add(lesson_id)

    def test_item_lexemes_respect_curriculum_vocab(self) -> None:
        items = {item["id"]: item for item in self.content["items"]}
        for lesson in self.content["curriculum"]["lessons"]:
            boundary = lesson_boundary(self.content, lesson["lesson_id"])
            for item_id in boundary["item_ids"]:
                item = items[item_id]
                allowed_vocab = boundary["active_vocab"] | boundary["passive_vocab"]
                self.assertTrue(
                    set(item.get("lexemes", [])).issubset(allowed_vocab),
                    f"{item_id} has lexemes outside active/passive vocab at {lesson['lesson_id']}",
                )


if __name__ == "__main__":
    unittest.main()
