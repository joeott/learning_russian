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
            "averageResponseMs",
        ):
            self.assertIn(token, self.app)
        self.assertIn("rows.slice(-14)", self.app)
        self.assertIn("new Date().toISOString().slice(0, 10)", self.app)

    def test_response_latency_is_recorded_per_stage(self) -> None:
        for token in (
            "questionStartedAt",
            "last_latency_ms",
            "latency_ms_total",
            "latency_count",
            "avg response time",
            "formatLatency",
        ):
            self.assertIn(token, self.app)
        self.assertIn("Math.min(300000", self.app)

    def test_wrong_answers_show_targeted_repair_focus(self) -> None:
        for token in (
            "inferredErrorType",
            "repairFocusHtml",
            "Repair focus:",
            "last_repair_focus",
            "repair_focus_counts",
            "repairFocusSummary",
            "repairProfileHtml",
            "Repair profile",
            "ERROR_BY_ID",
            "case_or_inflection",
            "gendered_form",
            "listening_misparse",
        ):
            self.assertIn(token, self.app)

    def test_roleplay_failure_signals_surface_repair_drills(self) -> None:
        for token in (
            "roleplayFailureSignals",
            "roleplaySignalsHtml",
            "Role-play failure signals",
            "last_roleplay_missed",
            "roleplay_criteria_misses",
            "ROLEPLAY_CRITERIA",
            "ZS.startRepair",
        ):
            self.assertIn(token, self.app)
        self.assertIn("historical ? historical[criterionId] : 1", self.app)
        self.assertIn(".slice(0, 4)", self.app)

    def test_adaptive_elo_metrics_are_visible_and_synced(self) -> None:
        for token in (
            ".adaptive_ratings",
            "applyAdaptiveAttempt",
            "adaptiveStats",
            "adaptiveRecommendations",
            ".analysis_state",
            "runAnalysisCycle",
            "startAnalysisEngine",
            "Analysis engine active",
            "Runs every 45 seconds",
            "target_band",
            "Adaptive progress model",
            "mission ability",
            "grammar control",
            "missionCefr",
            "grammarCefr",
            "CEFR/ACTFL labels are internal estimates",
            "evidence-weighted n+1 fit",
            "challengeScore",
            "recommendationSortKey",
            "n+1 fit",
            "friction index",
            "expected_success",
            "item_meta",
            "ZS.startAdaptive",
        ):
            self.assertIn(token, self.app)


if __name__ == "__main__":
    unittest.main()
