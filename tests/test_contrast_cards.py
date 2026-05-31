#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from curriculum import lesson_boundary  # noqa: E402


class ContrastCardTests(unittest.TestCase):
    def setUp(self) -> None:
        self.content = json.loads(
            (ROOT / "content" / "content.json").read_text(encoding="utf-8")
        )

    def test_contrast_cards_map_to_high_risk_sets(self) -> None:
        cards = self.content.get("contrast_cards", [])
        contrast_sets = {c["id"]: c for c in self.content["contrast_sets"]}
        self.assertGreaterEqual(len(cards), 6)
        for card in cards:
            contrast = contrast_sets[card["contrast_set_id"]]
            self.assertIn(card["item_id"], contrast["items"])
            self.assertEqual(card["answer_id"], card["item_id"])
            self.assertEqual({o["id"] for o in card["options"]}, set(contrast["items"]))
            self.assertEqual(card["usage_note"], contrast["usage_note"])
            self.assertIn("cultural_usage", card["allowed_error_types"])

    def test_contrast_cards_respect_lesson_boundaries(self) -> None:
        for card in self.content["contrast_cards"]:
            boundary = lesson_boundary(self.content, card["lesson_id"])
            self.assertIn(card["item_id"], boundary["item_ids"])
            self.assertLessEqual(set(card["structures"]), boundary["structures"])


if __name__ == "__main__":
    unittest.main()
