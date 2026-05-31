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

    def test_read_source_targets_spoken_filter(self) -> None:
        with NamedTemporaryFile("w", delete=False, encoding="utf-8") as f:
            f.write(
                """
                {
                  "targets": [
                    {"url": "https://spoken.example.org", "name": "spoken", "default_drill": ["dictation"], "spoken": true},
                    {"url": "https://read.example.org", "name": "read", "default_drill": ["read"], "focus": ["reading"]}
                  ]
                }
                """
            )
            path = f.name
        try:
            only_spoken = zastolom._read_source_targets(path, spoken=True)
            self.assertEqual(len(only_spoken), 1)
            self.assertEqual(only_spoken[0]["url"], "https://spoken.example.org")
            fallback = zastolom._read_source_targets(path, spoken=False)
            self.assertEqual(len(fallback), 2)
        finally:
            os.unlink(path)

    def test_score_source_text_thresholds(self) -> None:
        short = zastolom._score_source_text("u", "u", "Привет", ["read"])
        self.assertEqual(short["status"], "rejected")

        good = " ".join(["Хороший"] * 80) + " и " + " ".join(["день"] * 10)
        scored = zastolom._score_source_text(
            "u", "u", good, ["read", "dictation", "translate"]
        )
        self.assertIn(scored["status"], {"verified", "needs_check"})

    def test_easy_candidate_requires_verified_short_cyrillic_source(self) -> None:
        easy = {
            "status": "verified",
            "scores": {"word_count": 80, "cyrillic_ratio": 0.9},
            "notes": [],
        }
        self.assertTrue(zastolom._is_easy_candidate(easy))

        too_long = {
            **easy,
            "scores": {"word_count": 500, "cyrillic_ratio": 0.9},
            "notes": ["too long to fit fast drill pass"],
        }
        self.assertFalse(zastolom._is_easy_candidate(too_long))

        needs_check = {**easy, "status": "needs_check"}
        self.assertFalse(zastolom._is_easy_candidate(needs_check))

        low_cyrillic = {
            **easy,
            "scores": {"word_count": 80, "cyrillic_ratio": 0.2},
        }
        self.assertFalse(zastolom._is_easy_candidate(low_cyrillic))

    def test_source_loop_candidates_easy_prefers_short_verified_then_falls_back(
        self,
    ) -> None:
        easy = {
            "url": "easy",
            "status": "verified",
            "scores": {"word_count": 80, "cyrillic_ratio": 0.9},
            "notes": [],
        }
        long = {
            "url": "long",
            "status": "verified",
            "scores": {"word_count": 500, "cyrillic_ratio": 0.9},
            "notes": ["too long to fit fast drill pass"],
        }
        needs_check = {
            "url": "needs-check",
            "status": "needs_check",
            "scores": {"word_count": 80, "cyrillic_ratio": 0.9},
            "notes": [],
        }

        preferred = zastolom._source_loop_candidates(
            [long, needs_check, easy], easy=True
        )
        self.assertEqual([r["url"] for r in preferred], ["easy"])

        fallback = zastolom._source_loop_candidates([long, needs_check], easy=True)
        self.assertEqual([r["url"] for r in fallback], ["long", "needs-check"])

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
            self.assertIn("http://russian.rt.com/", urls)
            self.assertNotIn("https://www.culture.ru/?utm_source=test", urls)
            self.assertNotIn("notes", urls)
        finally:
            os.unlink(path)

    def test_discover_source_links_filters_and_normalizes(self) -> None:
        html = """
        <a href="/news">Новости</a>
        <a href="/news/politics">Политика</a>
        <a href="/news?x=1">Новости с query</a>
        <a href="/world">Мир</a>
        <a href="/search?q=1">Нельзя</a>
        <a href="https://example.com/offsite">Внешний источник</a>
        <a href="/media/file.mp4">Медиа</a>
        <a href="/news">Дубликат</a>
        """
        target = {"discover_limit": 4, "discover_paths": ["/news", "/world"]}
        links = zastolom._discover_source_links("https://russian.rt.com", html, target)
        self.assertEqual(len(links), 3)
        self.assertIn("https://russian.rt.com/news", links)
        self.assertIn("https://russian.rt.com/news/politics", links)
        self.assertIn("https://russian.rt.com/world", links)
        self.assertNotIn("https://russian.rt.com/search", links)
        self.assertNotIn("https://russian.rt.com/media/file.mp4", links)


if __name__ == "__main__":
    unittest.main()
