#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import validate_content  # noqa: E402


class ContentIntegrityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.content = json.loads(
            (ROOT / "content" / "content.json").read_text(encoding="utf-8")
        )

    def test_content_validation(self) -> None:
        self.assertEqual(validate_content.validate_content(self.content), [])

    def test_generated_validation(self) -> None:
        self.assertEqual(validate_content.validate_generated(self.content), [])

    def test_web_javascript_syntax(self) -> None:
        for path in (ROOT / "web" / "app.js", ROOT / "web" / "service-worker.js"):
            with self.subTest(path=path):
                result = subprocess.run(
                    ["node", "--check", str(path)],
                    capture_output=True,
                    text=True,
                    check=False,
                )
                self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
