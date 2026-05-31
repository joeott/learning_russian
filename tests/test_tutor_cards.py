#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from curriculum import lesson_boundary  # noqa: E402


class TutorCardTests(unittest.TestCase):
    def setUp(self) -> None:
        self.content = json.loads(
            (ROOT / "content" / "content.json").read_text(encoding="utf-8")
        )

    def test_tutor_cards_map_to_scenarios_and_boundaries(self) -> None:
        cards = self.content.get("tutor_cards", [])
        scenarios = {scenario["id"]: scenario for scenario in self.content["scenarios"]}
        self.assertGreaterEqual(len(cards), 3)
        for card in cards:
            scenario = scenarios[card["scenario_id"]]
            boundary = lesson_boundary(self.content, card["lesson_id"])
            self.assertEqual(card["lesson_id"], scenario["lesson_id"])
            self.assertEqual(card["lesson_number"], scenario["lesson_number"])
            self.assertEqual(
                set(card["required_items"]), set(scenario["required_items"])
            )
            self.assertLessEqual(set(card["allowed_item_ids"]), boundary["item_ids"])
            self.assertLessEqual(
                set(card["required_items"]), set(card["allowed_item_ids"])
            )
            self.assertLessEqual(set(card["structures"]), boundary["structures"])

    def test_tutor_prompts_use_verified_phrases_and_correction_policy(self) -> None:
        items = {item["id"]: item for item in self.content["items"]}
        for card in self.content["tutor_cards"]:
            prompt = card["prompt"]
            self.assertIn("Do not introduce Russian outside", prompt)
            self.assertIn("verified phrases", prompt.lower())
            for item_id in card["required_items"]:
                self.assertIn(items[item_id]["ru_plain"], prompt)
            policy = "\n".join(card["correction_policy"])
            for phrase in (
                "Minor error",
                "Repeated error",
                "High-stakes",
                "Communication-breaking",
            ):
                self.assertIn(phrase, policy)


if __name__ == "__main__":
    unittest.main()
