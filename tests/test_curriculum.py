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

    def test_default_lesson_unlocks_all_items(self) -> None:
        boundary = lesson_boundary(self.content)
        self.assertEqual(len(boundary["item_ids"]), len(self.content["items"]))
        self.assertEqual(
            boundary["lesson_id"], self.content["curriculum"]["default_lesson_id"]
        )

    def test_boundaries_are_cumulative(self) -> None:
        lesson_two = lesson_boundary(self.content, "family_visit_002")
        lesson_one = lesson_boundary(self.content, "family_visit_001")
        self.assertTrue(lesson_one["item_ids"] < lesson_two["item_ids"])
        self.assertTrue(lesson_one["structures"] <= lesson_two["structures"])
        self.assertIn("phrase:repair", lesson_two["structures"])


if __name__ == "__main__":
    unittest.main()
