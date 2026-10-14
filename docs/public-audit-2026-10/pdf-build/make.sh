set -e
cd "$(dirname "$0")"
python3 build_html.py ./audit.html >/dev/null
node print.mjs "$PWD/audit.html" "$PWD/pass1.pdf" >/dev/null
python3 pagemap.py pass1.pdf audit.heads.json pages.json
python3 build_html.py ./audit.html pages.json >/dev/null
node print.mjs "$PWD/audit.html" "$PWD/final_raw.pdf" >/dev/null
python3 pagemap.py final_raw.pdf audit.heads.json pages2.json
cmp pages.json pages2.json && echo "page numbers stable"
python3 finalize.py final_raw.pdf audit.heads.json pages2.json final.pdf
pdfinfo final.pdf | grep -E "Pages|File size"
