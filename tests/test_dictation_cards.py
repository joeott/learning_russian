#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class DictationCardTests(unittest.TestCase):
    def setUp(self) -> None:
        self.content = json.loads(
            (ROOT / "content" / "content.json").read_text(encoding="utf-8")
        )
        audio_js = (ROOT / "web" / "audio.js").read_text(encoding="utf-8")
        self.audio_ids = set(re.findall(r'"([a-z]{4}\d{3})"', audio_js))

    def test_dictation_cards_map_to_audio_backed_items(self) -> None:
        items = {item["id"]: item for item in self.content["items"]}
        cards = self.content.get("dictation_cards", [])
        self.assertGreater(len(cards), 80)
        for card in cards:
            source = items[card["item_id"]]
            self.assertIn(card["item_id"], self.audio_ids)
            self.assertEqual(card["ru_plain"], source["ru_plain"])
            self.assertIn(source["ru_plain"], card["accepted_answers"])
            self.assertEqual(card["lesson_id"], source["lesson_id"])

    def test_dictation_cards_include_listening_error_repairs(self) -> None:
        required = {"listening_misparse", "stress", "vowel_reduction"}
        for card in self.content["dictation_cards"]:
            self.assertTrue(required <= set(card["allowed_error_types"]))


if __name__ == "__main__":
    unittest.main()
