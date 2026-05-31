#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import unittest
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DECK = ROOT / "anki" / "russian_family_visit_contextual.txt"


class AnkiContextualExportTests(unittest.TestCase):
    def setUp(self) -> None:
        self.content = json.loads(
            (ROOT / "content" / "content.json").read_text(encoding="utf-8")
        )
        self.lines = DECK.read_text(encoding="utf-8").splitlines()
        self.rows = [line.split("\t") for line in self.lines[3:]]

    def test_contextual_deck_has_one_row_per_generated_card(self) -> None:
        expected = sum(
            len(self.content.get(key, []))
            for key in (
                "cloze_cards",
                "dictation_cards",
                "stress_cards",
                "pronunciation_cards",
                "backtranslation_cards",
                "contrast_cards",
                "tutor_cards",
            )
        )
        self.assertEqual(self.lines[:3][0], "#separator:tab")
        self.assertEqual(len(self.rows), expected)
        self.assertTrue(all(len(row) == 7 for row in self.rows))

    def test_contextual_deck_has_expected_card_types_and_source_tags(self) -> None:
        counts = Counter(row[0] for row in self.rows)
        for card_type in (
            "cloze",
            "dictation",
            "stress",
            "pronunciation",
            "backtranslation",
            "contrast",
            "scenario",
        ):
            self.assertGreater(counts[card_type], 0)
        for card_type, source_id, *_rest, tags in self.rows:
            self.assertIn(f"type_{card_type}", tags)
            self.assertIn(f"source_{source_id}", tags)

    def test_contextual_deck_build_is_deterministic(self) -> None:
        before = DECK.read_bytes()
        subprocess.run(
            ["python3", "scripts/build_anki.py"],
            cwd=ROOT,
            check=True,
            stdout=subprocess.DEVNULL,
        )
        self.assertEqual(DECK.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
