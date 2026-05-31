#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class PronunciationCardTests(unittest.TestCase):
    def setUp(self) -> None:
        self.content = json.loads(
            (ROOT / "content" / "content.json").read_text(encoding="utf-8")
        )
        audio_js = (ROOT / "web" / "audio.js").read_text(encoding="utf-8")
        self.audio_ids = set(re.findall(r'"([a-z]{4}\d{3})"', audio_js))

    def test_pronunciation_cards_use_audio_backed_verified_items(self) -> None:
        items = {item["id"]: item for item in self.content["items"]}
        cards = self.content.get("pronunciation_cards", [])
        self.assertGreater(len(cards), 80)
        for card in cards:
            source = items[card["item_id"]]
            self.assertIn(card["item_id"], self.audio_ids)
            self.assertEqual(card["ru"], source["ru"])
            self.assertEqual(card["ru_plain"], source["ru_plain"])
            self.assertEqual(card["lesson_id"], source["lesson_id"])

    def test_pronunciation_cards_have_complete_local_workflow(self) -> None:
        expected_steps = {
            "listen_native",
            "record_self",
            "playback_compare",
            "self_rate",
        }
        for card in self.content["pronunciation_cards"]:
            self.assertEqual(set(card["practice_steps"]), expected_steps)
            self.assertTrue(
                {"stress", "vowel_reduction"} <= set(card["feedback_targets"])
            )
            self.assertTrue(
                {"stress", "vowel_reduction", "forgot_phrase"}
                <= set(card["allowed_error_types"])
            )


if __name__ == "__main__":
    unittest.main()
