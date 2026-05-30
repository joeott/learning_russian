#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate printable/cheatsheet.html from content/content.json.

A 2-page, print-optimized "table survival sheet": Cyrillic + stress marks,
English, pronunciation hints, grouped by module, with toasting etiquette and
the rescue phrases up top. Print to PDF (Letter/A4) — fits ~2 pages.

    python3 scripts/build_cheatsheet.py
"""

import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ACUTE = "́"


def esc(s):
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def color_stress(ru):
    return re.sub("(.)" + ACUTE, r'<b class="s">\1' + ACUTE + "</b>", esc(ru))


def main():
    data = json.load(
        open(os.path.join(ROOT, "content", "content.json"), encoding="utf-8")
    )
    mods = {m["id"]: m for m in data["modules"]}
    by_mod = {m["id"]: [] for m in data["modules"]}
    for it in data["items"]:
        by_mod[it["module"]].append(it)

    # ordering for the sheet: doorway-first
    order = [
        "first_contact",
        "politeness",
        "toasts",
        "family",
        "food",
        "smalltalk",
        "listening",
        "verbs",
    ]

    def row(it):
        flags = []
        if it["gender"] == "m":
            flags.append('<span class="fl">♂</span>')
        if it["rehearse"]:
            flags.append('<span class="fl fl--r">★</span>')
        if it["recognize"]:
            flags.append('<span class="fl fl--l">👂</span>')
        flag = " ".join(flags)
        hint = f'<span class="hint">{esc(it["hint"])}</span>' if it["hint"] else ""
        return (
            f'<div class="row">'
            f'<div class="ru">{color_stress(it["ru"])} {flag}</div>'
            f'<div class="en">{esc(it["en"])} {hint}</div>'
            f"</div>"
        )

    blocks = []
    for mid in order:
        m = mods[mid]
        rows = "".join(row(it) for it in by_mod[mid])
        blocks.append(
            f'<section class="mod"><h2><span class="ic">{m["icon"]}</span>{esc(m["title"])}'
            f'<span class="p p{m["priority"]}">P{m["priority"]}</span></h2>{rows}</section>'
        )

    html = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>За столо́м — Table Survival Sheet</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=PT+Serif:wght@400;700&family=PT+Sans:wght@400;700&display=swap" rel="stylesheet">
<style>
:root{{--ink:#20140f;--red:#7d1416;--amber:#b6781a;--line:#cdbd99;--paper:#fbf6ea;}}
*{{box-sizing:border-box;}}
html,body{{margin:0;background:#e7dcc2;color:var(--ink);font-family:"PT Sans",sans-serif;}}
.page{{width:8.5in;min-height:11in;margin:14px auto;background:var(--paper);padding:0.5in 0.5in 0.4in;box-shadow:0 4px 18px rgba(0,0,0,.2);}}
header{{border-bottom:3px solid var(--ink);padding-bottom:6px;margin-bottom:10px;display:flex;align-items:baseline;gap:10px;}}
header h1{{font-family:"Oswald";text-transform:uppercase;letter-spacing:.04em;font-size:23px;margin:0;color:var(--red);}}
header .sub{{font-family:"Oswald";font-weight:300;letter-spacing:.16em;text-transform:uppercase;font-size:9px;color:var(--ink);}}
header .cd{{margin-left:auto;font-family:"Oswald";font-weight:600;font-size:10px;text-transform:uppercase;border:1.5px solid var(--ink);padding:3px 8px;}}
.rescue{{background:#f1e7cf;border:2px solid var(--ink);border-left:6px solid var(--red);padding:7px 10px;margin-bottom:10px;font-size:11px;}}
.rescue b{{color:var(--red);}}
.grid{{column-count:2;column-gap:18px;}}
.mod{{break-inside:avoid;margin-bottom:9px;}}
.mod h2{{font-family:"Oswald";text-transform:uppercase;letter-spacing:.03em;font-size:12.5px;margin:0 0 3px;border-bottom:1.5px solid var(--ink);padding-bottom:2px;display:flex;align-items:center;gap:5px;}}
.mod h2 .ic{{font-size:13px;}}
.p{{margin-left:auto;font-size:8px;font-weight:600;padding:1px 5px;border:1px solid var(--ink);border-radius:8px;}}
.p1{{background:var(--red);color:#fff;}} .p2{{background:var(--amber);color:#fff;}} .p3{{background:transparent;}}
.row{{display:flex;justify-content:space-between;gap:8px;padding:1.5px 0;border-bottom:1px dotted var(--line);break-inside:avoid;}}
.ru{{font-family:"PT Serif";font-weight:700;font-size:12.5px;white-space:nowrap;}}
.ru .s{{color:var(--red);}}
.en{{font-size:10px;text-align:right;color:#3a2c22;}}
.en .hint{{display:block;font-size:8.5px;color:#7a6a58;font-style:italic;}}
.fl{{font-size:8px;}} .fl--r{{color:var(--red);}}
.culture{{margin-top:6px;}}
.culture h2{{font-family:"Oswald";text-transform:uppercase;font-size:12.5px;border-bottom:1.5px solid var(--ink);padding-bottom:2px;margin:0 0 4px;}}
.culture ul{{margin:0;padding-left:16px;font-size:10px;column-count:2;column-gap:18px;}}
.culture li{{margin-bottom:2px;break-inside:avoid;}}
.legend{{font-size:8.5px;color:#6a5a48;margin-top:6px;text-align:center;font-family:"Oswald";letter-spacing:.04em;text-transform:uppercase;}}
@media print{{
  html,body{{background:#fff;}}
  .page{{margin:0;box-shadow:none;width:auto;min-height:auto;padding:0.4in;}}
  @page{{size:Letter;margin:0.35in;}}
  *{{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
}}
.toolbar{{text-align:center;margin:10px;}}
.toolbar button{{font-family:"Oswald";text-transform:uppercase;letter-spacing:.06em;font-weight:600;background:var(--red);color:#fff;border:none;padding:9px 18px;border-radius:3px;cursor:pointer;}}
@media print{{.toolbar{{display:none;}}}}
</style></head>
<body>
<div class="toolbar"><button onclick="window.print()">🖨️ Print / Save as PDF</button></div>
<div class="page">
  <header>
    <h1>За столо́м</h1><span class="sub">table survival sheet · for Kadriya's family</span>
    <span class="cd">15 June</span>
  </header>
  <div class="rescue">
    <b>If you're lost, say:</b> &nbsp; <b>Я ещё учу́ ру́сский</b> (I'm still learning) ·
    <b>Поме́дленнее, пожа́луйста</b> (slower, please) ·
    <b>Повтори́те, пожа́луйста</b> (repeat please) ·
    <b>Я не понима́ю</b> (I don't understand). &nbsp; Smile, use <b>вы</b> + name &amp; patronymic with elders.
  </div>
  <div class="grid">
    {"".join(blocks)}
    <section class="culture">
      <h2>🥂 At the table</h2>
      <ul>
        <li><b>Toasts</b> = «За + …»: <b>За встре́чу!</b>, <b>За ва́ше здоро́вье!</b> — never «На здоровье» (that's a reply to <i>thanks</i>).</li>
        <li><b>Clink glasses</b> at a happy dinner; the no-clink rule is only for memorial toasts.</li>
        <li><b>Eye contact</b> when you clink and when you toast.</li>
        <li><b>«До дна́»</b> (bottoms-up) isn't required every time — pace yourself; eat a bite after vodka.</li>
        <li><b>Shoes off</b> at the door; hosts offer <b>та́почки</b> (slippers).</li>
        <li><b>Flowers?</b> an <b>odd</b> number only (even = funerals).</li>
        <li><b>Compliment the cook:</b> <b>О́чень вку́сно!</b> / <b>Спаси́бо, бы́ло о́чень вку́сно.</b></li>
        <li><b>You are the зять</b> (son-in-law); her parents are your <b>тесть</b> &amp; <b>тёща</b>.</li>
      </ul>
    </section>
  </div>
  <div class="legend">red = stressed syllable &nbsp;·&nbsp; ♂ = male form &nbsp;·&nbsp; 👂 = understand by ear &nbsp;·&nbsp; ★ = rehearse with Kadriya</div>
</div>
</body></html>
"""
    out = os.path.join(ROOT, "printable", "cheatsheet.html")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w", encoding="utf-8").write(html)
    print(f"wrote {out} ({len(html)} bytes, {len(data['items'])} items)")


if __name__ == "__main__":
    main()
