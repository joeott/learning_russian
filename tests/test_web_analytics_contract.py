#!/usr/bin/env python3
from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class WebAnalyticsContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.app = (ROOT / "web" / "app.js").read_text(encoding="utf-8")

    def test_delayed_recall_state_is_tracked_and_rendered(self) -> None:
        for token in (
            "delayed_attempts",
            "delayed_success",
            "delayedRecallRate",
            "delayed recall",
        ):
            self.assertIn(token, self.app)

    def test_delayed_recall_counts_due_unassisted_reviews_only(self) -> None:
        grade_body = re.search(
            r"function gradeItem\(id, ok, stageKey, errorType, opts\) \{(?P<body>.*?)\n  \}",
            self.app,
            re.S,
        )
        self.assertIsNotNone(grade_body)
        body = grade_body.group("body")
        self.assertIn("const wasDelayedReview = (st.seen || 0) > 0 && isDue(st);", body)
        self.assertIn("if (wasDelayedReview)", body)
        self.assertIn("if (ok && !opts.assisted)", body)

    def test_analytics_history_is_local_daily_snapshot(self) -> None:
        for token in (
            ".analytics_history",
            "loadAnalyticsHistory",
            "saveAnalyticsHistory",
            "analyticsSnapshot",
            "Readiness trend",
        ):
            self.assertIn(token, self.app)
        self.assertIn("rows.slice(-14)", self.app)
        self.assertIn("new Date().toISOString().slice(0, 10)", self.app)


if __name__ == "__main__":
    unittest.main()
