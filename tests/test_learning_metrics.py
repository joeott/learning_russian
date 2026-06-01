#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


class LearningMetricsTests(unittest.TestCase):
    def run_node(self, script: str) -> dict:
        result = subprocess.run(
            ["node", "-e", script],
            cwd=ROOT,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
        )
        return json.loads(result.stdout)

    def test_elo_expected_success_and_n_plus_one_bucket(self) -> None:
        out = self.run_node(
            """
            const m = require('./scripts/learning_metrics.cjs');
            const expected = m.expectedSuccess(1500, 1600);
            console.log(JSON.stringify({ expected, bucket: m.bucket(expected) }));
            """
        )
        self.assertGreater(out["expected"], 0.35)
        self.assertLess(out["expected"], 0.45)
        self.assertEqual(out["bucket"], "rescue")

    def test_apply_attempt_updates_structure_and_mission_ratings(self) -> None:
        out = self.run_node(
            """
            const m = require('./scripts/learning_metrics.cjs');
            const ratings = m.emptyRatings();
            const result = m.applyAttempt(ratings, {
              item_id: 'demo001',
              stage_key: 'produce',
              ok: true,
              assisted: false,
              latency_ms: 4200,
              meta: { priority: 1, structures: ['grammar:case_or_inflection'] },
              at: '2026-05-31T12:00:00.000Z'
            });
            console.log(JSON.stringify({
              skillKeys: result.skill_keys.sort(),
              grammar: ratings.skills['structure:grammar:case_or_inflection'].rating,
              mission: ratings.skills['mission:core'].rating,
              difficulty: ratings.items['demo001:produce'].difficulty,
              bucket: result.bucket
            }));
            """
        )
        self.assertIn("structure:grammar:case_or_inflection", out["skillKeys"])
        self.assertIn("mission:core", out["skillKeys"])
        self.assertGreater(out["grammar"], 1500)
        self.assertGreater(out["mission"], 1500)
        self.assertLess(out["difficulty"], 1600)
        self.assertIn(out["bucket"], {"rescue", "n+1", "consolidate", "too_easy"})

    def test_assisted_correct_scores_lower_than_unassisted(self) -> None:
        out = self.run_node(
            """
            const m = require('./scripts/learning_metrics.cjs');
            console.log(JSON.stringify({
              assisted: m.outcomeScore(true, true, 3000, 10000),
              unassisted: m.outcomeScore(true, false, 3000, 10000),
              slow: m.outcomeScore(true, false, 20000, 10000),
              wrong: m.outcomeScore(false, false, 2000, 10000)
            }));
            """
        )
        self.assertLess(out["assisted"], out["unassisted"])
        self.assertLess(out["slow"], out["unassisted"])
        self.assertEqual(out["wrong"], 0)

    def test_metric_snapshot_confidence_uses_zero_as_zero(self) -> None:
        out = self.run_node(
            """
            const m = require('./scripts/learning_metrics.cjs');
            const ratings = m.emptyRatings();
            m.applyAttempt(ratings, {
              item_id: 'demo001',
              stage_key: 'produce',
              ok: true,
              assisted: false,
              latency_ms: 4200,
              meta: { priority: 1, structures: ['speech_act:greeting'] },
              at: '2026-05-31T12:00:00.000Z'
            });
            console.log(JSON.stringify(m.metricSnapshot(ratings)));
            """
        )
        self.assertGreaterEqual(out["confidence"], 0)
        self.assertLessEqual(out["confidence"], 4)

    def test_cefr_calibration_and_recommendation_sorting(self) -> None:
        out = self.run_node(
            """
            const m = require('./scripts/learning_metrics.cjs');
            const band = m.proficiencyBand(1500);
            const calibration = m.calibration({ difficulty: 1710, attempts: 12 });
            const rescue = m.recommendationSortKey({ expected_success: 0.42, lapses: 1, attempts: 3, difficulty: 1700 });
            const growth = m.recommendationSortKey({ expected_success: 0.68, lapses: 0, attempts: 6, difficulty: 1650 });
            console.log(JSON.stringify({
              band,
              calibration,
              challenge: m.challengeScore(0.68),
              rescueFirst: rescue[0] < growth[0],
              labels: m.CEFR_BANDS.map(row => row.level)
            }));
            """
        )
        self.assertEqual(out["band"]["level"], "A1")
        self.assertEqual(out["calibration"]["cefr"], "A2")
        self.assertEqual(out["calibration"]["evidence"], "medium")
        self.assertGreater(out["challenge"], 0.99)
        self.assertTrue(out["rescueFirst"])
        self.assertIn("B1", out["labels"])


if __name__ == "__main__":
    unittest.main()
