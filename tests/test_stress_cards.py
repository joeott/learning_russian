#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from curriculum import lesson_boundary  # noqa: E402
from validate_content import strip_stress  # noqa: E402


class StressCardTests(unittest.TestCase):
    def setUp(self) -> None:
        self.content = json.loads(
            (ROOT / "content" / "content.json").read_text(encoding="utf-8")
        )

    def test_stress_cards_preserve_verified_phrase_text(self) -> None:
        items = {item["id"]: item for item in self.content["items"]}
        cards = self.content.get("stress_cards", [])
        self.assertGreater(len(cards), 80)
        for card in cards:
            source = items[card["item_id"]]
            self.assertEqual(card["ru_plain"], source["ru_plain"])
            self.assertEqual(card["answer"], source["ru"])
            self.assertIn(card["answer"], card["options"])
            self.assertGreaterEqual(len(card["options"]), 2)
            for option in card["options"]:
                self.assertEqual(strip_stress(option), source["ru_plain"])

    def test_stress_cards_respect_lesson_boundaries_and_error_taxonomy(self) -> None:
        for card in self.content["stress_cards"]:
            boundary = lesson_boundary(self.content, card["lesson_id"])
            self.assertIn(card["item_id"], boundary["item_ids"])
            self.assertLessEqual(set(card["structures"]), boundary["structures"])
            self.assertIn("stress", card["allowed_error_types"])


if __name__ == "__main__":
    unittest.main()
