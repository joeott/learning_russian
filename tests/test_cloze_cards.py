#!/usr/bin/env python3
from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class ClozeCardTests(unittest.TestCase):
    def setUp(self) -> None:
        self.content = json.loads(
            (ROOT / "content" / "content.json").read_text(encoding="utf-8")
        )

    def test_cloze_cards_are_generated_from_verified_items(self) -> None:
        items = {item["id"]: item for item in self.content["items"]}
        self.assertGreater(len(self.content.get("cloze_cards", [])), 50)
        for card in self.content["cloze_cards"]:
            source = items[card["item_id"]]
            self.assertEqual(
                card["prompt_ru"].replace("____", card["answer"]), source["ru_plain"]
            )
            self.assertEqual(card["lesson_id"], source["lesson_id"])
            self.assertIn(card["answer"], source["ru_plain"])

    def test_lesson_one_has_only_first_contact_cloze_cards(self) -> None:
        lesson_one = [
            card
            for card in self.content["cloze_cards"]
            if card["lesson_id"] == "family_visit_001"
        ]
        self.assertGreaterEqual(len(lesson_one), 8)
        self.assertEqual({card["module"] for card in lesson_one}, {"first_contact"})


if __name__ == "__main__":
    unittest.main()
