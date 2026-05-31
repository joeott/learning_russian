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


def lexemes_for_phrase(ru_plain: str) -> list[str]:
    phrase = ru_plain.lower().strip()
    tokens = re.findall(r"[а-яё]+", phrase, flags=re.IGNORECASE)
    lexemes = set(tokens)
    if " " in phrase:
        lexemes.add(phrase)
    return sorted(lexemes)


def cloze_answer_for_phrase(ru_plain: str) -> tuple[str, str] | None:
    skip = {"джо"}
    matches = list(re.finditer(r"[А-Яа-яЁё]+", ru_plain))
    candidates = [
        m for m in matches if len(m.group(0)) >= 3 and m.group(0).lower() not in skip
    ]
    if len(matches) < 2 or not candidates:
        return None
    chosen = max(candidates, key=lambda m: (len(m.group(0)), -m.start()))
    prompt = ru_plain[: chosen.start()] + "____" + ru_plain[chosen.end() :]
    return prompt, chosen.group(0)


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
        default_lesson_id = lessons[-1]["lesson_id"] if lessons else ""
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
        prompt_ru, answer = cloze
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
                "accepted_answers": [answer],
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
                "accepted_answers": [item["ru_plain"]],
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
        "error_types": ERROR_TYPES,
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
