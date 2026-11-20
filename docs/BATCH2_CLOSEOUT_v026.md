# Batch 2 — BoreLab As-Built & Closeout Studio (v0.26.0)

## What is implemented
- Per-active-job Closeout Studio in **Tools → As-Built & Closeout Studio**.
- Google Earth KML and valid uncompressed KMZ exports of GPS field pins and bore entry/exit markers, plus schematic straight endpoint lines; never claim the line is the surveyed underground trajectory.
- Import PDF plans to private offline Android storage, view individual pages, draw persistent per-page digital redlines, undo and clear redlines, export flattened redline PDFs.
- Android Storage Access Framework selectable folder: persists an allowed provider folder URI, supports explicit exports to that folder. Google Drive only works for folder connection if its Android document provider allows selecting a folder. The normal export Save picker can save into Drive per file. No OAuth or server.
- Per-job customer/contract detail and review-first billing draft: line items, units, quantity and optional user-supplied rate. Nothing is approved or invoiced automatically.
- Customer as-built PDF using the existing native PDF pipeline, enhanced with plans reference, recorded GPS installations and linked photos.
- The PDF plans and digital redlines live in app-private files and preferences, not the JSON backup. Export marked plans before uninstalling or changing phones.

## Field safety
GPS is approximate; use certified surveyed as-builts where required. A line between endpoints is not a bore path. Review all evidence, descriptions, quantities and prices before submission.

## Google Drive caveat
This build has no OAuth token, auto-sync or background upload. A SAF folder link works only with providers exposing Android document trees. The export picker is the reliable fallback for Drive.
