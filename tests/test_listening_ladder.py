#!/usr/bin/env python3
from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class ListeningLadderTests(unittest.TestCase):
    def setUp(self) -> None:
        self.content = json.loads(
            (ROOT / "content" / "content.json").read_text(encoding="utf-8")
        )

    def test_listening_ladder_defines_fading_caption_and_speed_steps(self) -> None:
        ladder = self.content.get("listening_ladder", [])
        by_id = {step["id"]: step for step in ladder}
        self.assertEqual(
            set(by_id),
            {
                "no_text",
                "first_letter",
                "cloze",
                "full_caption",
                "slow_audio",
                "table_speed",
            },
        )
        self.assertEqual(by_id["no_text"]["assistance"], 0)
        self.assertEqual(by_id["table_speed"]["assistance"], 0)
        self.assertGreater(
            by_id["full_caption"]["assistance"], by_id["first_letter"]["assistance"]
        )
        self.assertGreater(
            by_id["slow_audio"]["assistance"], by_id["table_speed"]["assistance"]
        )


if __name__ == "__main__":
    unittest.main()
