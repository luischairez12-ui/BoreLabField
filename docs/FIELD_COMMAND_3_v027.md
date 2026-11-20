# Field Command 3.0 — Eight-feature productivity batch (v0.27.0)
The existing offline storage key remains \`borelab-field-v0.1\`. This update preserves the previous v0.26 As-Built and Closeout Studio and all existing job records.

1. **Live counts** — real counts of pending bores, missing GPS, missing After photos, on-shift crew and open equipment issues on the Field Command cards.
2. **Customizable Field Command** — long press or tap Customize, move cards (arrows or drag), hide/show; saved in the current app state for backup compatibility. The old 20 routes remain intact, with a new five-tool shortcuts strip.
3. **One-tap crew dispatch** — select a date and crew, keep their primary roles as defaults, optionally assign equipment and instructions, and save dated per-job \`crewAssignmentsV2\` records in one transaction. Does **not** clock in or change payroll.
4. **Bore readiness** — per-shot manually recorded locate paperwork, plan/access, and equipment checks; GPS presence and possible continuous truck reel fit are displayed as indicators. **Not a clearance, survey or safety certificate**; pipe size, reservations and actual conditions need separate verification.
5. **Context-aware floating plus** — from shot pages open current bore or readiness, from Crew dispatch workers, and from Map add box/coupling/tie-in pins; legacy quick actions remain for other screens.
6. **Find Anything** — on-device search across saved jobs, bores, worker names/roles, equipment, dates, photos metadata, notes and field pins. Opens relevant records and respects switch-job safety guards.
7. **Save and backup confidence** — tracks last observed successful localStorage write, photo library read results and when a JSON backup export was initiated. Does not claim Drive upload, actual remote backup, or that imported private PDF plans are included in JSON.
8. **Missing Evidence Review** — Today/Whole Job review for completed bores missing After photos, incomplete entry/exit GPS, missing notes, unlinked photos, open crew shifts, and missing billing draft rows where applicable.

No automatic job completion, time edits, automatic cloud sync, safety approvals, automatic invoicing, or invisible photo relabeling. All additions are offline first and review first.
