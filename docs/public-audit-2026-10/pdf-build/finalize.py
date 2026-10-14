import json, sys
from pypdf import PdfReader, PdfWriter
src, heads_path, pages_path, out = sys.argv[1:5]
heads = json.load(open(heads_path)); pages = json.load(open(pages_path))
w = PdfWriter(clone_from=PdfReader(src))
# drop Chrome's outline, then add a clean one
if "/Outlines" in w._root_object: del w._root_object["/Outlines"]
w.add_outline_item("Cover", 0); w.add_outline_item("The short version", 1)
parent = None
# the part H1 is the first heading of each part; H2s follow until the next H1
h1ids = {h["id"] for h in heads if h["id"].endswith("-the-short") or False}
part_ids = [h["id"] for h in heads if h["id"] in {"p1","p2","p3","a1"}]
cur = None
for h in heads:
    pg = pages.get(h["id"])
    if pg is None: continue
    is_part = h["id"].split("-")[0] in {"p1","p2","p3","a1"} and h is next(x for x in heads if x["id"].split("-")[0] == h["id"].split("-")[0])
    if is_part: cur = w.add_outline_item(h["text"], pg - 1, bold=True)
    else: w.add_outline_item(h["text"], pg - 1, parent=cur)
w.add_metadata({"/Title": "Verified Nepal: public-site audit, October 2026",
                "/Subject": "Audience research, ideal Nepali information portal, alignment audit, council verdict",
                "/Author": "Verified Nepal public-site audit", "/Keywords": "Nepal, news, UX, disaster information, verification"})
w.page_mode = "/UseOutlines"
w.write(out)
print("finalized", out)
