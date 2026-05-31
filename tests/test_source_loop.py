#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path
import os
from tempfile import NamedTemporaryFile
import unittest
from importlib.machinery import SourceFileLoader

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

zastolom = SourceFileLoader("zastolom", str(ROOT / "tools" / "zastolom")).load_module()


class SourceMaterialLoopTests(unittest.TestCase):
    def test_extract_title(self) -> None:
        html = "<html><head><title>  Russian \n source  </title></head><body>text</body></html>"
        self.assertEqual(zastolom._extract_title(html), "Russian source")

    def test_extract_visible_text_strips_script_and_style(self) -> None:
        html = """
        <html>
          <body>
            <p>Здравствуйте!</p>
            <script>console.log('nope');</script>
            <style>body {color:red;}</style>
            <p>Как дела?</p>
          </body>
        </html>
        """
        text = zastolom._extract_visible_text(html)
        self.assertEqual(text, "Здравствуйте! Как дела?")

    def test_read_source_targets_fallback(self) -> None:
        fallback = zastolom._read_source_targets("/tmp/does-not-exist-now.json")
        self.assertGreaterEqual(len(fallback), 2)
        self.assertIn("url", fallback[0])

    def test_score_source_text_thresholds(self) -> None:
        short = zastolom._score_source_text("u", "u", "Привет", ["read"])
        self.assertEqual(short["status"], "rejected")

        good = " ".join(["Хороший"] * 80) + " и " + " ".join(["день"] * 10)
        scored = zastolom._score_source_text(
            "u", "u", good, ["read", "dictation", "translate"]
        )
        self.assertIn(scored["status"], {"verified", "needs_check"})

    def test_load_canvas_urls_dedupes_normalized(self) -> None:
        contents = """
        ## Week 2026-05-31
        - Source: [Culture.ru](https://www.culture.ru/)
        - Source: [Culture Mirror](https://www.culture.ru/?utm_source=test)
        - Source: [RT](http://russian.rt.com/)
        - Source: [No URL](notes)
        """
        with NamedTemporaryFile("w", delete=False, encoding="utf-8") as f:
            f.write(contents)
            path = f.name
        try:
            urls = zastolom._load_canvas_urls(path)
            self.assertIn("https://www.culture.ru/", urls)
            self.assertIn("https://www.culture.ru/?utm_source=test", urls)
            self.assertIn("http://russian.rt.com/", urls)
            self.assertNotIn("notes", urls)
        finally:
            os.unlink(path)


if __name__ == "__main__":
    unittest.main()
