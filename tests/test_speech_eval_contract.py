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
        self.roleplay_sql = (
            ROOT / "db" / "migrations" / "003_roleplay_conversation_passes.sql"
        ).read_text(encoding="utf-8")
        self.roleplay_cost_sql = (
            ROOT / "db" / "migrations" / "004_roleplay_conversation_costs.sql"
        ).read_text(encoding="utf-8")

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

    def test_today_lane_prioritizes_review_speak_roleplay(self) -> None:
        styles = (ROOT / "web" / "styles.css").read_text(encoding="utf-8")
        index = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        for token in (
            "todayPracticeHtml",
            "Today practice",
            "Review cards",
            "Speak one phrase",
            "Try guided roleplay",
            "startTodaySpeak",
            "startGuidedRoleplay",
            "#/conversations",
            "todaylane",
        ):
            self.assertIn(token, self.app + styles + index)

    def test_live_conversation_library_surfaces_graded_scenarios(self) -> None:
        styles = (ROOT / "web" / "styles.css").read_text(encoding="utf-8")
        index = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        service_worker = (ROOT / "web" / "service-worker.js").read_text(
            encoding="utf-8"
        )
        for token in (
            "#/conversations",
            "renderConversations",
            "openConversationScenario",
            "setConversationTopic",
            "setConversationLevel",
            "CONVERSATION_LEVELS",
            "Live conversations",
            "Ekaterina-guide scenarios",
            "convcard",
            "convfilters",
            "n_plus_one",
            "NETWORK_FIRST",
            "zastolom-v8",
        ):
            self.assertIn(token, self.app + styles + index + service_worker)

    def test_practice_scope_defaults_to_all_units_with_optional_limits(self) -> None:
        styles = (ROOT / "web" / "styles.css").read_text(encoding="utf-8")
        for token in (
            "ALL_UNITS",
            "lesson_scope_all_units_v1",
            "Practice scope",
            "Everything from the Ekaterina guide is available",
            "Limit to unit",
            "phrases available",
            "Show all units",
            "This unit limit hides",
            "practiceScopeNumber",
        ):
            self.assertIn(token, self.app + styles)

    def test_review_sessions_have_spaced_ratings(self) -> None:
        for token in (
            "REVIEW_KEY",
            "reviewSessionControlsHtml",
            "setReviewSessionLimit",
            "startReviewSession",
            "rateReviewCard",
            "Know it",
            "Almost",
            "Forgot",
            "flashcard_review",
            "daily_completed_at",
            "Forgotten cards repeat",
        ):
            self.assertIn(token, self.app)

    def test_guided_roleplay_ladder_and_rescue_controls(self) -> None:
        styles = (ROOT / "web" / "styles.css").read_text(encoding="utf-8")
        for token in (
            "guidedRoleplayPanelHtml",
            "showGuidedRoleplay",
            "insertRescuePhrase",
            "Guided roleplay",
            "Shadow",
            "Prompted",
            "Supported",
            "Live",
            "Повтори́те, пожа́луйста.",
            "Поме́дленнее, пожа́луйста.",
            "Я не понима́ю.",
            "Я ещё учу́ ру́сский.",
            "guidedplay",
            "rescuelines",
        ):
            self.assertIn(token, self.app + styles)

    def test_live_roleplay_uses_ga_realtime_contract(self) -> None:
        for token in (
            'OPENAI_REALTIME_MODEL || "gpt-realtime-2"',
            'OPENAI_REALTIME_VOICE || "marin"',
            '"/api/realtime/session"',
            '"/api/realtime/call"',
            "https://api.openai.com/v1/realtime/client_secrets",
            "https://api.openai.com/v1/realtime/calls",
            'type: "realtime"',
            "audio: {",
            "submit_roleplay_score",
            "OpenAI-Safety-Identifier",
            "runtimeSecret",
        ):
            self.assertIn(token, self.server)

    def test_roleplay_ui_streams_and_scores_live_conversation(self) -> None:
        for token in (
            "liveRoleplayPanelHtml",
            "startLiveRoleplay",
            "RTCPeerConnection",
            "oai-events",
            "currentLiveTranscriptRows",
            "response.function_call_arguments.delta",
            "response.output_item.done",
            "input_audio_transcription",
            "Finish & get feedback",
            "Live conversation",
            "Start conversation",
            "Conversation ended. Getting final feedback and cost",
            "liveRoleplayTimer",
            "LIVE_ROLEPLAY_LIMIT_MS",
            "estimated_cost_usd",
            "What landed",
            "Replay easier",
            "live_realtime",
            "stage_complete",
            "transcript",
            "missed_phrases",
            "replay_prompt",
        ):
            self.assertIn(token, self.app)

    def test_live_transcript_turns_can_translate_without_exposing_key(self) -> None:
        for token in (
            "translateLiveTurn",
            "Click any turn for English",
            '"/api/translate"',
            "translateText",
            "OPENAI_TRANSLATION_MODEL",
            "Return only the translation",
            "runtimeSecret",
        ):
            self.assertIn(token, self.app + self.server)

    def test_live_roleplay_transcript_passes_persist_to_postgres(self) -> None:
        for token in (
            "CREATE TABLE IF NOT EXISTS roleplay_conversation_passes",
            "transcript JSONB NOT NULL",
            "transcript_text TEXT",
            "stage_complete BOOLEAN NOT NULL",
            "n_plus_one_ready BOOLEAN NOT NULL",
            "met_criteria TEXT[]",
            "missed_criteria TEXT[]",
        ):
            self.assertIn(token, self.roleplay_sql)
        for token in (
            "persistRoleplayConversationPass",
            "compactTranscript",
            "transcriptText",
            "roleplay.live_realtime",
            "stageComplete",
            "nPlusOneReady",
            "estimated_cost_usd",
            "duration_ms",
            "roleplay_conversation_passes",
        ):
            self.assertIn(token, self.server)
        for token in (
            "estimated_cost_usd",
            "cost_source",
            "duration_ms",
            "ended_reason",
            "usage JSONB",
        ):
            self.assertIn(token, self.roleplay_cost_sql)

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
