#!/usr/bin/env python3
from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class BackTranslationCardTests(unittest.TestCase):
    def setUp(self) -> None:
        self.content = json.loads(
            (ROOT / "content" / "content.json").read_text(encoding="utf-8")
        )

    def test_backtranslation_cards_map_to_verified_items(self) -> None:
        items = {item["id"]: item for item in self.content["items"]}
        cards = self.content.get("backtranslation_cards", [])
        self.assertGreater(len(cards), 80)
        for card in cards:
            source = items[card["item_id"]]
            self.assertEqual(card["ru"], source["ru"])
            self.assertEqual(card["ru_plain"], source["ru_plain"])
            self.assertIn(source["ru_plain"], card["accepted_answers"])
            self.assertEqual(card["lesson_id"], source["lesson_id"])

    def test_backtranslation_cards_include_production_error_repairs(self) -> None:
        required = {"forgot_phrase", "case_or_inflection", "word_order"}
        for card in self.content["backtranslation_cards"]:
            self.assertTrue(required <= set(card["allowed_error_types"]))


if __name__ == "__main__":
    unittest.main()
