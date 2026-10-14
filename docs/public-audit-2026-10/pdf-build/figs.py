"""Static SVG/HTML figures for the audit PDF. All numbers come from the three reports."""
import html, textwrap
E = html.escape
INK, INK2, MUT, GRID = "#1b1f2a", "#4a5263", "#7b8494", "#d9dee7"
BLUE, BLUED, BLUEL, ORG = "#2a78d6", "#184f95", "#cde2fb", "#eb6834"
NAVY, CRIM, GREY, PALE = "#14284b", "#c8102e", "#9aa6b8", "#f1f4f9"
GOOD, WARN, CRIT, ABS = "#0ca30c", "#fab219", "#d03b3b", "#6b7280"

def T(x, y, s, size=11, fill=INK, anchor="start", weight=400, extra=""):
    return (f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" text-anchor="{anchor}" '
            f'font-weight="{weight}" {extra}>{E(s)}</text>')

def lines(x, y, s, width, size=10, fill=INK2, lh=None, weight=400, anchor="start"):
    lh = lh or size * 1.4
    out = []
    for i, ln in enumerate(textwrap.wrap(s, width)):
        out.append(T(x, y + i * lh, ln, size, fill, anchor, weight))
    return "".join(out), len(out) * lh

def rrect(x, y, w, h, r=6, fill="#fff", stroke="none", sw=1, extra=""):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>'

def hbar_path(x, y, w, h, r=4):
    w = max(w, 0.5); r = min(r, w, h / 2)
    return (f"M{x},{y} H{x+w-r} Q{x+w},{y} {x+w},{y+r} V{y+h-r} Q{x+w},{y+h} {x+w-r},{y+h} H{x} Z")

def svg(w, h, body, label):
    return (f'<svg viewBox="0 0 {w} {h}" width="100%" role="img" aria-label="{E(label)}" '
            f'xmlns="http://www.w3.org/2000/svg">{body}</svg>')

def figure(title, body, source, cls=""):
    return (f'<figure class="fig {cls}"><figcaption class="fh"><span class="fn"></span> {E(title)}</figcaption>'
            f'{body}<div class="fs">{source}</div></figure>')

# ---------------------------------------------------------------- generic horizontal bars
def hbars(items, W=660, label_w=250, maxv=100, fmt=lambda v: f"{v:g}%", bar_h=16, step=28, ticks=None, ticklabel=None):
    """items: ('g', title) | ('b', label, value, color) | ('r', label, lo, hi, color, text)"""
    x0 = label_w + 10
    x1 = W - 60
    sc = (x1 - x0) / maxv
    y = 8
    body, grid = [], []
    for it in items:
        if it[0] == "g":
            y += 8
            body.append(T(0, y + 10, it[1].upper(), 9, MUT, weight=700, extra='letter-spacing="0.8"'))
            y += 20
            continue
        label = it[1]
        lab, _ = lines(0, y + bar_h - 4, label, int(label_w / 6.1), 11, INK)
        body.append(lab)
        if it[0] == "b":
            _, _, v, col = it
            body.append(f'<path d="{hbar_path(x0, y, v*sc, bar_h)}" fill="{col}"/>')
            body.append(T(x0 + v * sc + 6, y + bar_h - 4, fmt(v), 11, INK, weight=600))
        else:
            _, _, lo, hi, col, txt = it
            body.append(f'<path d="{hbar_path(x0, y, hi*sc, bar_h)}" fill="{col}" fill-opacity="0.35"/>')
            body.append(f'<rect x="{x0}" y="{y}" width="{lo*sc}" height="{bar_h}" fill="{col}"/>')
            body.append(T(x0 + hi * sc + 6, y + bar_h - 4, txt, 11, INK, weight=600))
        y += step
    H = y + (22 if ticks else 4)
    axis = f'<line x1="{x0}" y1="0" x2="{x0}" y2="{y-6}" stroke="{GRID}" stroke-width="1"/>'
    if ticks:
        for t in ticks:
            xx = x0 + t * sc
            grid.append(f'<line x1="{xx}" y1="0" x2="{xx}" y2="{y-6}" stroke="{GRID}" stroke-width="1"/>')
            grid.append(T(xx, y + 10, (ticklabel or str)(t), 9, MUT, "middle"))
    return "".join(grid) + axis + "".join(body), H

# ---------------------------------------------------------------- Figure: where news comes from (dumbbell)
def fig_sources():
    rows = [("Facebook", 21, 41), ("YouTube", 4, 15), ("Radio", 44, 26), ("Television", 47, 31)]
    W, x0, x1 = 660, 120, 540
    sc = (x1 - x0) / 50
    b = []
    # legend
    lx = 120
    for col, txt, w in [(GREY, "2020", 60), (BLUE, "2022, rose", 100), (ORG, "2022, fell", 100)]:
        b.append(f'<circle cx="{lx}" cy="14" r="5" fill="{col}"/>')
        b.append(T(lx + 10, 18, txt, 10.5, INK2))
        lx += w + 20
    y = 56
    for t in range(0, 51, 10):
        xx = x0 + t * sc
        b.append(f'<line x1="{xx}" y1="40" x2="{xx}" y2="{56+len(rows)*44-14}" stroke="{GRID}"/>')
        b.append(T(xx, 56 + len(rows) * 44, f"{t}%", 9, MUT, "middle"))
    for name, a, c in rows:
        col = BLUE if c > a else ORG
        xa, xc = x0 + a * sc, x0 + c * sc
        b.append(T(0, y + 4, name, 12, INK, weight=600))
        b.append(f'<line x1="{xa}" y1="{y}" x2="{xc}" y2="{y}" stroke="{col}" stroke-width="2.5" stroke-linecap="round"/>')
        b.append(f'<circle cx="{xa}" cy="{y}" r="6" fill="{GREY}" stroke="#fff" stroke-width="2"/>')
        b.append(f'<circle cx="{xc}" cy="{y}" r="6" fill="{col}" stroke="#fff" stroke-width="2"/>')
        b.append(T(max(xa, xc) + 14, y + 4, f"{a}% to {c}%", 11, INK, weight=600))
        y += 44
    return figure("Facebook doubled as the main source of local news in two years while radio and TV lost ground",
        svg(W, y + 6, "".join(b), "Dumbbell chart of primary local news source, 2020 versus 2022"),
        "Share of people naming each as their main source of local news. Nepal Media Survey, 2020 and 2022 rounds. Part 1, reference 9.")

# ---------------------------------------------------------------- Figure: trust vs exposure
def fig_trust():
    items = [("g", "Who people trust"),
             ("b", "Social media", 3, BLUE),
             ("b", "Online news portals", 8, BLUE),
             ("b", "TV, radio and print (about one third)", 33, BLUE),
             ("g", "What people see and fear"),
             ("b", "Saw misinformation in the past week", 67, ORG),
             ("b", "Concerned about misinformation", 81, ORG)]
    body, H = hbars(items, W=660, label_w=250, maxv=100, ticks=[0, 25, 50, 75, 100], ticklabel=lambda t: f"{t}%")
    return figure("Almost nobody trusts what they read online, yet two thirds saw misinformation last week",
        svg(660, H, body, "Bar chart of trust levels and misinformation exposure"),
        "Trust: Nepal Media Survey 2022 (social media 3%, online portals 8%, legacy media about one third). Misinformation: CMR Nepal 2024. Part 1, references 11 and 22.")

# ---------------------------------------------------------------- Figure: who reads news on a device
def fig_gaps():
    items = [("g", "By education"),
             ("b", "Higher-educated respondents", 83.3, BLUE),
             ("b", "Illiterate respondents", 13.1, BLUE),
             ("g", "By province"),
             ("b", "Gandaki", 69.5, BLUE),
             ("b", "Madhesh", 19.9, BLUE)]
    body, H = hbars(items, W=660, label_w=250, maxv=100, fmt=lambda v: f"{v:g}%", ticks=[0, 25, 50, 75, 100], ticklabel=lambda t: f"{t}%")
    return figure("The online news reader is educated and urban; everyone else is reached by video and audio",
        svg(660, H, body, "Bar chart of digital news consumption by education and province"),
        "Share who consume news digitally (education) or read news on a device among internet users (province). Nepal Media Survey 2024. Part 1, reference 8.")

# ---------------------------------------------------------------- Figure: portal traffic
def fig_traffic():
    items = [("b", "Onlinekhabar", 6.8, BLUE), ("b", "Hamro Patro", 3.5, BLUE),
             ("b", "Setopati", 2.2, BLUE), ("b", "eKantipur", 1.4, BLUE)]
    body, H = hbars(items, W=400, label_w=110, maxv=8, fmt=lambda v: f"{v:.1f}M", ticks=[0, 2, 4, 6, 8], ticklabel=lambda t: f"{t}M")
    left = svg(400, H, body, "Bar chart of visits to the top Nepali portals")
    # columns: crisis spike
    cb = []
    base, top = 150, 150 * 6.39 / 7
    h1, h2 = 6.39 / 7 * 120, 3.27 / 7 * 120
    for i, (lab, v, h, col) in enumerate([("Sep 2025", "6.39M", h1, ORG), ("Nov 2025", "3.27M", h2, BLUE)]):
        x = 40 + i * 100
        cb.append(f'<path d="M{x},{base} V{base-h+4} Q{x},{base-h} {x+4},{base-h} H{x+44} Q{x+48},{base-h} {x+48},{base-h+4} V{base} Z" fill="{col}"/>')
        cb.append(T(x + 24, base - h - 6, v, 11, INK, "middle", 600))
        cb.append(T(x + 24, base + 16, lab, 10, INK2, "middle"))
    cb.append(f'<line x1="20" y1="{base}" x2="220" y2="{base}" stroke="{GRID}"/>')
    cb.append(T(120, 14, "Onlinekhabar, estimated monthly visits", 10, MUT, "middle", 700))
    right = svg(240, 180, "".join(cb), "Column chart of Onlinekhabar visits in protest month versus November")
    return figure("A handful of portals dominate, and traffic doubles in a crisis month",
        f'<div class="two"><div class="l">{left}<div class="sub">Visits over the trailing three months, Sept 2026</div></div><div class="r">{right}</div></div>',
        "Similarweb free-tier estimates. Between 69% and 83% of desktop visits to the three big news portals arrive as 'direct', not from search or social. Part 1, references 24 to 28.")

# ---------------------------------------------------------------- Figure: first hour of the Aug 2026 flood
def fig_timeline():
    W = 660; x0, x1 = 40, 620
    def xp(m): return x0 + (m - 0) * (x1 - x0) / 50   # minutes after 8:30
    b = [f'<line x1="{x0}" y1="64" x2="{x1}" y2="64" stroke="{GREY}" stroke-width="3" stroke-linecap="round"/>']
    pts = [(7, "8:37", "Collapse registered", BLUE), (20, "8:50", "Syabrubesi gauge swept away", BLUE), (45, "9:15", "SMS alert to four districts", ORG)]
    for m, t, lab, col in pts:
        x = xp(m)
        b.append(f'<circle cx="{x}" cy="64" r="7" fill="{col}" stroke="#fff" stroke-width="2"/>')
        b.append(T(x, 44, t, 13, INK, "middle", 700))
        l, _ = lines(x, 92, lab, 18, 10.5, INK2, anchor="middle")
        b.append(l)
    b.append(f'<path d="M{xp(7)},112 V120 H{xp(45)} V112" fill="none" stroke="{ORG}" stroke-width="2"/>')
    b.append(T((xp(7) + xp(45)) / 2, 138, "38 minutes before the public alert", 12, ORG, "middle", 700))
    chips = [("Day 1", "An AI-generated flood video passes 7 million views on X"),
             ("17 September", "Bulletin: 1,410 dead and 6,145 missing"),
             ("Day 24", "Ward 1 of Amachhodingmo has about 30 sacks of rice for about 270 households")]
    cw = 196
    for i, (h, t) in enumerate(chips):
        x = 8 + i * (cw + 12)
        b.append(rrect(x, 162, cw, 84, 8, PALE, GRID))
        b.append(T(x + 12, 182, h.upper(), 9, CRIM, weight=700, extra='letter-spacing="0.8"'))
        l, _ = lines(x + 12, 200, t, 30, 10.5, INK)
        b.append(l)
    return figure("On 26 August 2026 the public alert arrived 38 minutes after the glacier collapse",
        svg(W, 256, "".join(b), "Timeline of the first hour of the August 2026 Bhote Koshi flood and what followed"),
        "Times are 26 August 2026, Nepal time. Death and missing figures carry the date of the bulletin they come from. Part 1, references 61, 82, 88 and 97.")

# ---------------------------------------------------------------- Figure: discover / share / verify
def fig_seat():
    W = 660; b = []
    boxes = [
        (8, "1  DISCOVER", ["Facebook: 62% use it for news", "YouTube: 44%", "Youth also use Instagram", "and TikTok"], BLUEL, BLUED, "Facebook owns this step"),
        (232, "2  SHARE", ["WhatsApp, Viber, Messenger", "Between 69% and 83% of visits to", "the big portals arrive 'direct'", "(apps, bookmarks, dark social)"], BLUEL, BLUED, "Cards and links travel here"),
        (456, "3  VERIFY", ["Radio and TV bulletins", "About one third trust them", "Online portals: 8%", "Social media: 3%"], "#fde8ea", CRIM, "The open seat"),
    ]
    for x, h, ls, fill, ink, foot in boxes:
        b.append(rrect(x, 10, 196, 136, 10, fill, ink, 1.5))
        b.append(T(x + 14, 34, h, 12, ink, weight=700, extra='letter-spacing="1"'))
        for i, s in enumerate(ls):
            b.append(T(x + 14, 58 + i * 18, s, 11, INK))
        b.append(T(x + 14, 134, foot, 11.5, ink, weight=700))
    for x in (212, 436):
        b.append(f'<path d="M{x},78 h16 m-6,-6 l6,6 l-6,6" fill="none" stroke="{INK2}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>')
    b.append(rrect(8, 158, 644, 36, 8, NAVY))
    b.append(T(330, 181, "Opportunity: a Nepali-first, dated, sourced record that people can cite, not another place to browse", 11.5, "#fff", "middle", 600))
    return figure("Nepalis discover on Facebook and verify on radio and TV, so verification is the open seat",
        svg(W, 202, "".join(b), "Three-step diagram: discover, share, verify"),
        "Parts 1 and 2. Shares of news use: Nepal Media Survey 2024; direct-traffic range: Similarweb; trust: Nepal Media Survey 2022.")

# ---------------------------------------------------------------- HTML: stat tiles
def tiles(items, cols=3):
    cells = "".join(f'<div class="tile"><div class="v">{E(v)}</div><div class="l">{E(l)}</div></div>' for v, l in items)
    return f'<div class="tiles c{cols}">{cells}</div>'

def fig_online():
    t = tiles([("16.6M", "internet users, 56% of the population, up only 0.3% in a year"),
               ("75%", "of phones run Android; budget models have 4 GB of memory"),
               ("62%", "use Facebook for news, rising to 82.6% of 16 to 24 year olds"),
               ("44.9%", "have Nepali as their mother tongue"),
               ("69.4%", "of women can read, against 83.6% of men"),
               ("3.8M", "Nepalis work abroad, 85% in Malaysia and the Gulf")])
    return figure("Nepal online in six numbers", t,
        "DataReportal 2026, Nepal Media Survey 2024, 2021 census, Department of Foreign Employment figures. Part 1, references 1, 8, 14, 145 and 146.", "plain")

# ---------------------------------------------------------------- Figure: anatomy of a Nepali news front page
def fig_anatomy():
    b = []
    X, Y, W2 = 10, 8, 300
    b.append(rrect(X, Y, W2, 350, 8, "#fff", GREY, 1.5))
    b.append(rrect(X, Y, W2, 22, 8, PALE)); b.append(T(X + 12, Y + 15, "newsportal.com.np", 9, MUT))
    b.append(T(X + 12, Y + 46, "बुधबार, असोज २८, २०८३", 11, INK, weight=700))
    b.append(rrect(X + 12, Y + 56, 120, 16, 3, NAVY)); b.append(T(X + 20, Y + 68, "NEWS PORTAL", 9, "#fff", weight=700))
    cats = ["राजनीति", "अर्थ", "विचार", "खेलकुद", "मनोरञ्जन"]
    cx = X + 12
    for c in cats:
        b.append(T(cx, Y + 94, c, 9.5, BLUED, weight=600)); cx += 9 * len(c) * 0.62 + 18
    b.append(f'<line x1="{X+12}" y1="{Y+100}" x2="{X+W2-12}" y2="{Y+100}" stroke="{GRID}"/>')
    b.append(rrect(X + 12, Y + 108, 176, 92, 4, "#dfe6f2")); b.append(T(X + 20, Y + 190, "Lead story: headline over a large photo", 8.5, INK2))
    b.append(rrect(X + 196, Y + 108, 92, 92, 4, PALE))
    b.append(T(X + 204, Y + 124, "ताजा", 10, CRIM, weight=700))
    for i in range(4):
        b.append(f'<line x1="{X+204}" y1="{Y+136+i*16}" x2="{X+280}" y2="{Y+136+i*16}" stroke="{GREY}" stroke-width="3" stroke-linecap="round"/>')
    b.append(rrect(X + 12, Y + 208, W2 - 24, 28, 3, "#fff4cc", "#e8c75a"))
    b.append(T(X + W2 / 2, Y + 226, "विज्ञापन  (bank or telecom banner)", 9, INK2, "middle"))
    b.append(T(X + 12, Y + 254, "धेरै पढिएका", 10, CRIM, weight=700))
    for i in range(3):
        b.append(rrect(X + 12, Y + 262 + i * 26, 30, 22, 3, "#dfe6f2"))
        b.append(f'<line x1="{X+50}" y1="{Y+273+i*26}" x2="{X+250}" y2="{Y+273+i*26}" stroke="{GREY}" stroke-width="3" stroke-linecap="round"/>')
    b.append(f'<line x1="{X}" y1="{Y+338-4}" x2="{X+W2}" y2="{Y+338-4}" stroke="{GRID}"/>')
    b.append(T(X + 12, Y + 346, "सूचना विभाग दर्ता नं.", 8.5, MUT))
    notes = [("a", Y + 42, "Bikram Sambat date in Devanagari digits"), ("b", Y + 92, "Nepali category bar"),
             ("c", Y + 150, "Lead photo card, then dense thumbnail lists"), ("d", Y + 128, "ताजा (latest) and धेरै पढिएका (most read) rails"),
             ("e", Y + 222, "Static banner ads from the portal's own servers, the most-cited complaint"),
             ("f", Y + 344, "Department of Information registration number in the footer")]
    ny = [20, 68, 116, 164, 220, 300]
    for (k, ey, txt), yy in zip(notes, ny):
        ex = X + W2 + 2 if k in ("d",) else X + W2
        b.append(f'<line x1="{X+W2-4}" y1="{ey}" x2="352" y2="{yy+4}" stroke="{CRIM}" stroke-width="1"/>')
        b.append(f'<circle cx="{X+W2-4}" cy="{ey}" r="3" fill="{CRIM}"/>')
        b.append(f'<circle cx="362" cy="{yy+4}" r="9" fill="{CRIM}"/>' + T(362, yy + 8, k, 10, "#fff", "middle", 700))
        l, _ = lines(380, yy + 2, txt, 44, 10.5, INK)
        b.append(l)
    return figure("What a typical Nepali news front page looks like (schematic)",
        svg(660, 370, "".join(b), "Schematic of a Nepali news portal front page with six annotated parts"),
        "Redrawn from live observation of Setopati, eKantipur and Onlinekhabar on 14 October 2026. Part 1, references 68 to 70.")

# ---------------------------------------------------------------- Figure: persona grid (HTML)
def fig_personas():
    P = [("News consumer", "Who is behind this, who pays for it, and where is the registration number?"),
         ("Diaspora reader", "Can I read a summary in Nepali or Roman Nepali, and the English of the same item?"),
         ("Disaster-affected person", "Is my relative on any list, which is the latest, and whom do I call?"),
         ("Volunteer or donor", "Which bank account is the real one?"),
         ("NGO or local government", "Does your data map to BIPAD's fields or will we re-key everything?"),
         ("Publisher or maintainer", "Are you 'online journalism' under the 2017 Directive and 2025 Rules?"),
         ("Journalist or correspondent", "Will I be paid on time, through a bank, and get a press card?"),
         ("Moderator or fact-checker", "What is the checklist for a user-submitted item?"),
         ("Advertiser or regulator", "What are your audited visitors, and the Nepal versus diaspora split?")]
    cells = "".join(f'<div class="pc"><div class="n">{i+1}</div><div class="t">{E(n)}</div><div class="q">&ldquo;{E(q)}&rdquo;</div></div>' for i, (n, q) in enumerate(P))
    return figure("Nine personas, and the first question each would ask a new civic-information portal",
        f'<div class="pgrid">{cells}</div>', "First question from each persona section below; the full lists follow each persona.", "plain")

# ---------------------------------------------------------------- Figure: the ideal phone
def fig_phone():
    b = []
    b.append(rrect(20, 10, 230, 462, 24, "#fff", NAVY, 3))
    b.append(rrect(28, 20, 214, 26, 6, NAVY))
    b.append(T(38, 37, "VERIFIED NEPAL", 9, "#fff", weight=700, extra='letter-spacing="0.8"'))
    b.append(rrect(192, 26, 44, 14, 7, "#fff")); b.append(T(214, 36, "EN · ने", 8, NAVY, "middle", 700))
    b.append(T(36, 66, "बुधबार, असोज २८, २०८३", 11.5, INK, weight=700))
    b.append(rrect(28, 74, 214, 20, 3, "#fde8ea")); b.append(T(36, 88, "हटलाइन १२३४", 10, CRIM, weight=700))
    b.append(rrect(28, 100, 214, 26, 3, PALE))
    b.append(f'<circle cx="42" cy="113" r="4" fill="{CRIM}"/>')
    b.append(T(52, 117, "आज, मकवानपुर ▾", 11, INK, weight=700))
    b.append(T(234, 117, "वडा → नगर → जिल्ला → नेपाल", 6.5, MUT, "end"))
    def card(y, h, chip, chipfill, chipink, chipw, when, title, src, share=False):
        r = [rrect(32, y, 206, h, 6, "#fff", GRID)]
        r.append(rrect(38, y + 8, chipw, 14, 7, chipfill)); r.append(T(38 + chipw / 2, y + 18.5, chip, 8, chipink, "middle", 700))
        r.append(rrect(38 + chipw + 6, y + 8, 18, 14, 7, "#fff", GREY, 0.8)); r.append(T(38 + chipw + 15, y + 18.5, "ने", 8, INK2, "middle", 700))
        r.append(T(232, y + 18.5, when, 8, MUT, "end"))
        r.append(T(38, y + 40, title, 11, INK, weight=700))
        r.append(T(38, y + 55, src, 8.5, BLUED))
        if share:
            for i, s in enumerate(["फेसबुक", "भाइबर", "व्हाट्सएप"]):
                r.append(rrect(38 + i * 64, y + 64, 58, 16, 8, "#fff", BLUE, 1)); r.append(T(38 + i * 64 + 29, y + 75.5, s, 8, BLUED, "middle", 600))
        return "".join(r)
    b.append(card(134, 92, "जाँच गरिएको", "#d8f0d8", "#0a6b0a", 62, "२ घण्टा अगाडि", "वडा ३ मा ४० तिरपाल वितरण", "स्रोत: स्थानीय तह सूचना ↗", True))
    b.append(card(232, 66, "आधिकारिक स्रोत", BLUEL, BLUED, 78, "५ घण्टा अगाडि", "खानेपानी वितरण तालिका प्रकाशित", "स्रोत: नगरपालिका ↗"))
    b.append(card(304, 66, "जाँच गरिएको", "#d8f0d8", "#0a6b0a", 62, "आज १०:१५", "राहत केन्द्र खुला छ, फोनबाट पुष्टि", "स्रोत: केन्द्र संयोजक ↗"))
    b.append(T(36, 392, "सबै हेर्नुहोस् >>", 10, BLUED, weight=700))
    b.append(rrect(28, 408, 214, 54, 6, "#fff4cc", "#e8c75a"))
    b.append(T(135, 428, "उदाहरण · illustration only", 9.5, INK, "middle", 700))
    b.append(T(135, 444, "Items shown are invented to show the layout", 8.5, INK2, "middle"))
    marks = [(1, 64, "The date readers expect", "Bikram Sambat in Devanagari digits at the top, and relative times such as ११ घण्टा अगाडि on every item (layers 3a and 3e)."),
             (2, 84, "Hotlines never leave the screen", "Keep what already works on Verified Nepal today: the emergency number stays visible (layer 3i)."),
             (3, 113, "Place first", "Choose a place once. Items show for the ward, then the municipality, district and Nepal, and empty tiers collapse (layers 3a and 3b)."),
             (4, 151, "Two labels, in words", "आधिकारिक स्रोत: an official source posted it. जाँच गरिएको: a volunteer moderator checked it has a source, a place and a date. Neither means 'true' (layer 3c)."),
             (5, 191, "Every item shows its source", "Place, time, a link to the original, and an EN or ने chip for the language it was written in (layer 3b)."),
             (6, 222, "Built to be shared", "One tap sends a card, with its label baked in, to Facebook, Viber or WhatsApp (layer 3g).")]
    slots = [24, 100, 176, 252, 328, 404]
    for (n, ey, ttl, txt), sy in zip(marks, slots):
        b.append(f'<line x1="250" y1="{ey}" x2="288" y2="{sy+6}" stroke="{CRIM}" stroke-width="1"/>')
        b.append(f'<circle cx="250" cy="{ey}" r="3.5" fill="{CRIM}"/>')
        b.append(f'<circle cx="298" cy="{sy+6}" r="10" fill="{CRIM}"/>' + T(298, sy + 10, str(n), 11, "#fff", "middle", 700))
        b.append(T(316, sy + 4, ttl, 11.5, INK, weight=700))
        l, _ = lines(316, sy + 20, txt, 58, 10, INK2)
        b.append(l)
    return figure("What the ideal home screen looks like on a phone (illustration)",
        svg(660, 482, "".join(b), "Phone mock-up of an ideal Nepali status-board home screen with six numbered callouts"),
        "Layout illustration for Part 2. Placeholder items are invented and are not real reports.")

# ---------------------------------------------------------------- Figure: twelve layers
def fig_layers():
    groups = [("What the reader sees", BLUE, [("3a", "Home and Now surface"), ("3b", "Item model"), ("3d", "Language, script, input"), ("3e", "Dates, numbers, time")]),
              ("Why they believe it", CRIM, [("3c", "Verification and moderation display"), ("3h", "Trust and transparency"), ("3i", "Disaster-specific surfaces")]),
              ("How it reaches them", NAVY, [("3g", "Distribution"), ("3f", "Performance and data cost"), ("3l", "Accessibility and inclusion")]),
              ("Why it lasts", "#5b6b86", [("3j", "Quiet-months content"), ("3k", "Governance, legal, monetisation")])]
    b, y = [], 6
    for name, col, chips in groups:
        x, rows, rowy = 176, 1, y
        cells = []
        for k, lab in chips:
            w = 44 + len(lab) * 6.4
            if x + w > 650: x, rows = 176, rows + 1
            cells.append((x, rowy + (rows - 1) * 34, w, k, lab)); x += w + 8
        h = rows * 34 + 10
        b.append(rrect(0, y, 168, h, 8, col)); 
        l, _ = lines(14, y + h / 2 - 3, name, 17, 12, "#fff", weight=700)
        b.append(l)
        b.append(rrect(172, y, 488, h, 8, PALE))
        for cx, cy, w, k, lab in cells:
            b.append(rrect(cx, cy + 6, w, 26, 13, "#fff", col, 1.5))
            b.append(T(cx + 10, cy + 23, k, 10, col, weight=700))
            b.append(T(cx + 30, cy + 23, lab, 10.5, INK))
        y += h + 8
    return figure("Twelve layers make up the ideal portal, in four groups",
        svg(660, y, "".join(b), "Diagram of twelve layers grouped into four bands"),
        "Layer numbers match section 3 of this report. The grouping is a reading aid.")

# ---------------------------------------------------------------- Figure: empty room (HTML)
def fig_empty():
    names = ["Articles", "Stories", "Projects", "Drop centres", "Incidents", "Ledger rows", "Audit entries"]
    cells = "".join(f'<div class="z"><div class="zv">0</div><div class="zl">{E(n)}</div></div>' for n in names)
    return figure("What the production site returned on 14 October 2026",
        f'<div class="zeros">{cells}</div>',
        "Production API checks recorded in Part 3. The audit log was empty for August, September and October 2026. Only the article page screenshot in the gallery comes from the development host.", "plain")

# ---------------------------------------------------------------- Figure: scorecard meter
def fig_score():
    rows = [("1", "Home and Now surface", 2), ("2", "Item model", 1), ("3", "Verification and moderation display", 1),
            ("4", "Language, script and input", 1), ("5", "Dates, numbers, time", 2), ("6", "Performance and data cost", 1),
            ("7", "Distribution", 2), ("8", "Trust and transparency", 1), ("9", "Disaster-specific surfaces", 1),
            ("10", "Quiet-months content", 3), ("11", "Governance, legal, monetisation", 1), ("12", "Accessibility and inclusion", 0)]
    names = ["Aligned", "Partly", "Not aligned", "Absent"]; cols = [GOOD, WARN, CRIT, ABS]
    x0, sw = 270, 94
    b = []
    for i, n in enumerate(names):
        b.append(T(x0 + i * (sw + 2) + sw / 2, 14, n, 10, INK2, "middle", 700))
    y = 26
    for num, lab, s in rows:
        b.append(T(0, y + 12, num, 10.5, MUT, weight=700)); b.append(T(24, y + 12, lab, 11.5, INK))
        for i in range(4):
            fill = cols[i] if i == s else "#eceff4"
            b.append(rrect(x0 + i * (sw + 2), y, sw, 17, 4, fill))
            if i == s:
                tc = INK if i == 1 else "#fff"
                b.append(T(x0 + i * (sw + 2) + sw / 2, y + 12.5, names[i] + (" *" if num == "12" else ""), 10, tc, "middle", 700))
        y += 25
    b.append(T(0, y + 14, "* Aligned with gaps: no audio or text-to-speech, an English skip link, Madhesh languages not addressed.", 9.5, MUT))
    return figure("Alignment by layer: one aligned, seven partly, three not aligned, one absent",
        svg(660, y + 24, "".join(b), "Twelve layers shown on a four-level alignment scale"),
        "Judgement from the layer-by-layer audit that follows. Colour is paired with a word in every row.")

# ---------------------------------------------------------------- Figure: page weight
def fig_weight():
    items = [("b", "Target: whole Now surface, first load", 300, BLUE),
             ("b", "Entry script today, every page (compressed)", 229, ORG),
             ("r", "Google Fonts on a Nepali page today", 500, 900, ORG, "500 to 900"),
             ("b", "JSON file cached on first visit today", 1500, ORG)]
    body, H = hbars(items, W=660, label_w=270, maxv=1600, fmt=lambda v: f"{v:,.0f}", ticks=[0, 400, 800, 1200, 1600], ticklabel=lambda t: f"{t:,}")
    return figure("First-visit weight today against the proposed budget, in kilobytes",
        svg(660, H, body, "Bar chart comparing the 300 KB budget with current script, font and cached file sizes"),
        "Site inventory, 14 October 2026; budget from Part 2, requirement F1. The items are not additive: they arrive at different moments of a first visit.")

# ---------------------------------------------------------------- Figure: roadmap swimlane
def fig_road():
    b = []
    b.append(T(0, 18, "PRODUCT", 9, MUT, weight=700, extra='letter-spacing="1"'))
    b.append(T(0, 164, "LEGAL", 9, MUT, weight=700, extra='letter-spacing="1"'))
    def box(x, y, w, h, t1, t2, fill, ink, stroke="none"):
        o = [rrect(x, y, w, h, 8, fill, stroke, 1.5)]
        o.append(T(x + 10, y + 20, t1, 11, ink, weight=700))
        l, _ = lines(x + 10, y + 36, t2, int((w - 18) / 5.5), 9.5, ink if fill != "#fff" else INK2)
        o.append(l); return "".join(o)
    def arrow(x1, y1, x2, y2):
        return f'<path d="M{x1},{y1} L{x2},{y2}" stroke="{INK2}" stroke-width="2" fill="none" marker-end="url(#ar)"/>'
    b.insert(0, f'<defs><marker id="ar" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="{INK2}"/></marker></defs>')
    py = 28
    b.append(box(0, py, 116, 84, "Phase 0", "Honesty fixes, this week, no new feature", NAVY, "#fff"))
    b.append(box(140, py, 130, 84, "Phase 1", "News kind and Desk queue, plus a public Now strip and share cards", BLUE, "#fff"))
    b.append(f'<path d="M345,{py} L400,{py+42} L345,{py+84} L290,{py+42} Z" fill="#fff4cc" stroke="#e8c75a" stroke-width="1.5"/>')
    l, _ = lines(345, py + 36, "Ten items in one municipality?", 14, 9, INK, anchor="middle"); b.append(l)
    b.append(box(424, py, 108, 84, "Phase 2", "Locality pages and picker", "#fff", BLUED, BLUE))
    b.append(box(550, py, 110, 84, "Phase 3", "Reporter role and tally", "#fff", BLUED, BLUE))
    for x1, x2 in [(116, 140), (270, 290), (400, 424), (532, 550)]:
        b.append(arrow(x1 + 2, py + 42, x2 - 2, py + 42))
    ly = 176
    b.append(box(0, ly, 220, 74, "Start now", "Confirm the rules with the Department of Information and Broadcasting; form the entity", "#fff", INK, CRIM))
    b.append(box(250, ly, 150, 74, "Certificate", "Company, PAN, named editor, three paid staff", "#fde8ea", CRIM))
    b.append(box(430, ly, 230, 74, "Step 4: two labelled ad slots", "Waits for the certificate. Never on disaster items.", CRIM, "#fff"))
    for x1, x2 in [(220, 250), (400, 430)]:
        b.append(arrow(x1 + 2, ly + 37, x2 - 2, ly + 37))
    b.append(T(0, 276, "Stop for now: comments, push alerts, dark mode, AI writer, condolences, ad manager, Nepali URLs, server rendering.", 10, INK2))
    return figure("Recommended sequence: honesty first, growth gated on real content, ads gated on registration",
        svg(660, 288, "".join(b), "Swimlane roadmap with a product lane and a legal lane"),
        "Council sequence summarised from section 6. Dates are not fixed; the gates are.")

# ---------------------------------------------------------------- Figure: council spectrum
def fig_council():
    b = []
    y = 118
    b.append(f'<line x1="40" y1="{y}" x2="620" y2="{y}" stroke="{GREY}" stroke-width="4" stroke-linecap="round"/>')
    b.append(T(40, 218, "FILL THE SITE WITH CONTENT", 9, MUT, weight=700, extra='letter-spacing="0.8"'))
    b.append(T(620, 218, "STOP AND RE-CUT THE PRODUCT", 9, MUT, "end", 700, extra='letter-spacing="0.8"'))
    adv = [(90, "Executor", "Write five articles, then build features", True), (250, "Outsider", "Hide empty pages, Nepali first, add a local strip", False),
           (318, "Expansionist", "A 'Confirmed today' strip from data on hand", True), (505, "Contrarian", "Stop, fix staleness, test supply", False),
           (590, "First Principles", "Re-cut as a ledger of claims", True)]
    for x, n, t, up in adv:
        b.append(f'<circle cx="{x}" cy="{y}" r="9" fill="{BLUE}" stroke="#fff" stroke-width="2"/>')
        ty = 40 if up else 160
        b.append(f'<line x1="{x}" y1="{y + (-12 if up else 12)}" x2="{x}" y2="{ty + (30 if up else -22)}" stroke="{GRID}"/>')
        b.append(T(x, ty, n, 11.5, INK, "middle", 700))
        l, _ = lines(x, ty + 14, t, 21, 9.5, INK2, anchor="middle"); b.append(l)
    b.append(f'<path d="M372,{y+16} l10,-16 l-10,-16 l-10,16 Z" fill="{CRIM}" stroke="#fff" stroke-width="2" transform="translate(0,0)"/>')
    b.append(rrect(237, 234, 270, 26, 13, CRIM))
    b.append(T(372, 251, "Chairman: Phase 0 honesty, then the Now strip", 11, "#fff", "middle", 700))
    return figure("Where each advisor would start, and where the chairman landed",
        svg(660, 270, "".join(b), "Spectrum from fill the site with content to stop and re-cut, with five advisors and the chairman placed"),
        "Positions summarise each advisor's first recommendation; they are not scores.")

# ---------------------------------------------------------------- Gallery (HTML)
def gallery(shots_dir):
    shots = [("home-360x740.png", "Home page"), ("articles-360x740.png", "Articles"), ("stories-404-360x740.png", "Stories: 404"),
             ("drop-centers-360x740.png", "Drop centres"), ("find-person-360x740.png", "Find a person"), ("our-message-360x740.png", "Our message"),
             ("flood-impact-360x740.png", "Flood impact"), ("article-dev-360x740.png", "Article page (development host)")]
    figs = "".join(f'<figure><img src="file://{shots_dir}/{f}" alt="{E(c)}"><figcaption>{E(c)}</figcaption></figure>' for f, c in shots)
    return figure("The public site as a first-time visitor sees it on a 360 px phone", f'<div class="gallery">{figs}</div>',
        "Captured 14 October 2026 at 360 by 740 px. All from production except the article page, which comes from the development host because production had no published articles.", "plain")

# ---------------------------------------------------------------- Cover mountains
def mountains():
    return ('<svg viewBox="0 0 660 120" width="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
            f'<path d="M0,120 L0,86 L70,50 L110,72 L190,14 L250,66 L300,40 L360,84 L430,30 L500,76 L560,48 L660,92 L660,120 Z" fill="{NAVY}"/>'
            f'<path d="M0,120 L0,104 L90,78 L150,96 L240,58 L320,100 L420,70 L520,104 L600,84 L660,106 L660,120 Z" fill="{BLUE}" fill-opacity="0.55"/>'
            f'<path d="M190,14 L170,34 L186,30 L196,38 L204,28 L214,34 Z" fill="#fff" fill-opacity="0.9"/>'
            f'<path d="M430,30 L412,48 L426,44 L436,52 L444,42 L454,48 Z" fill="#fff" fill-opacity="0.9"/>'
            f'<rect x="0" y="116" width="660" height="4" fill="{CRIM}"/></svg>')
