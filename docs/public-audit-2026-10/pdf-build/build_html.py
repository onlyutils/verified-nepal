import html, json, re, sys
from pathlib import Path
import markdown
from markdown.extensions.toc import slugify as _slug
import figs as F

ROOT = Path("/home/lxu/workspace/laxman/verifiednepal/docs/public-audit-2026-10")
SHOTS = ROOT / "research_notes/Nepali online news audience/screenshots"
OUT = Path(sys.argv[1])
PAGES = json.loads(Path(sys.argv[2]).read_text()) if len(sys.argv) > 2 else {}

PARTS = [
    dict(key="p1", eyebrow="Part 1 of 3", short="Part 1", file="reports/1-nepali-audience-research.md"),
    dict(key="p2", eyebrow="Part 2 of 3", short="Part 2", file="reports/2-ideal-nepali-information-portal.md"),
    dict(key="p3", eyebrow="Part 3 of 3", short="Part 3", file="reports/3-verified-nepal-alignment-audit.md"),
    dict(key="a1", eyebrow="Appendix A", short="Appendix A", file="council-verdict.md"),
]
TAG = re.compile(r"(<[^>]+>)")

def linkify(frag):
    out, in_a = [], 0
    for tok in TAG.split(frag):
        if tok.startswith("<"):
            low = tok.lower()
            if low.startswith("<a "): in_a += 1
            elif low.startswith("</a"): in_a = max(0, in_a - 1)
            out.append(tok); continue
        if in_a: out.append(tok); continue
        tok = re.sub(r"\[(\d{1,3})\]", r'<span class="cite">[\1]</span>', tok)
        def url(m):
            u = m.group(0); tail = ""
            while u and u[-1] in ".,;:)": tail = u[-1] + tail; u = u[:-1]
            return f'<a href="{u}">{u}</a>{tail}'
        tok = re.sub(r"https?://[^\s<>\"]+", url, tok)
        out.append(tok)
    return "".join(out)

# ---- figure insertion helpers (operate on the converted HTML of one part)
def _heading(body, level, pattern):
    m = re.search(rf"<h{level}[^>]*>\s*(?:<[^>]+>)*\s*{pattern}", body)
    if not m: raise SystemExit(f"heading not found: {pattern}")
    return m
def after_p(body, level, pattern, fig, n=1):
    m = _heading(body, level, pattern); pos = m.end()
    for _ in range(n):
        i = body.index("</p>", pos); pos = i + 4
    return body[:pos] + fig + body[pos:]
def after_heading(body, level, pattern, fig):
    m = _heading(body, level, pattern); i = body.index(f"</h{level}>", m.end()) + 5
    return body[:i] + fig + body[i:]
def before_next_h2(body, level, pattern, fig):
    m = _heading(body, level, pattern); i = body.index("<h2", m.end())
    return body[:i] + fig + body[i:]
def after_table(body, level, pattern, fig):
    m = _heading(body, level, pattern); i = body.index("</table></div>", m.end()) + len("</table></div>")
    return body[:i] + fig + body[i:]

def decorate(key, body):
    if key == "p1":
        h1 = body.index("</h1>")
        # BLUF is the 2nd paragraph after the H1
        i = h1
        for _ in range(2): i = body.index("</p>", i) + 4
        body = body[:i] + F.fig_seat() + body[i:]
        body = after_heading(body, 2, "Half of Nepal is online", F.fig_online())
        body = after_p(body, 2, "Half of Nepal is online", F.fig_gaps(), n=2)
        body = after_p(body, 2, "Platforms carry discovery", F.fig_sources(), n=1)
        body = after_p(body, 2, "Platforms carry discovery", F.fig_trust(), n=3)
        body = after_p(body, 2, "Readers want Mukta", F.fig_anatomy(), n=1)
        body = after_p(body, 2, "Portals win by habit", F.fig_traffic(), n=1)
        body = after_p(body, 2, "In disasters the first", F.fig_timeline(), n=2)
        body = after_p(body, 2, "Nine personas", F.fig_personas(), n=1)
    elif key == "p2":
        body = after_p(body, 2, r"1\. Executive summary", F.fig_phone(), n=1)
        body = after_p(body, 2, r"3\. The ideal, by layer", F.fig_layers(), n=1)
    elif key == "p3":
        body = after_p(body, 2, r"1\. Executive summary", F.fig_empty(), n=1)
        body = after_table(body, 2, r"1\. Executive summary", F.fig_score())
        body = after_p(body, 3, r"2\.6 Performance", F.fig_weight(), n=1)
        body = before_next_h2(body, 2, r"4\. The reader", F.gallery(SHOTS))
        body = after_p(body, 2, r"6\. The council", F.fig_road(), n=1)
    elif key == "a1":
        body = after_p(body, 1, r"Council verdict", F.fig_council(), n=1)
    return body

def convert(part):
    md = markdown.Markdown(extensions=["tables", "sane_lists", "toc"],
        extension_configs={"toc": {"slugify": lambda v, s, k=part["key"]: k + "-" + _slug(v, s), "toc_depth": "1-3"}})
    body = md.convert((ROOT / part["file"]).read_text(encoding="utf-8"))
    body = re.sub(r"(<h1[^>]*>)\s*Report \d\s*[:\u2014\-]\s*", r"\1", body, count=1)
    h1 = md.toc_tokens[0]
    part["title"] = re.sub(r"^Report \d\s*[:\u2014\-]\s*", "", html.unescape(h1["name"])); part["h1id"] = h1["id"]
    part["h2"] = [(c["id"], html.unescape(c["name"])) for c in h1["children"]]
    m = list(re.finditer(r"<h[23][^>]*>\s*(?:\d+\.\d*\s*)?References[^<]*</h[23]>", body, re.I))
    if m:
        i = m[-1].end(); body = body[:i] + '<div class="refs">' + body[i:] + "</div>"
    body = re.sub(r"<table>(\s*<thead>\s*<tr>\s*<th>#</th>)", r'<table class="num1">\1', body)
    body = body.replace("<table", '<div class="tw"><table').replace("</table>", "</table></div>")
    body = decorate(part["key"], body)
    body = re.sub(r"(<h1 )", f'<div class="eyebrow">{part["eyebrow"]}</div><h1 ', body, count=1)
    part["html"] = linkify(body)

for p in PARTS: convert(p)

def pg(key):
    v = PAGES.get(key); return str(v) if v else "&nbsp;"
toc_rows = []
for p in PARTS:
    toc_rows.append(f'<tr class="tp"><td class="tl"><a href="#{p["h1id"]}"><span class="pn">{p["short"]}</span> {html.escape(p["title"])}</a></td><td class="tn">{pg(p["h1id"])}</td></tr>')
    for hid, name in p["h2"]:
        toc_rows.append(f'<tr class="t2"><td class="tl"><a href="#{hid}">{html.escape(name)}</a></td><td class="tn">{pg(hid)}</td></tr>')

CSS = (Path(__file__).parent / "style.css").read_text()
glance_tiles = F.tiles([("56%", "of Nepalis are online, and growth has stalled"), ("62%", "use Facebook for news"),
                        ("3% / 8%", "trust social media / online portals"), ("0", "published articles, stories or ledger rows on the live site, 14 October")], cols=4)

doc = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Verified Nepal: public-site audit, October 2026</title><style>{CSS}</style></head><body>
<section class="cover">
  <div class="bar"><i></i><i></i></div>
  <div class="eyebrow">Verified Nepal &middot; Public-site audit</div>
  <div class="cover-title">How Nepal reads, and whether Verified Nepal meets it</div>
  <p class="cover-sub">Three reports on how Nepali audiences consume news and civic information online, what an ideal Nepali public-information portal looks like, and how the public side of verifiednepal.com measures up. The admin and moderator tools are out of scope.</p>
  <table class="meta">
    <tr><th>Date</th><td>14 October 2026</td></tr>
    <tr><th>Subject</th><td>verifiednepal.com, public pages only</td></tr>
    <tr><th>Method</th><td>Six web-research tracks and a code and live-site inventory, then a five-advisor review council with anonymised peer review and a chairman verdict</td></tr>
    <tr><th>Status</th><td>Draft for independent review</td></tr>
  </table>
  <div class="ph" style="margin-top:6px">In this document</div>
  <table class="pkg">
    <tr><td class="k">Part 1</td><td><b>Audience research.</b> Who reads what in Nepal, on which device and platform, whom they trust, what annoys them, how portals gain traction, and the pain points and open questions of nine personas. 165 numbered references.</td></tr>
    <tr><td class="k">Part 2</td><td><b>The ideal portal.</b> Design principles and twelve layers, with a persona scorecard and a list of what the ideal deliberately does not do.</td></tr>
    <tr><td class="k">Part 3</td><td><b>Verified Nepal today.</b> A layer-by-layer alignment audit with file and live-site evidence, a screenshot gallery, quick wins and legal notes.</td></tr>
    <tr><td class="k">Appendix A</td><td><b>Council verdict.</b> Where five independent advisors agreed, clashed and caught blind spots.</td></tr>
  </table>
  <p style="font-size:8.6pt;color:#4a5263;margin:8px 0 0">Reference numbers in square brackets are local to each part: Part 1 has 165 references and Part 2 has its own list. Part 3 cites repository files and live checks.</p>
  <div class="mount">{F.mountains()}</div>
</section>

<section class="glance">
  <div class="ph">The short version</div>
  {glance_tiles}
  <div class="cols" style="margin-top:10px">
  <div class="card"><div class="ch">The audience</div><p>About 16.6 million Nepalis are online. Facebook is the news layer for 62% of them, and for 82.6% of 16 to 24 year olds. Only 3% trust social media and 8% trust online portals. When something goes viral, people wait for a radio or TV bulletin to check it. <span class="src">Part 1</span></p></div>
  <div class="card"><div class="ch">The open role</div><p>Facebook already owns discovery. The open seat is verification: fast, sourced, light enough for a mid-range Android on evening 4G, and honest about what is still unconfirmed. <span class="src">Parts 1 and 2</span></p></div>
  <div class="card"><div class="ch">The ideal</div><p>A Nepali-first checked record: short items that are dated, placed down to the ward and linked to their source, with a permanent address, two clear status labels, and share cards built for Facebook, Viber and WhatsApp. Not a 101st news portal. <span class="src">Part 2</span></p></div>
  <div class="card good"><div class="ch">What Verified Nepal already has</div><p>A trust skeleton that is rarer than the gaps: no ads, no login to read, hotlines on every page, mandatory source lines, a public ledger, audit log and 3W export, a stated no-money principle, matching English and Nepali strings, and large touch targets. <span class="src">Part 3</span></p></div>
  <div class="card bad"><div class="ch">Where it falls short</div><p>On 14 October the live site had no published articles, stories, projects, centres, incidents, ledger rows or audit entries. The home page is still built around the August 2026 flood and shows a six-week-old snapshot under a &ldquo;Live&rdquo; label. It is English by default, has no Bikram Sambat date, no RSS feed and no Viber share, and uses &ldquo;verified&rdquo; in five senses. <span class="src">Part 3</span></p></div>
  <div class="card key"><div class="ch">The one thing to do first</div><p>Replace the hard-wired August block on the home page with a dated, sourced &ldquo;Now&rdquo; strip, fed from what the site already ingests, one row per item with place, source link and relative time. <span class="src">Appendix A</span></p></div>
  </div>
  <div class="limits"><b>Limits of the evidence.</b> Reddit blocked the research environment, so the Reddit sample is nine threads taken from an archive. The ward-level relief hook rests on one Kathmandu Post report. No national media survey after September 2025 was found. Registration, advertising and legal points come from news reports and law-firm summaries, not official texts, and should be confirmed with the Department of Information and Broadcasting.</div>
</section>

<section class="toc"><div class="ph">Contents</div><table class="toct">{''.join(toc_rows)}</table></section>

{''.join(f'<section class="part" id="{p["key"]}">' + p["html"] + '</section>' for p in PARTS)}
</body></html>"""
OUT.write_text(doc, encoding="utf-8")
heads = []
for p in PARTS:
    heads.append(dict(id=p["h1id"], text=p["title"]))
    for hid, name in p["h2"]: heads.append(dict(id=hid, text=name))
OUT.with_suffix(".heads.json").write_text(json.dumps(heads))
print("html ok", OUT.stat().st_size, "bytes;", len(heads), "headings")
