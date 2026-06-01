#!/usr/bin/env python3
from __future__ import annotations

import unittest
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class SpeechEvalContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.app = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
        self.server = (ROOT / "scripts" / "sync_server.mjs").read_text(encoding="utf-8")
        self.secrets = (ROOT / "scripts" / "secrets.mjs").read_text(encoding="utf-8")
        self.speech_eval = (ROOT / "scripts" / "speech_eval.mjs").read_text(
            encoding="utf-8"
        )
        self.transcription = (ROOT / "scripts" / "speech_transcription.mjs").read_text(
            encoding="utf-8"
        )
        self.cli = (ROOT / "tools" / "zastolom").read_text(encoding="utf-8")

    def test_server_exposes_speech_evaluation_endpoint(self) -> None:
        for token in (
            '"/api/speech/evaluate"',
            "speechEvaluate",
            "compareSpeech",
            "transcribeRussianAudio",
            "audio_base64",
            "target_ru_plain",
            "provider",
            "stage_key",
        ):
            self.assertIn(token, self.server)

    def test_openai_key_comes_from_aws_secrets_manager(self) -> None:
        for token in (
            "ZASTOLOM_API_KEYS_SECRET_ID",
            "/zastolom/dev/api-keys",
            "aws",
            "secretsmanager",
            "get-secret-value",
            "OPENAI_API_KEY",
            "runtimeSecret",
        ):
            self.assertIn(token, self.secrets + self.transcription)

    def test_cli_can_persist_keys_without_printing_values(self) -> None:
        for token in (
            "cmd_secrets",
            'sub.add_parser("secrets")',
            'secsub.add_parser("put")',
            "put-secret-value",
            "create-secret",
            "[redacted]",
            "ELEVENLABS_API_KEY",
            "OPENAI_API_KEY",
        ):
            self.assertIn(token, self.cli)

    def test_client_records_transcribes_and_persists_derived_metrics_only(self) -> None:
        for token in (
            "analyzePronunciation",
            "analyzeLearnSpeech",
            "analyzeTypedSpeech",
            "startTypedSpeech",
            "typedSpeechControlsHtml",
            "gradeTypedSpeech",
            "acceptedAnswersForTypedStage",
            "speechEvalHtml",
            "blobToBase64",
            "browserRecognizeRussian",
            "speech_eval",
            "last_speech_transcript",
            "last_speech_score",
            "speech_eval_count",
            "audio_base64",
        ):
            self.assertIn(token, self.app)
        self.assertNotIn('localStorage.setItem("audio_base64', self.app)

    def test_all_russian_text_entry_stages_have_speech_controls(self) -> None:
        for token in (
            '${typedSpeechControlsHtml(it.id, "clozeIn")}',
            '${typedSpeechControlsHtml(it.id, "conjIn")}',
            '${typedSpeechControlsHtml(it.id, "dictIn")}',
            '${typedSpeechControlsHtml(it.id, "btRu")}',
            '${typedSpeechControlsHtml(it.id, "prodIn")}',
            "Speak answer",
            "say only the Russian answer",
        ):
            self.assertIn(token, self.app)

    def test_close_russian_guesses_are_distinct_from_full_misses(self) -> None:
        for token in (
            "typedAnswerAssessment",
            "answerSimilarity",
            "nearTokenMatch(userTokens, answerTokens)",
            "closeGuessErrorType",
            "closeGuessHint",
            "≈ Close guess",
            "close_guess",
            'last_grade = "close"',
            ".feedback.close",
        ):
            self.assertIn(
                token,
                self.app + (ROOT / "web" / "styles.css").read_text(encoding="utf-8"),
            )

    def test_advancement_guidance_is_oral_first_not_typing_first(self) -> None:
        for token in (
            "oralAdvancementPlan",
            "oralAdvancementHtml",
            "speechAnswerStats",
            "Prioritize oral readiness",
            "Typing is just a fallback",
            "speech checks",
            "role-play",
            "pronunciation",
            "listening",
        ):
            self.assertIn(token, self.app)

    def test_general_flip_review_exists_without_typing(self) -> None:
        index = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        for token in (
            "#/review",
            "renderReview",
            "renderReviewCard",
            "flipReview",
            "Russian first, then English",
            "No typing required",
            "reviewcard",
        ):
            self.assertIn(
                token,
                self.app
                + self.server
                + index
                + (ROOT / "web" / "styles.css").read_text(encoding="utf-8"),
            )

    def test_speech_scorer_has_correct_close_repair_thresholds(self) -> None:
        for token in (
            "normalizeSpeech",
            "levenshtein",
            "normalizedTranscript === normalizedTarget",
            "textSimilarity >= 0.72",
            "suggested_error_type",
            "forgot_phrase",
        ):
            self.assertIn(token, self.speech_eval)

    def test_speech_scorer_classifies_sample_phrases(self) -> None:
        script = """
          import('./scripts/speech_eval.mjs').then(m => {
            const exact = m.compareSpeech({ transcript: 'Здравствуйте', target: 'Здра́вствуйте' });
            const close = m.compareSpeech({ transcript: 'Здрасте', target: 'Здра́вствуйте' });
            const ending = m.compareSpeech({ transcript: 'Добре день', target: 'Добрый день' });
            const wrong = m.compareSpeech({ transcript: 'добрый день', target: 'Здра́вствуйте' });
            if (exact.verdict !== 'correct') throw new Error('exact mismatch');
            if (close.verdict !== 'close') throw new Error('close mismatch');
            if (ending.verdict !== 'close') throw new Error('ending mismatch');
            if (wrong.verdict !== 'repair') throw new Error('repair mismatch');
          });
        """
        result = subprocess.run(
            ["node", "-e", script],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr or result.stdout)


if __name__ == "__main__":
    unittest.main()
