import json, sys, re
from pypdf import PdfReader
pdf, heads_path, out = sys.argv[1:4]
r = PdfReader(pdf); heads = json.load(open(heads_path))
items = []
def walk(its):
    for it in its:
        if isinstance(it, list): walk(it)
        else:
            try: items.append((re.sub(r"\s+", "", it.title), r.get_destination_page_number(it) + 1))
            except Exception: pass
walk(r.outline)
res, miss, pos = {}, [], 0
for h in heads:   # ordered matching: headings repeat across parts ("1. Executive summary")
    key = re.sub(r"\s+", "", h["text"]); hit = None
    for j in range(pos, len(items)):
        k, v = items[j]
        if k == key or k.startswith(key[:30]): hit = (j, v); break
    if hit is None: miss.append(h["text"]); continue
    pos = hit[0] + 1; res[h["id"]] = hit[1]
json.dump(res, open(out, "w"))
print(f"pages: {len(r.pages)}; mapped {len(res)}/{len(heads)}; missing: {miss[:6]}")
