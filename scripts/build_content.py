#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Canonical content generator for the Russian family-visit study system.

This is the SINGLE SOURCE OF TRUTH. It emits content/content.json, which the
web app (web/), the Anki deck (anki/), and the printable cheat sheet
(printable/) all consume. Edit the data tables below and re-run:

    python3 scripts/build_content.py

All Russian carries stress marks (Unicode combining acute U+0301 after the
stressed vowel). A plain (stress-stripped) form is auto-computed for TTS.

Provenance: items verified against scraped/searched sources, compiled in
source/research/verified_phrases.md (2026-05-30). Confidence + rehearse flags
preserved so the UI can surface "rehearse with Kadriya" items.
"""

import json
import os
import re
import unicodedata

from course_config import DEFAULT_COURSE_ID, load_course

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ACUTE = "́"  # combining acute accent

ERROR_TYPES = [
    {
        "id": "stress",
        "label": "Stress",
        "repair": "Replay native audio, mark the stressed vowel, then say it twice.",
    },
    {
        "id": "vowel_reduction",
        "label": "Vowel reduction",
        "repair": "Shadow the phrase slowly, then at table speed.",
    },
    {
        "id": "gendered_form",
        "label": "Gendered form",
        "repair": "Contrast the male/female form and produce the speaker-appropriate one.",
    },
    {
        "id": "case_or_inflection",
        "label": "Case / inflection",
        "repair": "Recall the whole verified phrase rather than assembling it word by word.",
    },
    {
        "id": "register",
        "label": "Register",
        "repair": "Choose the formal/polite option for elders and hosts.",
    },
    {
        "id": "word_order",
        "label": "Word order",
        "repair": "Repeat the complete model answer and compare chunks.",
    },
    {
        "id": "listening_misparse",
        "label": "Listening misparse",
        "repair": "Listen with full text, then keyword hints, then no text.",
    },
    {
        "id": "cultural_usage",
        "label": "Cultural usage",
        "repair": "Review the usage note and choose the phrase in context.",
    },
    {
        "id": "forgot_phrase",
        "label": "Forgot phrase",
        "repair": "Do cued recall, then production, then a role-play prompt.",
    },
]

LISTENING_LADDER = [
    {
        "id": "no_text",
        "label": "No text",
        "assistance": 0,
        "description": "Listen without captions and choose the meaning.",
    },
    {
        "id": "first_letter",
        "label": "First-letter hint",
        "assistance": 1,
        "description": "Show the first letter of each word as a fading caption.",
    },
    {
        "id": "cloze",
        "label": "Cloze caption",
        "assistance": 2,
        "description": "Show a partial target-language caption.",
    },
    {
        "id": "full_caption",
        "label": "Full caption",
        "assistance": 3,
        "description": "Show the full stress-marked target-language phrase.",
    },
    {
        "id": "slow_audio",
        "label": "Slow pass",
        "assistance": 2,
        "description": "Replay native audio more slowly before returning to no-text listening.",
    },
    {
        "id": "table_speed",
        "label": "Table speed",
        "assistance": 0,
        "description": "Replay at a faster conversational rate with no caption.",
    },
    {
        "id": "room_noise",
        "label": "Room noise",
        "assistance": 0,
        "description": "Replay with light deterministic room noise to simulate a dinner table.",
    },
]

ROLEPLAY_CRITERIA = {
    "uses_formal_greeting": {
        "label": "formal greeting",
        "error_type": "register",
    },
    "introduces_self": {
        "label": "introduces self",
        "error_type": "forgot_phrase",
    },
    "thanks_hosts": {
        "label": "thanks hosts",
        "error_type": "register",
    },
    "compliments_food": {
        "label": "compliments food",
        "error_type": "forgot_phrase",
    },
    "declines_politely": {
        "label": "declines politely",
        "error_type": "register",
    },
    "uses_correct_male_form": {
        "label": "male form",
        "error_type": "gendered_form",
    },
    "uses_za_toast_formula": {
        "label": "safe toast formula",
        "error_type": "cultural_usage",
    },
    "avoids_na_zdorovie_misfire": {
        "label": "avoids false toast reply",
        "error_type": "cultural_usage",
    },
    "keeps_stress_clear": {
        "label": "clear stress",
        "error_type": "stress",
    },
    "answers_host_questions": {
        "label": "answers host questions",
        "error_type": "forgot_phrase",
    },
    "uses_learning_safety_line": {
        "label": "uses learning-safe line",
        "error_type": "forgot_phrase",
    },
    "uses_repair_lines": {
        "label": "uses repair lines",
        "error_type": "forgot_phrase",
    },
    "recovers_from_unknown": {
        "label": "recovers from unclear prompt",
        "error_type": "forgot_phrase",
    },
    "tells_short_story": {
        "label": "tells the short story",
        "error_type": "forgot_phrase",
    },
    "handles_follow_up": {
        "label": "handles one follow-up",
        "error_type": "forgot_phrase",
    },
    "stays_in_russian": {
        "label": "stays in Russian",
        "error_type": "forgot_phrase",
    },
    "delivers_full_dinner_arc": {
        "label": "completes the dinner arc",
        "error_type": "forgot_phrase",
    },
    "recovers_curveball": {
        "label": "recovers from curveball",
        "error_type": "forgot_phrase",
    },
    "mentions_host_or_food": {
        "label": "mentions host or food naturally",
        "error_type": "forgot_phrase",
    },
    "uses_time_greeting": {
        "label": "uses time-of-day greeting",
        "error_type": "forgot_phrase",
    },
    "uses_social_exit": {
        "label": "uses social exit phrase",
        "error_type": "forgot_phrase",
    },
    "uses_polite_basics": {
        "label": "uses polite micro-dialogue basics",
        "error_type": "register",
    },
    "uses_quick_responses": {
        "label": "uses quick response phrases",
        "error_type": "forgot_phrase",
    },
    "uses_positive_ack": {
        "label": "acknowledges politely",
        "error_type": "forgot_phrase",
    },
    "uses_safe_toast_formula": {
        "label": "chooses safe toast formula",
        "error_type": "cultural_usage",
    },
    "uses_toast_context": {
        "label": "uses toast in context",
        "error_type": "cultural_usage",
    },
    "uses_family_terms": {
        "label": "uses family terms correctly",
        "error_type": "register",
    },
    "uses_respectful_reference": {
        "label": "uses respectful forms for elders",
        "error_type": "register",
    },
    "requests_or_declines_polite": {
        "label": "requests or declines politely",
        "error_type": "register",
    },
    "passes_dishes": {
        "label": "passes food request phrases",
        "error_type": "forgot_phrase",
    },
    "appreciates_food": {
        "label": "appreciates food naturally",
        "error_type": "forgot_phrase",
    },
    "produces_present_forms": {
        "label": "produces present-tense forms",
        "error_type": "case_or_inflection",
    },
    "answers_personalized_questions": {
        "label": "answers profile questions from prompts",
        "error_type": "forgot_phrase",
    },
    "answers_calendar_weather": {
        "label": "answers calendar/weather prompts",
        "error_type": "forgot_phrase",
    },
    "uses_time_words": {
        "label": "uses today/yesterday/tomorrow words",
        "error_type": "case_or_inflection",
    },
    "handles_travel_logistics": {
        "label": "handles travel logistics",
        "error_type": "forgot_phrase",
    },
    "handles_airport_hotel": {
        "label": "handles airport and hotel basics",
        "error_type": "forgot_phrase",
    },
    "talks_about_budva": {
        "label": "talks about Budva naturally",
        "error_type": "forgot_phrase",
    },
    "answers_daily_routine": {
        "label": "answers daily-routine prompts",
        "error_type": "forgot_phrase",
    },
    "tells_daily_story": {
        "label": "tells a short daily-routine story",
        "error_type": "forgot_phrase",
    },
    "uses_day_parts": {
        "label": "uses morning/day/evening words",
        "error_type": "case_or_inflection",
    },
    "answers_work_questions": {
        "label": "answers work/client questions",
        "error_type": "forgot_phrase",
    },
    "keeps_work_brief": {
        "label": "keeps legal work details brief",
        "error_type": "forgot_phrase",
    },
    "answers_holiday_plans": {
        "label": "answers holiday and celebration prompts",
        "error_type": "forgot_phrase",
    },
    "keeps_celebration_story_short": {
        "label": "keeps celebration story short",
        "error_type": "forgot_phrase",
    },
}

CONTRAST_SETS = [
    {
        "id": "russian_toast_vs_youre_welcome",
        "title": "Toast vs. you're welcome",
        "items": ["toas007", "poli003"],
        "risk": "high",
        "usage_note": "Use «За здоро́вье!» for a toast. Use «Пожа́луйста» for please / you're welcome.",
        "drill_type": "choose_in_context",
    },
    {
        "id": "formal_elder_address",
        "title": "Formal elder address",
        "items": ["firs001", "poli010", "poli011"],
        "risk": "high",
        "usage_note": "Use formal «вы» forms and polite repair phrases with parents and elders.",
        "drill_type": "choose_in_context",
    },
    {
        "id": "male_speaker_forms",
        "title": "Joe's male speaker forms",
        "items": ["firs008", "food006"],
        "risk": "high",
        "usage_note": "Joe should keep male forms like «рад» and «наелся».",
        "drill_type": "contrast_say_aloud",
    },
]

SCENARIOS = [
    {
        "id": "doorway_greeting",
        "setting": "Doorway",
        "goal": "Greet the family formally and introduce yourself.",
        "required_items": ["firs001", "firs005", "firs006", "firs010"],
        "success_criteria": [
            "uses_formal_greeting",
            "introduces_self",
            "thanks_hosts",
        ],
    },
    {
        "id": "introduce_and_learning_safety",
        "setting": "Introduction + learning safety",
        "goal": "Introduce yourself clearly and set the safety expectation.",
        "required_items": ["firs005", "firs008", "poli009", "firs011"],
        "success_criteria": [
            "introduces_self",
            "uses_learning_safety_line",
        ],
    },
    {
        "id": "dinner_table_food_offer",
        "setting": "Dinner table",
        "goal": "Accept, decline, and compliment food politely.",
        "required_items": ["food002", "food006", "food008", "food009"],
        "success_criteria": [
            "compliments_food",
            "declines_politely",
            "uses_correct_male_form",
        ],
    },
    {
        "id": "first_toast",
        "setting": "Dinner table toast",
        "goal": "Raise a safe warm toast without using the wrong formula.",
        "required_items": ["toas001", "toas002", "toas006", "toas007"],
        "success_criteria": [
            "uses_za_toast_formula",
            "avoids_na_zdorovie_misfire",
            "keeps_stress_clear",
        ],
    },
    {
        "id": "rapid_host_questions",
        "setting": "Rapid host questions",
        "goal": "Catch fast family questions and answer in short Russian sentences.",
        "required_items": [
            "list001",
            "list002",
            "list003",
            "list004",
            "list005",
            "list006",
            "list007",
            "list008",
            "list009",
            "poli010",
            "poli012",
        ],
        "success_criteria": [
            "answers_host_questions",
            "mentions_host_or_food",
            "uses_repair_lines",
        ],
    },
    {
        "id": "how_we_met",
        "setting": "How we met",
        "goal": "Tell a short, confident story and answer one follow-up.",
        "required_items": ["smal005", "smal004", "fami019"],
        "success_criteria": [
            "tells_short_story",
            "handles_follow_up",
            "uses_correct_male_form",
        ],
    },
    {
        "id": "off_script_recovery",
        "setting": "Off-script recovery",
        "goal": "Recover calmly when asked something unexpected.",
        "required_items": [
            "poli004",
            "poli005",
            "poli010",
            "poli011",
            "poli012",
            "poli017",
        ],
        "success_criteria": [
            "uses_repair_lines",
            "recovers_from_unknown",
            "stays_in_russian",
        ],
    },
    {
        "id": "full_dinner_simulation",
        "setting": "Full dinner simulation",
        "goal": "Hold together the full dinner flow from greeting through close.",
        "required_items": [
            "firs001",
            "firs005",
            "list002",
            "smal004",
            "smal005",
            "food002",
            "food004",
            "toas006",
            "toas001",
            "fami019",
            "poli009",
        ],
        "success_criteria": [
            "delivers_full_dinner_arc",
            "mentions_host_or_food",
            "recovers_curveball",
            "keeps_stress_clear",
        ],
    },
    {
        "id": "lawyer_small_talk",
        "setting": "Lawyer / Missouri small talk",
        "goal": "Answer profile questions naturally and keep the lawyer details safe.",
        "required_items": ["smal001", "smal002", "smal003", "poli009"],
        "success_criteria": [
            "answers_host_questions",
            "handles_follow_up",
            "uses_repair_lines",
        ],
    },
    {
        "id": "noisy_table",
        "setting": "Noisy table role-play",
        "goal": "Recover and keep confidence when relatives speak quickly around table noise.",
        "required_items": [
            "list002",
            "list003",
            "list005",
            "list006",
            "poli010",
            "poli011",
            "poli012",
        ],
        "success_criteria": [
            "answers_host_questions",
            "stays_in_russian",
            "recovers_from_unknown",
            "uses_repair_lines",
        ],
    },
    {
        "id": "greeting_daypart_and_farewell",
        "setting": "Greetings and farewells",
        "goal": "Use polite Russian greetings and closings in social flow.",
        "required_items": [
            "firs007",
            "firs002",
            "firs003",
            "firs004",
            "firs009",
            "firs012",
            "firs013",
            "poli003",
        ],
        "success_criteria": [
            "uses_formal_greeting",
            "uses_time_greeting",
            "uses_social_exit",
        ],
    },
    {
        "id": "politeness_baseline",
        "setting": "Politeness baseline",
        "goal": "Keep every request/response in a safe polite register.",
        "required_items": [
            "poli001",
            "poli002",
            "poli003",
            "poli006",
            "poli007",
            "poli008",
            "poli013",
            "poli014",
            "poli015",
            "poli016",
        ],
        "success_criteria": [
            "uses_polite_basics",
            "uses_quick_responses",
            "uses_positive_ack",
        ],
    },
    {
        "id": "toast_repertoire_recall",
        "setting": "Toast repertoire recall",
        "goal": "Choose a safe toast quickly for different table moments.",
        "required_items": [
            "toas001",
            "toas002",
            "toas003",
            "toas004",
            "toas005",
            "toas006",
            "toas007",
            "toas008",
            "toas009",
            "toas010",
            "toas011",
            "toas012",
            "toas013",
            "toas014",
            "toas015",
            "toas016",
        ],
        "success_criteria": [
            "uses_safe_toast_formula",
            "uses_toast_context",
            "avoids_na_zdorovie_misfire",
        ],
    },
    {
        "id": "family_context_practice",
        "setting": "Family context practice",
        "goal": "Identify family relations and respond naturally during introductions.",
        "required_items": [
            "fami004",
            "fami005",
            "fami006",
            "fami007",
            "fami008",
            "fami010",
            "fami011",
            "fami019",
        ],
        "success_criteria": [
            "uses_family_terms",
            "uses_respectful_reference",
            "stays_in_russian",
        ],
    },
    {
        "id": "dinner_navigation",
        "setting": "Dinner navigation",
        "goal": "Request, decline, and appreciate food while sounding natural at table pace.",
        "required_items": [
            "food001",
            "food002",
            "food003",
            "food004",
            "food005",
            "food007",
            "food008",
            "food009",
            "food010",
            "food011",
            "food012",
            "food013",
            "food014",
            "food015",
            "food016",
        ],
        "success_criteria": [
            "requests_or_declines_polite",
            "passes_dishes",
            "appreciates_food",
        ],
    },
    {
        "id": "verb_fluency_check",
        "setting": "Core verb fluency",
        "goal": "Produce core verbs under real interview-style pressure.",
        "required_items": [
            "verb001",
            "verb002",
            "verb003",
            "verb004",
            "verb005",
            "verb006",
            "verb007",
            "verb008",
            "verb009",
            "verb010",
        ],
        "success_criteria": [
            "produces_present_forms",
            "answers_personalized_questions",
            "uses_formal_greeting",
        ],
    },
    {
        "id": "extended_family_family_tree",
        "setting": "Family tree and kinship vocabulary",
        "goal": "Use extended family terms naturally when introducing relationships.",
        "required_items": [
            "fami001",
            "fami002",
            "fami003",
            "fami009",
            "fami010",
            "fami011",
            "fami012",
            "fami013",
            "fami014",
            "fami015",
            "fami016",
            "fami017",
            "fami018",
        ],
        "success_criteria": [
            "uses_family_terms",
            "uses_respectful_reference",
            "stays_in_russian",
        ],
    },
    {
        "id": "family_mini_checkin",
        "setting": "Family mini-check-in",
        "goal": "Respond naturally to short routine check-ins and keep the exchange warm.",
        "required_items": [
            "list001",
            "poli007",
            "smal007",
            "smal008",
            "poli010",
            "poli011",
        ],
        "success_criteria": [
            "uses_quick_responses",
            "stays_in_russian",
            "uses_repair_lines",
        ],
    },
    {
        "id": "toast_mechanics_and_table_flow",
        "setting": "Toast mechanics and table flow",
        "goal": "Run toast moments and table vocabulary safely from raise-to-clink to closure.",
        "required_items": [
            "toas012",
            "toas014",
            "toas015",
            "toas016",
            "toas003",
            "toas006",
            "toas007",
            "poli004",
            "poli005",
        ],
        "success_criteria": [
            "uses_safe_toast_formula",
            "uses_toast_context",
            "uses_social_exit",
            "avoids_na_zdorovie_misfire",
        ],
    },
    {
        "id": "calendar_weather_checkin",
        "setting": "Calendar and weather check-in",
        "goal": "Answer the original-guide day and weather questions as easy table small talk.",
        "required_items": [
            "cale001",
            "cale002",
            "cale003",
            "cale004",
            "cale005",
            "cale006",
            "cale009",
            "cale010",
            "cale011",
            "cale018",
            "cale019",
        ],
        "success_criteria": [
            "answers_calendar_weather",
            "uses_time_words",
            "stays_in_russian",
            "keeps_stress_clear",
        ],
    },
    {
        "id": "budva_trip_checkin",
        "setting": "Budva family trip",
        "goal": "Talk about arriving in Budva, the hotel, the sea, and simple plans.",
        "required_items": [
            "trav001",
            "trav002",
            "trav003",
            "trav004",
            "trav005",
            "trav006",
            "trav007",
            "trav008",
            "trav009",
            "trav012",
            "trav013",
        ],
        "success_criteria": [
            "handles_travel_logistics",
            "talks_about_budva",
            "stays_in_russian",
            "uses_repair_lines",
        ],
    },
    {
        "id": "daily_routine_checkin",
        "setting": "Everyday family check-in",
        "goal": "Answer simple questions about eating, working, resting, and the evening routine.",
        "required_items": [
            "dail004",
            "dail005",
            "dail006",
            "dail007",
            "dail008",
            "dail009",
            "dail010",
            "dail011",
            "dail012",
            "dail013",
            "dail014",
            "dail015",
        ],
        "success_criteria": [
            "answers_daily_routine",
            "uses_day_parts",
            "stays_in_russian",
            "uses_repair_lines",
        ],
    },
    {
        "id": "daily_routine_story",
        "setting": "My day mini-story",
        "goal": "Tell a short morning-work-evening story using the original guide's Мой день material.",
        "required_items": [
            "dail018",
            "dail019",
            "dail020",
            "dail021",
            "dail022",
            "dail023",
            "dail024",
            "dail025",
            "dail026",
            "dail027",
            "dail028",
            "dail029",
        ],
        "success_criteria": [
            "tells_daily_story",
            "uses_day_parts",
            "stays_in_russian",
            "uses_repair_lines",
        ],
    },
    {
        "id": "work_business_checkin",
        "setting": "Lawyer work small talk",
        "goal": "Answer predictable questions about clients, cases, court, and being busy without overexplaining.",
        "required_items": [
            "smal001",
            "work001",
            "work002",
            "work003",
            "work004",
            "work005",
            "work006",
            "work007",
            "work008",
            "work009",
            "work010",
            "work011",
            "work012",
        ],
        "success_criteria": [
            "answers_work_questions",
            "keeps_work_brief",
            "stays_in_russian",
            "uses_repair_lines",
        ],
    },
    {
        "id": "holiday_celebration_checkin",
        "setting": "Holiday and family celebration small talk",
        "goal": "Answer Christmas/Thanksgiving/family-plan prompts from the original guide in short Russian.",
        "required_items": [
            "cele001",
            "cele004",
            "cele005",
            "cele006",
            "cele007",
            "cele010",
            "cele011",
            "cele012",
            "cele013",
            "cele014",
        ],
        "success_criteria": [
            "answers_holiday_plans",
            "keeps_celebration_story_short",
            "stays_in_russian",
            "uses_repair_lines",
        ],
    },
    {
        "id": "budva_airport_hotel_checkin",
        "setting": "Airport and hotel arrival",
        "goal": "Handle airport check-in, luggage, hotel reservation, room, key, elevator, and checkout basics.",
        "required_items": [
            "trav015",
            "trav016",
            "trav017",
            "trav018",
            "trav019",
            "trav020",
            "trav021",
            "trav022",
            "trav023",
            "trav024",
            "trav025",
            "trav026",
            "trav027",
            "trav028",
        ],
        "success_criteria": [
            "handles_airport_hotel",
            "handles_travel_logistics",
            "stays_in_russian",
            "uses_repair_lines",
        ],
    },
]


def infer_error_types(item):
    tags = set(item.get("tags", []))
    errors = {"stress"}
    if item.get("gender"):
        errors.add("gendered_form")
    if item.get("recognize"):
        errors.add("listening_misparse")
    if "toast" in tags or item.get("module") in {"toasts", "politeness"}:
        errors.add("cultural_usage")
    if item.get("module") in {"first_contact", "politeness"}:
        errors.add("register")
    return sorted(errors)


# ---------------------------------------------------------------------------
# Modules: display order, title, the "why", priority tier, default stage.
# priority 1 = doorway (Days 1-2 must-have); 2 = high; 3 = recognition/bonus
# ---------------------------------------------------------------------------
MODULES = [
    (
        "first_contact",
        "First Contact",
        "The doorway moment — greet elders, introduce yourself, say it's a pleasure. Lock this first.",
        1,
        "💬",
    ),
    (
        "politeness",
        "Politeness & Repair",
        "Thanks, sorry, and the phrases that rescue you when you're lost.",
        1,
        "🙏",
    ),
    (
        "toasts",
        "Toasts",
        "Russian tables run on toasts. A warm toast to the family lands huge.",
        2,
        "🥂",
    ),
    (
        "family",
        "Family & In-Laws",
        "Kinship terms — you are the зять; her parents are your тесть & тёща.",
        2,
        "👪",
    ),
    (
        "food",
        "Food & Complimenting the Cook",
        "Praise the тёща's cooking; accept/decline more gracefully.",
        2,
        "🍽️",
    ),
    (
        "smalltalk",
        "Small Talk About You",
        "Who you are, where you're from, how you met your wife.",
        2,
        "🗣️",
    ),
    (
        "listening",
        "Questions They'll Ask (Listening)",
        "Train your EAR for the questions relatives fire back at you.",
        2,
        "👂",
    ),
    (
        "calendar_weather",
        "Calendar & Weather",
        "Original-guide day and weather questions for easy family small talk.",
        2,
        "☀️",
    ),
    (
        "daily_routine",
        "Daily Routine",
        "Original-guide 'Мой день' phrases: eat, work, rest, homework, and evening plans.",
        2,
        "🕰️",
    ),
    (
        "work_business",
        "Work & Clients",
        "Short lawyer/work answers from the guide: clients, cases, court, and being busy.",
        2,
        "💼",
    ),
    (
        "legal_recognition",
        "Legal Words (Recognition)",
        "Recognition-only legal terms from the guide so deeper work questions are less jarring.",
        3,
        "⚖️",
    ),
    (
        "celebrations",
        "Holidays & Plans",
        "Original-guide Christmas, Thanksgiving, and family-plan small talk.",
        3,
        "🎄",
    ),
    (
        "travel_budva",
        "Budva Trip",
        "Montenegro travel phrases for airport, hotel, beach, and old-town plans.",
        2,
        "🧳",
    ),
    (
        "verbs",
        "Core Verbs (reactivation)",
        "High-frequency verbs from Ekaterina's guide — я / вы forms.",
        3,
        "⚙️",
    ),
]

MODULE_STRUCTURES = {
    "first_contact": [
        "register:formal_you",
        "phrase:greeting",
        "phrase:introduction",
        "phrase:guest_gratitude",
    ],
    "politeness": [
        "register:formal_you",
        "discourse:politeness",
        "phrase:repair",
        "phrase:yes_no",
    ],
    "toasts": [
        "culture:toast_etiquette",
        "phrase:toast_za_accusative",
        "phrase:table_toast",
    ],
    "family": [
        "lexical:kinship_terms",
        "register:name_patronymic",
        "phrase:family_affection",
    ],
    "food": [
        "phrase:food_offer",
        "phrase:compliment_food",
        "phrase:polite_decline",
        "morphology:gendered_short_form",
    ],
    "smalltalk": [
        "phrase:personal_origin",
        "phrase:work_identity",
        "grammar:present_first_person",
    ],
    "listening": [
        "skill:listening_question_recognition",
        "grammar:formal_question",
        "phrase:host_question",
    ],
    "calendar_weather": [
        "lexical:days_of_week",
        "phrase:weather_answer",
        "phrase:calendar_question",
        "grammar:time_expression",
    ],
    "daily_routine": [
        "lexical:day_parts",
        "phrase:routine_answer",
        "grammar:when_question",
        "grammar:time_expression",
    ],
    "work_business": [
        "lexical:work_vocab",
        "phrase:work_identity",
        "phrase:client_case_answer",
        "grammar:past_masculine_work",
    ],
    "legal_recognition": [
        "lexical:legal_vocab",
        "skill:listening_question_recognition",
        "strategy:recognition_only",
    ],
    "celebrations": [
        "lexical:holiday_vocab",
        "phrase:holiday_plan",
        "phrase:family_celebration",
        "grammar:future_plan",
    ],
    "travel_budva": [
        "lexical:travel_vocab",
        "phrase:travel_logistics",
        "phrase:place_description",
        "grammar:prepositional_place",
    ],
    "verbs": [
        "grammar:present_first_person",
        "grammar:formal_second_person",
        "lexical:core_verbs",
    ],
}

# ---------------------------------------------------------------------------
# Items. Tuple form:
#   (module, ru, en, hint, priority, flags)
# flags is a dict (optional keys):
#   conf: "high"|"med"|"low" (default high)
#   gender: "m" (male-specific form the speaker must use)
#   rehearse: True (flag to rehearse with Kadriya)
#   note: extra teaching note
#   recognize: True (receptive only — understand, don't need to produce)
#   tags: [..]
# ---------------------------------------------------------------------------
I = []


def add(module, ru, en, hint="", priority=2, **flags):
    I.append((module, ru, en, hint, priority, flags))


# --- FIRST CONTACT (doorway) ---
add(
    "first_contact",
    "Здра́вствуйте",
    "Hello (formal)",
    "the first в is silent: [zdrá-stvuy-tye]",
    1,
    tags=["greeting"],
)
add(
    "first_contact",
    "До́брый ве́чер",
    "Good evening",
    "[dó-bry vyé-cher]",
    1,
    tags=["greeting"],
)
add(
    "first_contact",
    "До́брый день",
    "Good afternoon",
    "[dó-bry dyen']",
    2,
    tags=["greeting"],
)
add(
    "first_contact",
    "До́брое у́тро",
    "Good morning",
    "[dó-bra-ye ú-tra]",
    2,
    tags=["greeting"],
)
add(
    "first_contact",
    "Меня́ зову́т Джо",
    "My name is Joe",
    "lit. 'they call me': [me-nyá za-vút]",
    1,
    tags=["intro"],
)
add(
    "first_contact",
    "О́чень прия́тно",
    "Very nice to meet you",
    "[ó-chen' pri-yát-na]",
    1,
    tags=["intro"],
)
add(
    "first_contact",
    "Прия́тно познако́миться",
    "Pleased to meet you",
    "[pri-yát-na pa-zna-kó-mi-tsa]",
    2,
    tags=["intro"],
)
add(
    "first_contact",
    "Рад познако́миться",
    "Glad to meet you",
    "use рад (male form): [rad pa-zna-kó-mi-tsa]",
    2,
    gender="m",
    tags=["intro"],
)
add(
    "first_contact",
    "Разреши́те предста́виться",
    "Allow me to introduce myself",
    "formal/ceremonial: [raz-re-shí-tye pred-stá-vi-tsa] — «Меня́ зову́т…» is the warmer everyday option",
    3,
    tags=["intro"],
)
add(
    "first_contact",
    "Спаси́бо, что пригласи́ли",
    "Thank you for inviting me",
    "[spa-sí-ba shto pri-gla-sí-li]",
    1,
    tags=["intro", "politeness"],
)
add(
    "first_contact",
    "Спаси́бо, что приня́ли",
    "Thank you for having me",
    "warmer than 'glad to be here' (a calque): [spa-sí-ba shto prí-nya-li] — при́няли stress on 1st syllable",
    2,
    note="Idiomatic guest gratitude — Russians thank the hosts for receiving them.",
)
add(
    "first_contact", "До свида́ния", "Goodbye", "[da svi-dá-ni-ya]", 2, tags=["greeting"]
)
add(
    "first_contact",
    "Споко́йной но́чи",
    "Good night",
    "[spa-kóy-nay nó-chi]",
    3,
    tags=["greeting"],
)

# --- POLITENESS & REPAIR ---
add("politeness", "Спаси́бо", "Thank you", "[spa-sí-ba]", 1)
add("politeness", "Спаси́бо большо́е", "Thank you very much", "[spa-sí-ba bal-shó-ye]", 1)
add("politeness", "Пожа́луйста", "Please / You're welcome", "[pa-zhá-lus-ta]", 1)
add("politeness", "Извини́те", "Excuse me / sorry (formal)", "[iz-vi-ní-tye]", 1)
add("politeness", "Прости́те", "Pardon me / sorry (formal)", "[pra-stí-tye]", 2)
add("politeness", "Мо́жно?", "May I?", "[mózh-na]", 2)
add("politeness", "Да", "Yes", "[da]", 1)
add("politeness", "Нет, спаси́бо", "No, thank you", "[nyet spa-sí-ba]", 1)
add(
    "politeness",
    "Я ещё учу́ ру́сский",
    "I'm still learning Russian",
    "your best rescue line: [ya ye-shchó u-chú rús-skiy]",
    1,
    tags=["rescue"],
)
add(
    "politeness",
    "Повтори́те, пожа́луйста",
    "Could you repeat, please",
    "[pav-ta-rí-tye pa-zhá-lus-ta]",
    1,
    tags=["rescue"],
)
add(
    "politeness",
    "Поме́дленнее, пожа́луйста",
    "Slower, please",
    "[pa-myéd-len-nye-ye pa-zhá-lus-ta]",
    1,
    tags=["rescue"],
)
add(
    "politeness",
    "Я не понима́ю",
    "I don't understand",
    "[ya nye pa-ni-má-yu]",
    1,
    tags=["rescue"],
)
add("politeness", "Я понима́ю", "I understand", "[ya pa-ni-má-yu]", 2)
add("politeness", "Поня́тно", "Got it / I see", "[pa-nyát-na]", 2)
add("politeness", "Хорошо́", "Good / OK", "both о reduce to [a]: [ha-ra-shó]", 1)
add("politeness", "Отли́чно", "Great", "[at-lích-na]", 2)
add(
    "politeness",
    "Как по-ру́сски …?",
    "How do you say … in Russian?",
    "[kak pa-rús-ski] — also «Как э́то бу́дет по-ру́сски?»",
    3,
)

# --- TOASTS ---  (pattern: За + accusative = "to / for …")
add(
    "toasts",
    "За встре́чу!",
    "To our getting together!",
    "[za fstryé-chu]",
    1,
    tags=["toast"],
)
add(
    "toasts",
    "За знако́мство!",
    "To getting to know each other!",
    "[za zna-kóm-stva]",
    2,
    tags=["toast"],
)
add(
    "toasts", "За роди́телей!", "To the parents!", "[za ra-dí-te-ley]", 2, tags=["toast"]
)
add(
    "toasts",
    "За хозя́йку!",
    "To the hostess! (who cooked)",
    "[za ha-zyáy-ku]",
    2,
    tags=["toast"],
)
add("toasts", "За хозя́ев!", "To the hosts!", "[za ha-zyá-yev]", 2, tags=["toast"])
add(
    "toasts",
    "За ва́ше здоро́вье!",
    "To your health! (formal)",
    "[za vá-she zda-róv-ye]",
    1,
    tags=["toast"],
)
add(
    "toasts",
    "За здоро́вье!",
    "To health!",
    "[za zda-róv-ye]",
    2,
    tags=["toast"],
    note="NOT «На здоровье» — that is a reply to thanks, not a toast.",
)
add("toasts", "За семью́!", "To the family!", "[za syem-yú]", 2, tags=["toast"])
add("toasts", "За любо́вь!", "To love!", "[za lyu-bóf']", 2, tags=["toast"])
add("toasts", "За молоды́х!", "To the newlyweds!", "[za ma-la-dýh]", 3, tags=["toast"])
add(
    "toasts",
    "Бу́дем здоро́вы!",
    "Let's be healthy! (full toast)",
    "[bú-dyem zda-ró-vy]",
    2,
    tags=["toast"],
)
add(
    "toasts",
    "Я хочу́ сказа́ть тост за …",
    "I want to make a toast to …",
    "[ya ha-chú ska-zát' tost za]",
    2,
    tags=["toast"],
)
add(
    "toasts",
    "Дава́йте вы́пьем за э́то!",
    "Let's drink to that!",
    "[da-váy-tye výp-yem za é-ta]",
    3,
    tags=["toast"],
)
add(
    "toasts",
    "до дна́",
    "'to the bottom' (drain the glass)",
    "[da dná] — not required every toast",
    3,
    tags=["toast-vocab"],
)
add("toasts", "бока́л", "(wine) glass", "[ba-kál]", 3, tags=["toast-vocab"])
add("toasts", "рю́мка", "shot glass (for vodka)", "[ryúm-ka]", 3, tags=["toast-vocab"])

# --- FAMILY & IN-LAWS ---
add("family", "семья́", "family", "[syem-yá]", 2)
add("family", "жена́", "wife", "[zhe-ná]", 2)
add("family", "муж", "husband", "final ж → [sh]: [mush]", 2)
add(
    "family",
    "тесть",
    "father-in-law (wife's father — yours)",
    "soft: [tyest']",
    2,
    note="Referential term; address him by name+patronymic, not 'тесть'.",
)
add(
    "family",
    "тёща",
    "mother-in-law (wife's mother — yours)",
    "[tyó-shcha]",
    2,
    note="Referential; address her by name+patronymic.",
)
add("family", "зять", "son-in-law (= what YOU are to them)", "[zyat']", 2)
add(
    "family",
    "шу́рин",
    "wife's brother (your brother-in-law)",
    "[shú-rin] — everyday: «брат жены́»",
    3,
)
add(
    "family",
    "сестра́ жены́",
    "wife's sister (your sister-in-law)",
    "[se-strá zhe-ný] — what people actually say; the formal kinship term is своя́ченица",
    3,
)
add("family", "ма́ма", "mom", "[má-ma]", 2)
add("family", "па́па", "dad", "[pá-pa]", 2)
add("family", "роди́тели", "parents", "о → [a]: [ra-dí-te-li]", 2)
add("family", "ба́бушка", "grandmother", "[bá-bush-ka]", 2)
add("family", "де́душка", "grandfather", "[dyé-dush-ka]", 2)
add("family", "сын", "son", "[syn]", 3)
add("family", "дочь", "daughter", "soft ч: [doch']", 2)
add("family", "брат", "brother", "[brat]", 3)
add("family", "сестра́", "sister", "[se-strá]", 3)
add("family", "де́ти", "children", "[dyé-ti]", 3)
add(
    "family",
    "Я люблю́ ва́шу дочь",
    "I love your daughter",
    "the line that wins the table: [ya lyu-blyú vá-shu doch']",
    1,
)

# --- FOOD ---
add(
    "food",
    "Прия́тного аппети́та!",
    "Bon appétit!",
    "-ого → [-ava]: [pri-yát-na-va a-pe-tí-ta]",
    1,
)
add("food", "О́чень вку́сно!", "Very tasty!", "[ó-chen' fkús-na]", 1)
add("food", "Вку́сно!", "Tasty!", "[fkús-na]", 2)
add(
    "food",
    "Спаси́бо, бы́ло о́чень вку́сно",
    "Thank you, it was delicious",
    "the after-dinner thank-you",
    1,
)
add("food", "Мне о́чень нра́вится", "I really like it", "[mnye ó-chen' nrá-vi-tsa]", 2)
add(
    "food",
    "Я нае́лся",
    "I'm full (I've eaten my fill)",
    "MALE form -лся; a woman says нае́лась",
    2,
    gender="m",
)
add("food", "Мо́жно ещё?", "May I have more?", "[mózh-na ye-shchó]", 2)
add(
    "food", "Спаси́бо, не на́до", "Thanks, I'm good (no need)", "[spa-sí-ba nye ná-da]", 2
)
add(
    "food",
    "Переда́йте, пожа́луйста, хлеб",
    "Please pass the bread",
    "[pe-re-dáy-tye pa-zhá-lus-ta] — swap хлеб for any dish",
    3,
)
add("food", "Мо́жно ча́ю?", "May I have some tea?", "[mózh-na chá-yu]", 3)
add("food", "борщ", "borscht (beet soup)", "[borshch]", 3, recognize=True)
add("food", "пельме́ни", "meat dumplings", "[pel'-myé-ni]", 3, recognize=True)
add("food", "блины́", "blini (thin pancakes)", "[bli-ný]", 3, recognize=True)
add("food", "оливье́", "Olivier (Russian potato salad)", "[a-liv-yé]", 3, recognize=True)
add("food", "чай", "tea", "[chay]", 3, recognize=True)
add("food", "во́дка", "vodka", "[vód-ka]", 3, recognize=True)

# --- SMALL TALK (about him) ---
add(
    "smalltalk",
    "Я юри́ст",
    "I'm a lawyer (general — use this)",
    "[ya yu-ríst]",
    2,
    note="адвокат = courtroom/bar advocate, narrower.",
)
add("smalltalk", "Я из Аме́рики", "I'm from America", "[ya iz a-myé-ri-ki]", 2)
add(
    "smalltalk",
    "Я из шта́та Миссу́ри",
    "I'm from the state of Missouri",
    "[ya is shtá-ta mis-sú-ri] — Миссу́ри is indeclinable; bare «Я из Миссу́ри» works too",
    3,
)
add(
    "smalltalk",
    "Я живу́ в Аме́рике",
    "I live in America",
    "[ya zhi-vú v a-myé-ri-kye]",
    3,
)
add(
    "smalltalk",
    "Мы познако́мились …",
    "We met …",
    "lit. 'got acquainted': [my pa-zna-kó-mi-lis']",
    2,
)
add(
    "smalltalk",
    "Я немно́го говорю́ по-ру́сски",
    "I speak a little Russian",
    "[ya nem-nó-ga ga-va-ryú pa-rús-ski]",
    1,
)
add("smalltalk", "Хорошо́, спаси́бо", "Good, thank you (answer to 'how are you')", "", 1)
add("smalltalk", "Норма́льно", "Fine / OK (answer)", "[nar-mál'-na]", 2)
add("smalltalk", "Да, немно́го", "Yes, a little (answer)", "", 2)

# --- LISTENING (questions to recognize, receptive) ---
add("listening", "Как дела́?", "How are you?", "[kak de-lá]", 1, recognize=True)
add(
    "listening", "Отку́да вы?", "Where are you from?", "[at-kú-da vy]", 1, recognize=True
)
add(
    "listening",
    "Кем вы рабо́таете?",
    "What do you do for work?",
    "lit. 'as whom do you work': [kyem vy ra-bó-ta-ye-tye]",
    2,
    recognize=True,
)
add(
    "listening",
    "Вы говори́те по-ру́сски?",
    "Do you speak Russian?",
    "[vy ga-va-rí-tye pa-rús-ski]",
    1,
    recognize=True,
)
add(
    "listening",
    "Как ва́м Росси́я?",
    "How do you like Russia?",
    "[kak vam ra-ssí-ya]",
    2,
    recognize=True,
)
add(
    "listening",
    "Как вы познако́мились?",
    "How did you two meet?",
    "[kak vy pa-zna-kó-mi-lis']",
    2,
    recognize=True,
)
add(
    "listening",
    "Вам нра́вится …?",
    "Do you like …?",
    "[vam nrá-vi-tsa]",
    2,
    recognize=True,
)
add("listening", "Ещё?", "More? (offering food/drink)", "[ye-shchó]", 1, recognize=True)
add(
    "listening",
    "Бу́дете …?",
    "Will you have …? (offering)",
    "[bú-dye-tye] — e.g. «Бу́дете чай?»",
    3,
    recognize=True,
)

# --- CALENDAR & WEATHER (original-guide small-talk lane) ---
add(
    "calendar_weather",
    "Ка́кая сего́дня пого́да?",
    "What is the weather like today?",
    "[ká-ka-ya si-vód-nya pa-gó-da]",
    2,
    recognize=True,
    tags=["weather", "calendar"],
)
add(
    "calendar_weather",
    "Как там на у́лице?",
    "How is it outside?",
    "[kak tam na ú-li-tse]",
    2,
    recognize=True,
    tags=["weather", "calendar"],
)
add(
    "calendar_weather",
    "Сего́дня хо́лодно.",
    "Today it's cold.",
    "[si-vód-nya hó-lad-na]",
    2,
    tags=["weather"],
)
add(
    "calendar_weather",
    "Сего́дня тепло́.",
    "Today it's warm.",
    "[si-vód-nya tip-ló]",
    2,
    tags=["weather"],
)
add(
    "calendar_weather",
    "Сего́дня со́лнечно.",
    "Today it's sunny.",
    "[si-vód-nya sól-nech-na]",
    2,
    tags=["weather"],
)
add(
    "calendar_weather",
    "Сего́дня о́блачно.",
    "Today it's cloudy.",
    "[si-vód-nya ób-lach-na]",
    2,
    tags=["weather"],
)
add(
    "calendar_weather",
    "Идёт дождь.",
    "It's raining.",
    "[i-dyót doshch]",
    2,
    tags=["weather"],
)
add(
    "calendar_weather",
    "Идёт снег.",
    "It's snowing.",
    "[i-dyót snyek]",
    2,
    tags=["weather"],
)
add(
    "calendar_weather",
    "Вчера́ бы́ло со́лнечно.",
    "It was sunny yesterday.",
    "[vchi-rá bý-la sól-nech-na]",
    3,
    tags=["weather", "time"],
)
add(
    "calendar_weather",
    "За́втра бу́дет тепло́.",
    "Tomorrow it will be warm.",
    "[záf-tra bú-dyet tip-ló]",
    3,
    tags=["weather", "time"],
)
add(
    "calendar_weather",
    "Како́й сего́дня день неде́ли?",
    "What day of the week is it today?",
    "[ka-kóy si-vód-nya dyen' ni-dyé-li]",
    2,
    recognize=True,
    tags=["calendar"],
)
add("calendar_weather", "понеде́льник", "Monday", "[pa-ni-dyél'-nik]", 3, tags=["day"])
add("calendar_weather", "вто́рник", "Tuesday", "[ftór-nik]", 3, tags=["day"])
add("calendar_weather", "среда́", "Wednesday", "[sri-dá]", 3, tags=["day"])
add("calendar_weather", "четве́рг", "Thursday", "[chit-vyérk]", 3, tags=["day"])
add("calendar_weather", "пя́тница", "Friday", "[pyát-ni-tsa]", 3, tags=["day"])
add("calendar_weather", "суббо́та", "Saturday", "[su-bó-ta]", 3, tags=["day"])
add("calendar_weather", "воскресе́нье", "Sunday", "[vas-kri-syén'-ye]", 3, tags=["day"])
add(
    "calendar_weather",
    "на выходны́х",
    "on the weekend",
    "[na vy-had-nýh]",
    3,
    tags=["calendar"],
)

# --- DAILY ROUTINE (original-guide "Мой день" lane) ---
add(
    "daily_routine",
    "До́брое у́тро.",
    "Good morning.",
    "[dób-ra-ye ú-tra]",
    2,
    tags=["greeting", "day_part"],
)
add(
    "daily_routine",
    "До́брый день.",
    "Good afternoon.",
    "[dób-ryy dyen']",
    2,
    tags=["greeting", "day_part"],
)
add(
    "daily_routine",
    "До́брый ве́чер.",
    "Good evening.",
    "[dób-ryy vyé-cher]",
    2,
    tags=["greeting", "day_part"],
)
add(
    "daily_routine",
    "Когда́ вы обе́даете?",
    "When do you have lunch?",
    "[kag-dá vy a-byé-da-ye-tye]",
    2,
    recognize=True,
    tags=["routine", "question", "food"],
)
add(
    "daily_routine",
    "Я обе́даю днём.",
    "I have lunch during the day.",
    "[ya a-byé-da-yu dnyom]",
    2,
    tags=["routine", "food", "day_part"],
)
add(
    "daily_routine",
    "Когда́ вы у́жинаете?",
    "When do you have dinner?",
    "[kag-dá vy ú-zhi-na-ye-tye]",
    2,
    recognize=True,
    tags=["routine", "question", "food"],
)
add(
    "daily_routine",
    "Я у́жинаю ве́чером.",
    "I have dinner in the evening.",
    "[ya ú-zhi-na-yu vyé-che-ram]",
    2,
    tags=["routine", "food", "day_part"],
)
add(
    "daily_routine",
    "Когда́ вы рабо́таете?",
    "When do you work?",
    "[kag-dá vy ra-bó-ta-ye-tye]",
    2,
    recognize=True,
    tags=["routine", "question", "work"],
)
add(
    "daily_routine",
    "Я рабо́таю у́тром и ве́чером.",
    "I work in the morning and evening.",
    "[ya ra-bó-ta-yu ú-tram i vyé-che-ram]",
    2,
    tags=["routine", "work", "day_part"],
)
add(
    "daily_routine",
    "Когда́ вы отдыха́ете?",
    "When do you rest?",
    "[kag-dá vy at-dy-há-ye-tye]",
    2,
    recognize=True,
    tags=["routine", "question"],
)
add(
    "daily_routine",
    "Обы́чно я отдыха́ю ве́чером.",
    "Usually I rest in the evening.",
    "[a-bých-na ya at-dy-há-yu vyé-che-ram]",
    2,
    tags=["routine", "day_part"],
)
add(
    "daily_routine",
    "Что ты сего́дня де́лал?",
    "What did you do today?",
    "[shto ty si-vód-nya dyé-lal]",
    2,
    recognize=True,
    tags=["routine", "question", "listening"],
)
add(
    "daily_routine",
    "Мы еди́м и смо́трим телеви́зор.",
    "We eat and watch TV.",
    "[my yi-dím i smót-rim ti-li-ví-zar]",
    2,
    tags=["routine", "evening"],
)
add(
    "daily_routine",
    "Я начина́ю рабо́тать в де́сять утра́.",
    "I start working at ten in the morning.",
    "[ya na-chi-ná-yu ra-bó-tat' v dyé-syat' u-trá]",
    2,
    tags=["routine", "work", "time"],
)
add(
    "daily_routine",
    "Обы́чно я рабо́таю семь часо́в.",
    "Usually I work seven hours.",
    "[a-bých-na ya ra-bó-ta-yu syem' cha-sóf]",
    2,
    tags=["routine", "work", "time"],
)
add(
    "daily_routine",
    "У меня́ есть вре́мя до десяти́.",
    "I have time until ten.",
    "[u mi-nyá yest' vryé-mya da di-si-tí]",
    3,
    tags=["routine", "time"],
)
add(
    "daily_routine",
    "Сего́дня я рабо́тал четы́ре часа́.",
    "Today I worked four hours.",
    "[si-vód-nya ya ra-bó-tal chi-tý-re cha-sá]",
    3,
    gender="m",
    tags=["routine", "work", "time"],
)
add(
    "daily_routine",
    "Обы́чно я встаю́ ра́но у́тром.",
    "Usually I get up early in the morning.",
    "[a-bých-na ya fsta-yú rá-na ú-tram]",
    2,
    tags=["routine", "morning", "story"],
)
add(
    "daily_routine",
    "Я люблю́ ра́но встава́ть.",
    "I like to get up early.",
    "[ya lyub-lyú rá-na fsta-vát']",
    2,
    tags=["routine", "morning", "story"],
)
add(
    "daily_routine",
    "По́сле э́того я прихожу́ домо́й.",
    "After that I come home.",
    "[pós-li é-ta-va ya pri-ha-zhú da-móy]",
    2,
    tags=["routine", "sequence", "story"],
)
add(
    "daily_routine",
    "У́тром я ча́сто игра́ю на гита́ре.",
    "In the morning I often play guitar.",
    "[ú-tram ya chás-ta ig-rá-yu na gi-tá-rye]",
    2,
    tags=["routine", "morning", "music", "story"],
)
add(
    "daily_routine",
    "По́сле я гото́влю ко́фе для мое́й жены́.",
    "Afterward I make coffee for my wife.",
    "[pós-li ya ga-tóv-lyu kó-fe dlya ma-yéy zhi-ný]",
    2,
    tags=["routine", "morning", "family", "story"],
)
add(
    "daily_routine",
    "Обы́чно я не за́втракаю.",
    "Usually I don't eat breakfast.",
    "[a-bých-na ya ni záf-tra-ka-yu]",
    2,
    tags=["routine", "breakfast", "story"],
)
add(
    "daily_routine",
    "В де́сять я начина́ю реша́ть пробле́мы клие́нтов.",
    "At ten I start solving clients' problems.",
    "[v dyé-syat' ya na-chi-ná-yu ri-shát' pra-blyé-my kli-yén-taf]",
    2,
    tags=["routine", "work", "clients", "story"],
)
add(
    "daily_routine",
    "На рабо́те я де́лаю мно́го ра́зных веще́й.",
    "At work I do many different things.",
    "[na ra-bó-tye ya dyé-la-yu mnó-ga ráz-nyh vi-shchéy]",
    2,
    tags=["routine", "work", "story"],
)
add(
    "daily_routine",
    "Я ча́сто звоню́ лю́дям.",
    "I often call people.",
    "[ya chás-ta zva-nyú lyú-dyam]",
    2,
    tags=["routine", "work", "story"],
)
add(
    "daily_routine",
    "Ча́сто я хожу́ в суд.",
    "I often go to court.",
    "[chás-ta ya ha-zhú f sut]",
    2,
    tags=["routine", "work", "court", "story"],
)
add(
    "daily_routine",
    "По́сле рабо́ты мы у́жинаем.",
    "After work we have dinner.",
    "[pós-li ra-bó-ty my ú-zhi-na-yem]",
    2,
    tags=["routine", "evening", "story"],
)
add(
    "daily_routine",
    "Она́ говори́т, что я до́лжен гото́вить ча́ще.",
    "She says that I should cook more often.",
    "[a-ná ga-va-rít shto ya dól-zhen ga-tó-vit' chá-shche]",
    3,
    gender="m",
    rehearse=True,
    note="Personal family joke; rehearse with Kadriya before saying it to relatives.",
    tags=["routine", "family", "evening", "story"],
)

# --- WORK & CLIENTS (lawyer/business small-talk lane) ---
add(
    "work_business",
    "У меня́ своя́ компа́ния.",
    "I have my own company.",
    "[u mi-nyá sva-yá kam-pá-ni-ya]",
    2,
    tags=["work", "business"],
)
add(
    "work_business",
    "Кадри́я рабо́тает вме́сте со мной.",
    "Kadriya works together with me.",
    "[kad-rí-ya ra-bó-ta-yet vmyés-te sa mnoy]",
    2,
    tags=["work", "kadriya"],
)
add(
    "work_business",
    "Мы рабо́таем вме́сте.",
    "We work together.",
    "[my ra-bó-ta-yem vmyés-te]",
    2,
    tags=["work", "kadriya"],
)
add(
    "work_business",
    "У меня́ мно́го рабо́ты.",
    "I have a lot of work.",
    "[u mi-nyá mnó-ga ra-bó-ty]",
    2,
    tags=["work", "busy"],
)
add(
    "work_business",
    "Я о́чень за́нят.",
    "I'm very busy.",
    "[ya ó-chen' zá-nyat]",
    2,
    gender="m",
    tags=["work", "busy"],
)
add(
    "work_business",
    "Хорошо́. Я мно́го рабо́таю.",
    "Good. I work a lot.",
    "[ha-ra-shó ya mnó-ga ra-bó-ta-yu]",
    2,
    tags=["work", "answer"],
)
add(
    "work_business",
    "У вас мно́го клие́нтов?",
    "Do you have many clients?",
    "[u vas mnó-ga kli-yén-tav]",
    2,
    recognize=True,
    tags=["work", "clients", "question"],
)
add(
    "work_business",
    "Да, у меня́ мно́го клие́нтов.",
    "Yes, I have many clients.",
    "[da u mi-nyá mnó-ga kli-yén-tav]",
    2,
    tags=["work", "clients"],
)
add(
    "work_business",
    "У вас мно́го дел?",
    "Do you have many cases?",
    "[u vas mnó-ga dyel]",
    2,
    recognize=True,
    tags=["work", "cases", "question"],
)
add(
    "work_business",
    "Да, у меня́ мно́го дел.",
    "Yes, I have many cases.",
    "[da u mi-nyá mnó-ga dyel]",
    2,
    tags=["work", "cases"],
)
add(
    "work_business",
    "Сего́дня я рабо́тал с клие́нтом.",
    "Today I worked with a client.",
    "[si-vód-nya ya ra-bó-tal s kli-yén-tam]",
    2,
    gender="m",
    tags=["work", "clients"],
)
add(
    "work_business",
    "Я звони́л клие́нтам.",
    "I called clients.",
    "[ya zva-níl kli-yén-tam]",
    2,
    gender="m",
    tags=["work", "clients"],
)
add(
    "work_business",
    "Я рабо́тал на компью́тере.",
    "I worked on the computer.",
    "[ya ra-bó-tal na kam-pyú-te-re]",
    2,
    gender="m",
    tags=["work"],
)
add(
    "work_business",
    "Я рабо́таю в суде́.",
    "I work in court.",
    "[ya ra-bó-ta-yu f su-dyé]",
    2,
    tags=["work", "court"],
)
add(
    "work_business",
    "Мы дово́льны результа́том.",
    "We're pleased with the result.",
    "[my da-vól'-ny ri-zul'-tá-tam]",
    2,
    tags=["work", "outcome"],
)
add(
    "work_business",
    "Я сча́стлив рабо́тать на себя́.",
    "I'm happy to work for myself.",
    "[ya shchás-liv ra-bó-tat' na si-byá]",
    3,
    gender="m",
    tags=["work", "business"],
)

# --- LEGAL WORDS (recognition-only work vocabulary) ---
add(
    "legal_recognition",
    "суд",
    "court",
    "[sut]",
    3,
    recognize=True,
    tags=["legal", "court"],
)
add(
    "legal_recognition",
    "судья́",
    "judge",
    "[su-d'yá]",
    3,
    recognize=True,
    tags=["legal", "court"],
)
add(
    "legal_recognition",
    "слу́шание",
    "hearing",
    "[slú-sha-ni-ye]",
    3,
    recognize=True,
    tags=["legal", "court"],
)
add(
    "legal_recognition",
    "де́ло",
    "case / matter",
    "[dyé-la]",
    3,
    recognize=True,
    tags=["legal", "case"],
)
add(
    "legal_recognition",
    "клие́нт",
    "client",
    "[kli-yént]",
    3,
    recognize=True,
    tags=["legal", "client"],
)
add(
    "legal_recognition",
    "страхо́вка",
    "insurance",
    "[stra-hóf-ka]",
    3,
    recognize=True,
    tags=["legal", "insurance"],
)
add(
    "legal_recognition",
    "мирно́е соглаше́ние",
    "settlement agreement",
    "[mir-nó-ye sa-gla-shé-ni-ye]",
    3,
    recognize=True,
    tags=["legal", "settlement"],
)
add(
    "legal_recognition",
    "суде́бное де́ло",
    "court case / lawsuit",
    "[su-dyéb-na-ye dyé-la]",
    3,
    recognize=True,
    tags=["legal", "court", "case"],
)
add(
    "legal_recognition",
    "тра́вма",
    "injury",
    "[tráv-ma]",
    3,
    recognize=True,
    tags=["legal", "injury"],
)
add(
    "legal_recognition",
    "клевета́",
    "defamation",
    "[kle-ve-tá]",
    3,
    recognize=True,
    tags=["legal"],
)
add("legal_recognition", "зако́н", "law", "[za-kón]", 3, recognize=True, tags=["legal"])
add(
    "legal_recognition",
    "пра́во",
    "law / right",
    "[prá-va]",
    3,
    recognize=True,
    tags=["legal"],
)
add(
    "legal_recognition",
    "прокуро́р",
    "prosecutor",
    "[pra-ku-rór]",
    3,
    recognize=True,
    tags=["legal", "court"],
)
add(
    "legal_recognition",
    "защи́тник",
    "defender / defense lawyer",
    "[za-shchít-nik]",
    3,
    recognize=True,
    tags=["legal", "court"],
)
add(
    "legal_recognition",
    "пове́стка",
    "summons / subpoena",
    "[pa-vyés-tka]",
    3,
    recognize=True,
    tags=["legal", "court"],
)

# --- HOLIDAYS & PLANS (original-guide celebration lane) ---
add(
    "celebrations",
    "Скоро́ Рождество́.",
    "Christmas is soon.",
    "[ska-ró razh-di-stvó]",
    3,
    tags=["holiday", "christmas"],
)
add(
    "celebrations",
    "Како́й сего́дня пра́здник?",
    "What holiday is today?",
    "[ka-kóy si-vód-nya prázd-nik]",
    3,
    recognize=True,
    tags=["holiday", "question"],
)
add(
    "celebrations",
    "Сего́дня Рождество́.",
    "Today is Christmas.",
    "[si-vód-nya razh-di-stvó]",
    3,
    tags=["holiday", "christmas"],
)
add(
    "celebrations",
    "Как вы с Кадри́ей отпра́здновали Рождество́?",
    "How did you and Kadriya celebrate Christmas?",
    "[kak vy s kad-rí-yey at-prázd-na-va-li razh-di-stvó]",
    3,
    recognize=True,
    tags=["holiday", "christmas", "question"],
)
add(
    "celebrations",
    "Мы отпра́здновали Рождество́ у мои́х роди́телей до́ма.",
    "We celebrated Christmas at my parents' house.",
    "[my at-prázd-na-va-li razh-di-stvó u ma-íh ra-dí-te-ley dó-ma]",
    3,
    tags=["holiday", "christmas", "family"],
)
add(
    "celebrations",
    "Каки́е пла́ны на Рождество́?",
    "What are the plans for Christmas?",
    "[ka-kí-ye plá-ny na razh-di-stvó]",
    3,
    recognize=True,
    tags=["holiday", "christmas", "question"],
)
add(
    "celebrations",
    "На Рождество́ мы хоти́м полете́ть в О́регон.",
    "For Christmas we want to fly to Oregon.",
    "[na razh-di-stvó my ha-tím pa-li-tyét' v ó-re-gan]",
    3,
    tags=["holiday", "christmas", "plans"],
)
add(
    "celebrations",
    "Мы хоти́м ката́ться на лы́жах.",
    "We want to ski.",
    "[my ha-tím ka-tát'-sya na lý-zhah]",
    3,
    tags=["holiday", "plans"],
)
add(
    "celebrations",
    "Кадри́я бу́дет гуля́ть и отдыха́ть.",
    "Kadriya will walk and relax.",
    "[kad-rí-ya bú-det gu-lyát' i at-dy-hát']",
    3,
    tags=["holiday", "plans", "kadriya"],
)
add(
    "celebrations",
    "Ско́лько дней вы бу́дете в О́регоне?",
    "How many days will you be in Oregon?",
    "[skól'-ka dney vy bú-de-tye v ó-re-ga-ne]",
    3,
    recognize=True,
    tags=["holiday", "plans", "question"],
)
add(
    "celebrations",
    "Мы бу́дем в О́регоне пять дней.",
    "We'll be in Oregon for five days.",
    "[my bú-dem v ó-re-ga-ne pyat' dney]",
    3,
    tags=["holiday", "plans"],
)
add(
    "celebrations",
    "Что вы де́лали на День Благодаре́ния?",
    "What did you do for Thanksgiving?",
    "[shto vy dyé-la-li na dyen' bla-ga-da-ryé-ni-ya]",
    3,
    recognize=True,
    tags=["holiday", "thanksgiving", "question"],
)
add(
    "celebrations",
    "На День Благодаре́ния мы у́жинали всей семьёй.",
    "For Thanksgiving we had dinner as a whole family.",
    "[na dyen' bla-ga-da-ryé-ni-ya my ú-zhi-na-li fsey sim-yóy]",
    3,
    tags=["holiday", "thanksgiving", "family"],
)
add(
    "celebrations",
    "Э́то был большо́й у́жин.",
    "It was a big dinner.",
    "[é-ta byl bal'-shóy ú-zhin]",
    3,
    tags=["holiday", "thanksgiving", "family"],
)

# --- BUDVA TRIP (Montenegro travel lane) ---
add(
    "travel_budva",
    "Мы е́дем в Бу́дву.",
    "We're going to Budva.",
    "[my yé-dem v búd-vu]",
    2,
    tags=["travel", "budva"],
)
add(
    "travel_budva",
    "Мы бу́дем в Черного́рии.",
    "We'll be in Montenegro.",
    "[my bú-dem f chir-na-gó-ri-i]",
    2,
    tags=["travel", "montenegro"],
)
add(
    "travel_budva",
    "Мы бу́дем в Бу́две.",
    "We'll be in Budva.",
    "[my bú-dem v búd-vye]",
    2,
    tags=["travel", "budva"],
)
add(
    "travel_budva",
    "Где на́ш о́тель?",
    "Where is our hotel?",
    "[gdye nash ó-tel']",
    2,
    recognize=True,
    tags=["hotel", "travel"],
)
add(
    "travel_budva",
    "Мо́жно такси́?",
    "Can we get a taxi?",
    "[mózh-na tak-sí]",
    2,
    tags=["taxi", "travel"],
)
add(
    "travel_budva",
    "Ско́лько е́хать до о́теля?",
    "How long is the ride to the hotel?",
    "[skól'-ka yé-hat' da ó-te-lya]",
    2,
    recognize=True,
    tags=["taxi", "hotel", "travel"],
)
add(
    "travel_budva",
    "Где пляж?",
    "Where is the beach?",
    "[gdye plyazh]",
    2,
    recognize=True,
    tags=["beach", "travel"],
)
add(
    "travel_budva",
    "Я хочу́ погуля́ть у мо́ря.",
    "I want to walk by the sea.",
    "[ya ha-chú pa-gu-lyát' u mó-rya]",
    2,
    tags=["sea", "plans"],
)
add(
    "travel_budva",
    "Ста́рый го́род о́чень краси́вый.",
    "The old town is very beautiful.",
    "[stá-ryy gó-rat ó-chen' kra-sí-vyy]",
    2,
    tags=["old_town", "budva"],
)
add(
    "travel_budva",
    "Мо́ре о́чень краси́вое.",
    "The sea is very beautiful.",
    "[mó-re ó-chen' kra-sí-va-ye]",
    2,
    tags=["sea", "budva"],
)
add(
    "travel_budva",
    "Мы отдыха́ем.",
    "We're relaxing / on vacation.",
    "[my at-dy-há-yem]",
    2,
    tags=["plans", "travel"],
)
add(
    "travel_budva",
    "Мы здесь с семьёй.",
    "We're here with family.",
    "[my zdyes' s sim-yóy]",
    2,
    tags=["family", "travel"],
)
add(
    "travel_budva",
    "Счёт, пожа́луйста.",
    "The check, please.",
    "[shchyot pa-zhá-luy-sta]",
    2,
    tags=["restaurant", "travel"],
)
add(
    "travel_budva",
    "Мы хоти́м поу́жинать.",
    "We want to have dinner.",
    "[my ha-tím pa-ú-zhi-nat']",
    2,
    tags=["restaurant", "plans"],
)
add(
    "travel_budva",
    "аэропо́рт",
    "airport",
    "[a-e-ra-pórt]",
    3,
    recognize=True,
    tags=["airport", "travel"],
)
add(
    "travel_budva",
    "бага́ж",
    "luggage",
    "[ba-gázh]",
    3,
    recognize=True,
    tags=["airport", "hotel", "travel"],
)
add(
    "travel_budva",
    "Вот мой па́спорт.",
    "Here is my passport.",
    "[vot moy pás-part]",
    2,
    tags=["airport", "hotel", "passport"],
)
add(
    "travel_budva",
    "Я хочу́ зарегистри́роваться.",
    "I want to check in / register.",
    "[ya ha-chú za-ri-gi-strí-ra-vat-sa]",
    2,
    tags=["airport", "hotel", "checkin"],
)
add(
    "travel_budva",
    "Я хочу́ сда́ть бага́ж.",
    "I want to check my luggage.",
    "[ya ha-chú zdat' ba-gázh]",
    2,
    tags=["airport", "luggage"],
)
add(
    "travel_budva",
    "Где выда́ча багажа́?",
    "Where is baggage claim?",
    "[gdye vy-dá-cha ba-ga-zhá]",
    2,
    recognize=True,
    tags=["airport", "luggage"],
)
add(
    "travel_budva",
    "У меня́ есть брони́рование.",
    "I have a reservation.",
    "[u mi-nyá yest' bra-ní-ra-va-ni-ye]",
    2,
    tags=["hotel", "checkin"],
)
add(
    "travel_budva",
    "Ключ, пожа́луйста.",
    "Key, please.",
    "[klyuch pa-zhá-luy-sta]",
    2,
    tags=["hotel"],
)
add(
    "travel_budva",
    "Где лифт?",
    "Where is the elevator?",
    "[gdye lift]",
    2,
    tags=["hotel"],
)
add(
    "travel_budva",
    "В но́мере есть интерне́т?",
    "Is there internet in the room?",
    "[v nó-mi-rye yest' in-ter-nyét]",
    2,
    tags=["hotel", "room"],
)
add(
    "travel_budva",
    "Во ско́лько зае́зд?",
    "What time is check-in?",
    "[va skól'-ka za-yézd]",
    2,
    recognize=True,
    tags=["hotel", "checkin", "time"],
)
add(
    "travel_budva",
    "Во ско́лько вы́езд?",
    "What time is check-out?",
    "[va skól'-ka vý-yezd]",
    2,
    recognize=True,
    tags=["hotel", "checkout", "time"],
)
add(
    "travel_budva",
    "Э́то ваш ключ.",
    "This is your key.",
    "[é-ta vash klyuch]",
    3,
    recognize=True,
    tags=["hotel", "listening"],
)
add(
    "travel_budva",
    "Како́й ваш но́мер?",
    "What is your room number?",
    "[ka-kóy vash nó-mer]",
    3,
    recognize=True,
    tags=["hotel", "room", "listening"],
)

# --- CORE VERBS (reactivation; я / вы present) ---
add(
    "verbs",
    "хочу́ / хоти́те",
    "I want / you (pl/formal) want — хоте́ть",
    "[ha-chú / ha-tí-tye]",
    3,
)
add("verbs", "могу́ / мо́жете", "I can / you can — мочь", "[ma-gú / mó-zhe-tye]", 3)
add(
    "verbs",
    "говорю́ / говори́те",
    "I speak / you speak — говори́ть",
    "[ga-va-ryú / ga-va-rí-tye]",
    3,
)
add("verbs", "понима́ю / понима́ете", "I understand / you understand — понима́ть", "", 3)
add(
    "verbs",
    "люблю́ / лю́бите",
    "I love / you love — люби́ть",
    "[lyu-blyú / lyú-bi-tye]",
    3,
)
add("verbs", "рабо́таю / рабо́таете", "I work / you work — рабо́тать", "", 3)
add("verbs", "живу́ / живёте", "I live / you live — жить", "[zhi-vú / zhi-vyó-tye]", 3)
add("verbs", "ем / еди́те", "I eat / you eat — есть", "[yem / ye-dí-tye]", 3)
add("verbs", "пью / пьёте", "I drink / you drink — пить", "[pyu / pyó-tye]", 3)
add("verbs", "зна́ю / зна́ете", "I know / you know — знать", "", 3)


# ---------------------------------------------------------------------------
def strip_stress(s: str) -> str:
    return unicodedata.normalize("NFC", s).replace(ACUTE, "")


def syllable_count(s: str) -> int:
    vowels = set("аеёиоуыэюяАЕЁИОУЫЭЮЯ")
    return sum(1 for ch in strip_stress(s) if ch in vowels)


def stress_vowel_indexes(ru_plain: str) -> list[int]:
    vowels = set("аеёиоуыэюяАЕЁИОУЫЭЮЯ")
    return [idx for idx, ch in enumerate(ru_plain) if ch in vowels]


def stress_marked_variant(ru_plain: str, vowel_index: int) -> str:
    return ru_plain[: vowel_index + 1] + ACUTE + ru_plain[vowel_index + 1 :]


def lexemes_for_phrase(ru_plain: str) -> list[str]:
    phrase = ru_plain.lower().strip()
    tokens = re.findall(r"[а-яё]+", phrase, flags=re.IGNORECASE)
    lexemes = set(tokens)
    if " " in phrase:
        lexemes.add(phrase)
    return sorted(lexemes)


def cloze_answer_for_phrase(ru_plain: str) -> tuple[str, str, int] | None:
    skip = {"джо"}
    matches = list(re.finditer(r"[А-Яа-яЁё́]+", ru_plain))
    candidates = [
        m for m in matches if len(m.group(0)) >= 3 and m.group(0).lower() not in skip
    ]
    if len(matches) < 2 or not candidates:
        return None
    chosen = max(candidates, key=lambda m: (len(m.group(0)), -m.start()))
    prompt = ru_plain[: chosen.start()] + "____" + ru_plain[chosen.end() :]
    return prompt, chosen.group(0), matches.index(chosen)


def cloze_accepted_answers(ru_plain: str, ru: str, word_index: int) -> list[str]:
    accepted = set()
    plain_words = list(re.finditer(r"[А-Яа-яЁё́]+", ru_plain))
    stressed_words = list(re.finditer(r"[А-Яа-яЁё́]+", ru))
    if word_index < 0:
        return []
    if word_index < len(plain_words):
        accepted.add(plain_words[word_index].group(0))
    if len(plain_words) == len(stressed_words) and word_index < len(stressed_words):
        accepted.add(stressed_words[word_index].group(0))
    if not accepted:
        return []
    return sorted(accepted)


def structures_for_item(item: dict) -> list[str]:
    structures = set(MODULE_STRUCTURES[item["module"]])
    tags = set(item.get("tags", []))
    if "greeting" in tags:
        structures.add("phrase:greeting")
    if "intro" in tags:
        structures.add("phrase:introduction")
    if "rescue" in tags:
        structures.add("phrase:repair")
    if "toast" in tags or "toast-vocab" in tags:
        structures.add("culture:toast_etiquette")
        structures.add("phrase:toast_za_accusative")
    if item.get("gender"):
        structures.add("morphology:gendered_short_form")
    if item.get("recognize"):
        structures.add("skill:listening_question_recognition")
    return sorted(structures)


def build_curriculum(course: dict, modules: list[dict], items: list[dict]) -> dict:
    default_lesson_id = course.get("curriculum", {}).get("default_lesson_id")
    lessons = []
    prior_lesson_id = None
    for idx, module in enumerate(modules, 1):
        lesson_id = f"family_visit_{idx:03d}"
        module_items = [i for i in items if i["module"] == module["id"]]
        active_vocab = sorted(
            {
                lexeme
                for item in module_items
                if not item.get("recognize")
                for lexeme in item.get("lexemes", [])
            }
        )
        passive_vocab = sorted(
            {
                lexeme
                for item in module_items
                if item.get("recognize")
                for lexeme in item.get("lexemes", [])
            }
        )
        structures = sorted(
            set(MODULE_STRUCTURES[module["id"]]).union(
                *(set(item.get("structures", [])) for item in module_items)
            )
        )
        errors = sorted(
            {
                error
                for item in module_items
                for error in item.get("allowed_error_types", [])
            }
        )
        lessons.append(
            {
                "lesson_id": lesson_id,
                "lesson_number": idx,
                "module": module["id"],
                "title": module["title"],
                "introduced_lexemes": sorted(
                    {
                        lexeme
                        for item in module_items
                        for lexeme in item.get("lexemes", [])
                    }
                ),
                "active_vocab": active_vocab,
                "passive_vocab": passive_vocab,
                "introduced_structures": structures,
                "allowed_error_types": errors,
                "prerequisites": [prior_lesson_id] if prior_lesson_id else [],
            }
        )
        prior_lesson_id = lesson_id
    lesson_ids = {lesson["lesson_id"] for lesson in lessons}
    if default_lesson_id not in lesson_ids:
        default_lesson_id = lessons[0]["lesson_id"] if lessons else ""
    return {
        "model": "lesson_locked_i_plus_1",
        "default_lesson_id": default_lesson_id,
        "lessons": lessons,
    }


def build_cloze_cards(items: list[dict]) -> list[dict]:
    cards = []
    for item in items:
        cloze = cloze_answer_for_phrase(item["ru_plain"])
        if not cloze:
            continue
        prompt_ru, answer, word_index = cloze
        cards.append(
            {
                "id": f"cloze_{item['id']}_01",
                "item_id": item["id"],
                "module": item["module"],
                "lesson_id": item["lesson_id"],
                "lesson_number": item["lesson_number"],
                "ru": item["ru"],
                "ru_plain": item["ru_plain"],
                "prompt_ru": prompt_ru,
                "answer": answer,
                "accepted_answers": cloze_accepted_answers(
                    item["ru_plain"], item["ru"], word_index
                ),
                "en": item["en"],
                "priority": item["priority"],
                "lexemes": item["lexemes"],
                "structures": item["structures"],
                "allowed_error_types": item["allowed_error_types"],
                "error_types": item["error_types"],
                "tags": sorted(set(item.get("tags", []) + ["cloze"])),
            }
        )
    return cards


def build_dictation_cards(items: list[dict]) -> list[dict]:
    cards = []
    for item in items:
        if item["syllables"] < 2:
            continue
        cards.append(
            {
                "id": f"dict_{item['id']}_01",
                "item_id": item["id"],
                "module": item["module"],
                "lesson_id": item["lesson_id"],
                "lesson_number": item["lesson_number"],
                "ru": item["ru"],
                "ru_plain": item["ru_plain"],
                "accepted_answers": sorted({item["ru_plain"], item["ru"]}),
                "en": item["en"],
                "priority": item["priority"],
                "lexemes": item["lexemes"],
                "structures": item["structures"],
                "allowed_error_types": sorted(
                    set(item["allowed_error_types"]).union(
                        {"listening_misparse", "stress", "vowel_reduction"}
                    )
                ),
                "error_types": sorted(
                    set(item["error_types"]).union(
                        {"listening_misparse", "stress", "vowel_reduction"}
                    )
                ),
                "tags": sorted(set(item.get("tags", []) + ["dictation"])),
            }
        )
    return cards


def build_stress_cards(items: list[dict]) -> list[dict]:
    cards = []
    for item in items:
        if item["syllables"] < 2 or ACUTE not in item["ru"]:
            continue
        vowel_indexes = stress_vowel_indexes(item["ru_plain"])
        correct = item["ru"]
        options = [correct]
        for idx in vowel_indexes:
            variant = stress_marked_variant(item["ru_plain"], idx)
            if variant != correct and variant not in options:
                options.append(variant)
            if len(options) >= 4:
                break
        if len(options) < 2:
            continue
        cards.append(
            {
                "id": f"stress_{item['id']}_01",
                "item_id": item["id"],
                "module": item["module"],
                "lesson_id": item["lesson_id"],
                "lesson_number": item["lesson_number"],
                "ru": item["ru"],
                "ru_plain": item["ru_plain"],
                "options": sorted(options),
                "answer": item["ru"],
                "en": item["en"],
                "priority": item["priority"],
                "lexemes": item["lexemes"],
                "structures": item["structures"],
                "allowed_error_types": sorted(
                    set(item["allowed_error_types"]).union({"stress", "forgot_phrase"})
                ),
                "error_types": sorted(
                    set(item["error_types"]).union({"stress", "forgot_phrase"})
                ),
                "tags": sorted(set(item.get("tags", []) + ["stress_drill"])),
            }
        )
    return cards


def build_pronunciation_cards(items: list[dict]) -> list[dict]:
    cards = []
    for item in items:
        if item["syllables"] < 2:
            continue
        cards.append(
            {
                "id": f"pron_{item['id']}_01",
                "item_id": item["id"],
                "module": item["module"],
                "lesson_id": item["lesson_id"],
                "lesson_number": item["lesson_number"],
                "ru": item["ru"],
                "ru_plain": item["ru_plain"],
                "en": item["en"],
                "priority": item["priority"],
                "lexemes": item["lexemes"],
                "structures": item["structures"],
                "practice_steps": [
                    "listen_native",
                    "record_self",
                    "playback_compare",
                    "self_rate",
                ],
                "feedback_targets": ["stress", "vowel_reduction"],
                "allowed_error_types": sorted(
                    set(item["allowed_error_types"]).union(
                        {"stress", "vowel_reduction", "forgot_phrase"}
                    )
                ),
                "error_types": sorted(
                    set(item["error_types"]).union(
                        {"stress", "vowel_reduction", "forgot_phrase"}
                    )
                ),
                "tags": sorted(set(item.get("tags", []) + ["pronunciation"])),
            }
        )
    return cards


def build_backtranslation_cards(items: list[dict]) -> list[dict]:
    cards = []
    for item in items:
        if item["syllables"] < 2:
            continue
        cards.append(
            {
                "id": f"back_{item['id']}_01",
                "item_id": item["id"],
                "module": item["module"],
                "lesson_id": item["lesson_id"],
                "lesson_number": item["lesson_number"],
                "ru": item["ru"],
                "ru_plain": item["ru_plain"],
                "accepted_answers": sorted({item["ru_plain"], item["ru"]}),
                "en": item["en"],
                "priority": item["priority"],
                "lexemes": item["lexemes"],
                "structures": item["structures"],
                "allowed_error_types": sorted(
                    set(item["allowed_error_types"]).union(
                        {"forgot_phrase", "case_or_inflection", "word_order"}
                    )
                ),
                "error_types": sorted(
                    set(item["error_types"]).union(
                        {"forgot_phrase", "case_or_inflection", "word_order"}
                    )
                ),
                "tags": sorted(set(item.get("tags", []) + ["back_translation"])),
            }
        )
    return cards


def lesson_boundary_snapshot(
    curriculum: dict, items: list[dict], lesson_number: int
) -> dict:
    unlocked_lessons = [
        lesson
        for lesson in curriculum.get("lessons", [])
        if lesson.get("lesson_number", 0) <= lesson_number
    ]
    return {
        "lesson_ids": [lesson["lesson_id"] for lesson in unlocked_lessons],
        "item_ids": [
            item["id"]
            for item in items
            if item.get("lesson_number", 0) <= lesson_number
        ],
        "active_vocab": sorted(
            set().union(
                *(set(lesson.get("active_vocab", [])) for lesson in unlocked_lessons)
            )
        ),
        "passive_vocab": sorted(
            set().union(
                *(set(lesson.get("passive_vocab", [])) for lesson in unlocked_lessons)
            )
        ),
        "structures": sorted(
            set().union(
                *(
                    set(lesson.get("introduced_structures", []))
                    for lesson in unlocked_lessons
                )
            )
        ),
    }


def build_tutor_cards(
    scenarios: list[dict], items: list[dict], curriculum: dict, course: dict
) -> list[dict]:
    item_by_id = {item["id"]: item for item in items}
    cards = []
    correction_policy = [
        "Minor error: recast briefly and continue the role-play.",
        "Repeated error: give one short rule, then return to Russian practice.",
        "High-stakes cultural, register, gender, or toast mistake: correct immediately.",
        "Communication-breaking error: clarify in English, provide the verified model, then retry.",
    ]
    for scenario in scenarios:
        required = [
            item_by_id[item_id] for item_id in scenario.get("required_items", [])
        ]
        if not required:
            continue
        boundary = lesson_boundary_snapshot(
            curriculum, items, scenario["lesson_number"]
        )
        required_phrase_lines = [
            f"- {item['ru_plain']} — {item['en']}" for item in required
        ]
        error_types = sorted(
            set().union(
                *(set(item.get("allowed_error_types", [])) for item in required)
            )
            | {"forgot_phrase", "register", "cultural_usage"}
        )
        prompt = "\n".join(
            [
                f"You are the AI tutor for {course['title']}.",
                f"Scenario: {scenario['setting']} — {scenario['goal']}",
                f"Curriculum boundary: Lesson {scenario['lesson_number']} only. Do not introduce Russian outside the unlocked vocabulary, structures, or verified phrases.",
                "Use short, warm Russian turns. Keep Joe speaking. Avoid long grammar lectures.",
                "Verified target phrases for this scenario:",
                *required_phrase_lines,
                "Correction policy:",
                *[f"- {rule}" for rule in correction_policy],
                "If you need a word outside the lesson boundary, say it in English and guide Joe back to one of the verified phrases.",
            ]
        )
        cards.append(
            {
                "id": f"tutor_{scenario['id']}",
                "scenario_id": scenario["id"],
                "lesson_id": scenario["lesson_id"],
                "lesson_number": scenario["lesson_number"],
                "setting": scenario["setting"],
                "goal": scenario["goal"],
                "learner_role": "guest",
                "tutor_role": "host family member",
                "required_items": scenario.get("required_items", []),
                "required_phrases": [
                    {
                        "id": item["id"],
                        "ru": item["ru"],
                        "ru_plain": item["ru_plain"],
                        "en": item["en"],
                    }
                    for item in required
                ],
                "success_criteria": scenario.get("success_criteria", []),
                "allowed_lesson_ids": boundary["lesson_ids"],
                "allowed_item_ids": boundary["item_ids"],
                "active_vocab": boundary["active_vocab"],
                "passive_vocab": boundary["passive_vocab"],
                "structures": boundary["structures"],
                "allowed_error_types": error_types,
                "correction_policy": correction_policy,
                "prompt": prompt,
            }
        )
    return cards


def build_contrast_cards(contrast_sets: list[dict], items: list[dict]) -> list[dict]:
    item_by_id = {item["id"]: item for item in items}
    cards = []
    for contrast in contrast_sets:
        contrast_items = [
            item_by_id[item_id]
            for item_id in contrast.get("items", [])
            if item_id in item_by_id
        ]
        if len(contrast_items) < 2:
            continue
        lesson_number = max(item["lesson_number"] for item in contrast_items)
        lesson_id = next(
            item["lesson_id"]
            for item in contrast_items
            if item["lesson_number"] == lesson_number
        )
        options = [
            {
                "id": item["id"],
                "ru": item["ru"],
                "ru_plain": item["ru_plain"],
                "en": item["en"],
            }
            for item in contrast_items
        ]
        for target in contrast_items:
            cards.append(
                {
                    "id": f"contrast_{contrast['id']}_{target['id']}",
                    "contrast_set_id": contrast["id"],
                    "item_id": target["id"],
                    "lesson_id": lesson_id,
                    "lesson_number": lesson_number,
                    "title": contrast["title"],
                    "risk": contrast.get("risk", "medium"),
                    "drill_type": contrast.get("drill_type", "choose_in_context"),
                    "prompt": target["en"],
                    "usage_note": contrast.get("usage_note", ""),
                    "options": options,
                    "answer_id": target["id"],
                    "ru": target["ru"],
                    "ru_plain": target["ru_plain"],
                    "en": target["en"],
                    "structures": sorted(
                        set().union(
                            *(set(item["structures"]) for item in contrast_items)
                        )
                    ),
                    "allowed_error_types": sorted(
                        set().union(
                            *(
                                set(item["allowed_error_types"])
                                for item in contrast_items
                            )
                        )
                        | {"cultural_usage", "register", "forgot_phrase"}
                    ),
                    "tags": sorted(set(["contrast", contrast["id"]])),
                }
            )
    return cards


def build_verb_drill_cards(items: list[dict]) -> list[dict]:
    cards = []
    for item in items:
        if item["module"] != "verbs":
            continue
        forms = [part.strip() for part in item["ru"].split("/")]
        plain_forms = [strip_stress(part) for part in forms]
        infinitive = ""
        if "—" in item["en"]:
            infinitive = item["en"].split("—", 1)[1].strip()
        if len(forms) < 2 or not infinitive:
            continue
        meanings = item["en"].split("—", 1)[0].split("/")
        meanings = [meaning.strip() for meaning in meanings]
        prompts = [
            ("ya", "я", forms[0], plain_forms[0], meanings[0] if meanings else ""),
            (
                "vy",
                "вы",
                forms[1],
                plain_forms[1],
                meanings[1] if len(meanings) > 1 else "",
            ),
        ]
        for pronoun_key, pronoun, answer, plain_answer, meaning in prompts:
            cards.append(
                {
                    "id": f"conj_{item['id']}_{pronoun_key}",
                    "item_id": item["id"],
                    "module": item["module"],
                    "lesson_id": item["lesson_id"],
                    "lesson_number": item["lesson_number"],
                    "ru": answer,
                    "ru_plain": plain_answer,
                    "en": f"{pronoun} + {infinitive}: {meaning or item['en']}",
                    "prompt": f"{pronoun} + {infinitive}",
                    "answer": plain_answer,
                    "accepted_answers": sorted({plain_answer, answer}),
                    "hint": f"Source verb card: {item['ru']}",
                    "priority": item["priority"],
                    "syllables": syllable_count(answer),
                    "conf": item["conf"],
                    "gender": item["gender"],
                    "rehearse": item["rehearse"],
                    "recognize": False,
                    "note": item.get("note", ""),
                    "tags": sorted(
                        set(item.get("tags", [])) | {"verb_drill", pronoun_key}
                    ),
                    "error_types": sorted(
                        set(item["error_types"]) | {"case_or_inflection"}
                    ),
                    "allowed_error_types": sorted(
                        set(item["allowed_error_types"]) | {"case_or_inflection"}
                    ),
                    "lexemes": lexemes_for_phrase(plain_answer),
                    "structures": sorted(
                        set(item["structures"]) | {"grammar:verb_conjugation"}
                    ),
                }
            )
    return cards


def build():
    course = load_course(os.environ.get("ZASTOLOM_COURSE", DEFAULT_COURSE_ID))
    mod_index = {m[0]: idx for idx, m in enumerate(MODULES)}
    modules = [
        {
            "id": mid,
            "title": title,
            "why": why,
            "priority": pri,
            "icon": icon,
            "order": idx,
        }
        for idx, (mid, title, why, pri, icon) in enumerate(MODULES)
    ]
    items = []
    seen = {}
    counters = {}
    for module, ru, en, hint, priority, flags in I:
        assert module in mod_index, f"unknown module {module}"
        n = counters.get(module, 0) + 1
        counters[module] = n
        iid = f"{module[:4]}{n:03d}"
        ru_nfc = unicodedata.normalize("NFC", ru)
        key = strip_stress(ru_nfc)
        if key in seen:
            raise SystemExit(f"DUPLICATE Russian item: {ru} (also {seen[key]})")
        seen[key] = iid
        item = {
            "id": iid,
            "module": module,
            "ru": ru_nfc,
            "ru_plain": strip_stress(ru_nfc),
            "en": en,
            "hint": hint,
            "priority": priority,
            "syllables": syllable_count(ru_nfc),
            "conf": flags.get("conf", "high"),
            "gender": flags.get("gender"),
            "rehearse": bool(flags.get("rehearse", False)),
            "recognize": bool(flags.get("recognize", False)),
            "note": flags.get("note", ""),
            "tags": flags.get("tags", []),
        }
        item["error_types"] = infer_error_types(item)
        item["allowed_error_types"] = item["error_types"]
        item["lexemes"] = lexemes_for_phrase(item["ru_plain"])
        item["structures"] = structures_for_item(item)
        item["stages"] = [
            "recognition",
            "recall",
            "listening",
            "production",
            "roleplay",
            "maintenance",
        ]
        items.append(item)
    curriculum = build_curriculum(course, modules, items)
    lesson_for_module = {
        lesson["module"]: lesson for lesson in curriculum.get("lessons", [])
    }
    for item in items:
        lesson = lesson_for_module[item["module"]]
        item["lesson_id"] = lesson["lesson_id"]
        item["lesson_number"] = lesson["lesson_number"]
        item["prerequisites"] = lesson["prerequisites"]
    item_by_id = {item["id"]: item for item in items}
    scenarios = []
    for scenario in SCENARIOS:
        enriched = dict(scenario)
        required = [
            item_by_id[item_id] for item_id in scenario.get("required_items", [])
        ]
        if required:
            lesson_number = max(item["lesson_number"] for item in required)
            lesson = next(
                l for l in curriculum["lessons"] if l["lesson_number"] == lesson_number
            )
            enriched["lesson_id"] = lesson["lesson_id"]
            enriched["lesson_number"] = lesson_number
        scenarios.append(enriched)
    cloze_cards = build_cloze_cards(items)
    dictation_cards = build_dictation_cards(items)
    stress_cards = build_stress_cards(items)
    pronunciation_cards = build_pronunciation_cards(items)
    backtranslation_cards = build_backtranslation_cards(items)
    tutor_cards = build_tutor_cards(scenarios, items, curriculum, course)
    contrast_cards = build_contrast_cards(CONTRAST_SETS, items)
    verb_drill_cards = build_verb_drill_cards(items)
    data = {
        "course": course,
        "meta": {
            "title": course["title"],
            "goal": course["mission"]["performance_goal"],
            "generated_from": "scripts/build_content.py",
            "course_source": f"courses/{course['course_id']}/course.yaml",
            "source": "source/research/verified_phrases.md",
            "stress_marks": "Unicode combining acute U+0301; ru_plain is stress-stripped for TTS.",
            "counts": {m: counters.get(m, 0) for m in mod_index},
            "total_items": len(items),
        },
        "curriculum": curriculum,
        "modules": modules,
        "items": items,
        "cloze_cards": cloze_cards,
        "dictation_cards": dictation_cards,
        "stress_cards": stress_cards,
        "pronunciation_cards": pronunciation_cards,
        "backtranslation_cards": backtranslation_cards,
        "tutor_cards": tutor_cards,
        "contrast_cards": contrast_cards,
        "verb_drill_cards": verb_drill_cards,
        "error_types": ERROR_TYPES,
        "listening_ladder": LISTENING_LADDER,
        "roleplay_criteria": ROLEPLAY_CRITERIA,
        "contrast_sets": CONTRAST_SETS,
        "scenarios": scenarios,
    }
    out = os.path.join(ROOT, "content", "content.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"wrote {out}")
    # Also emit an embedded JS copy so the web app works offline / on file://
    # with no fetch/CORS dependency.
    web_out = os.path.join(ROOT, "web", "content.js")
    os.makedirs(os.path.dirname(web_out), exist_ok=True)
    with open(web_out, "w", encoding="utf-8") as f:
        f.write(
            "/* AUTO-GENERATED by scripts/build_content.py — do not edit by hand. */\n"
        )
        f.write("window.CONTENT_DATA = ")
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write(";\n")
    print(f"wrote {web_out}")
    print(f"total items: {len(items)}")
    for m in MODULES:
        print(f"  {m[0]:14s} {counters.get(m[0], 0):3d}  — {m[1]}")
    rehearse = [it["ru"] for it in items if it["rehearse"]]
    print(f"rehearse-with-Kadriya: {len(rehearse)} -> {', '.join(rehearse)}")


if __name__ == "__main__":
    build()
