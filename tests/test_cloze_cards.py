#!/usr/bin/env python3
from __future__ import annotations

import json
import re
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

    def test_cloze_cards_include_stress_variant_when_available(self) -> None:
        strip = lambda value: value.replace("\u0301", "")
        cards_with_accent = 0
        cards_checked = 0
        for card in self.content["cloze_cards"]:
            source = next(
                item for item in self.content["items"] if item["id"] == card["item_id"]
            )
            self.assertTrue(
                card.get("accepted_answers"), f"{card['id']} missing accepted_answers"
            )
            source_tokens = re.findall(r"[А-Яа-яЁё́]+", source["ru"])
            source_token = next(
                (
                    token
                    for token in source_tokens
                    if strip(token) == strip(card["answer"])
                ),
                "",
            )
            if source_token:
                cards_checked += 1
            if "́" in source["ru"]:
                if "́" in source_token:
                    self.assertGreaterEqual(
                        len(set(card["accepted_answers"])),
                        2,
                        f"{card['id']} expected >1 accepted answers when answer token is stressed in source",
                    )
                self.assertIn(card["answer"], card["accepted_answers"])
                cards_with_accent += 1
        self.assertGreater(cards_with_accent, 0)
        self.assertGreater(cards_checked, 0)


if __name__ == "__main__":
    unittest.main()
