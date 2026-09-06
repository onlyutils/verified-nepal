# Wave 2 — populated-state visual pass (dev, 2026-09-06 night)

20 pages × EN/NE × 390×844/1280×900 = 82 screenshots in this folder. Read-only; nothing changed. Zero horizontal overflow at 390px, zero console errors, zero failed requests on every page/combination.

## New bugs (with data)
- VN-36 P1 — Missing-person poster photos never render: every poster with a photo shows an empty placeholder on the board thumbnail and in the generated poster preview (poster-board-en-desktop.png, poster-detail-en-desktop.png). Either the stored photo field and the reader disagree, or the CDN URL is not resolved.
- VN-37 P2 — Broken template: src/pages/drop-center-detail.tsx:35-36 falls back to the template string itself when `destinationLabel` is missing → "Sent to Sent to {destination}" (center-detail-en/ne-desktop.png).
- VN-38 P2 — Donation status result panel reuses the "Look up another code" label for the record's own reference (donation-status.tsx:111; donation-status-en-desktop.png).
- VN-39 P2 — /get-help status shows "Renew for 30 days" on a Fulfilled need (get-help/index.tsx:1034-1036; get-help-status-en-desktop.png).
- nit — /ledger?district= query param ignored; page opens on its default district.
- nit — published/fulfilled/open/verified/completed/received/active share one green tone (status-badge.tsx toneByStatus) → "still open" and "done" look identical on Desk boards.
- nit — /poster/:id opens the edit form; the read-only poster view exists only as a dialog from the board's "Open" — a shared link lands in an editor.
- data — stories/project/article media reuse one identical stock photo, and the article image carries a visible Vecteezy watermark; need descriptions are templated ("The family needs relief support… in X").

## Observations
- Mixed-language content: user text stays in its submission language regardless of toggle (NE body on EN board; English location mid-NE sentence). Expected; consider a small language tag.
- NE numerals: dates use Devanagari digits, stock quantities Arabic digits — inconsistent.
- Masking consistent everywhere ("Ram K." / Devanagari equivalents); moderator actor names unmasked on audit.
- give-help NeedCard has no expand state — clicking does nothing.
- Card density/scanability good on boards; Desk sections text-dense but organised.
- Desk scope banner showed 10 districts (other agents mutated the shared moderator account during the run); Kathmandu/W1 print sheet empty (claims consumed concurrently) — inconclusive.
