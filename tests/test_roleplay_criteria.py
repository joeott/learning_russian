#!/usr/bin/env python3
from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class RoleplayCriteriaTests(unittest.TestCase):
    def setUp(self) -> None:
        self.content = json.loads(
            (ROOT / "content" / "content.json").read_text(encoding="utf-8")
        )

    def test_scenario_success_criteria_have_labels_and_error_repairs(self) -> None:
        criteria = self.content.get("roleplay_criteria", {})
        error_types = {error["id"] for error in self.content["error_types"]}
        self.assertGreaterEqual(len(criteria), 8)
        for scenario in self.content["scenarios"]:
            self.assertGreater(len(scenario["success_criteria"]), 0)
            for criterion_id in scenario["success_criteria"]:
                self.assertIn(criterion_id, criteria)
                self.assertIn(criteria[criterion_id]["error_type"], error_types)
                self.assertTrue(criteria[criterion_id]["label"])


if __name__ == "__main__":
    unittest.main()
