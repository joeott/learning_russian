#!/usr/bin/env python3
from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class BrowserFlowContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.flow = (ROOT / "scripts" / "browser_flow_check.mjs").read_text(
            encoding="utf-8"
        )
        self.cli = (ROOT / "tools" / "zastolom").read_text(encoding="utf-8")

    def test_flow_check_exercises_core_learner_journey(self) -> None:
        for token in (
            "#/home",
            "#/learn",
            "recognition",
            "recall",
            "cloze",
            "dictation",
            "stress",
            "pronounce",
            "backtranslate",
            "contrast",
            "produce",
            "listen",
            "roleplay",
            "localStorage.clear",
            "stageSeen",
            "roleplayCriteriaMissed",
            "AVG RESPONSE TIME",
            'serviceWorkers: "block"',
        ):
            self.assertIn(token, self.flow)

    def test_flow_check_is_exposed_through_zastolom(self) -> None:
        for token in (
            "cmd_flow",
            "browser_flow_check.mjs",
            'sub.add_parser("flow")',
            'elif args.cmd == "flow"',
        ):
            self.assertIn(token, self.cli)


if __name__ == "__main__":
    unittest.main()
