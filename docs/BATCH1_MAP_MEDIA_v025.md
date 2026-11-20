# BoreLab Field 0.25.0 — Mapping & Media Batch 1

This build extends the existing BoreLab field records rather than creating parallel databases.

## Map, markers and the future as-built
- Entry and exit GPS use the existing `shot.asbuiltStart` and `shot.asbuiltEnd` records and the saved Android GPS accuracy, when available.
- The Jobsite Map fits to saved entry/exit points even if a bore has no separate center pin. Tap a cyan A–B line to see its bore. From the bore details, choose **Entry / Exit GPS** to change either point. The saved drawing changes with the endpoints.
- Long-press an empty map location to add HH handhole, box, coupling, tie-in, pedestal, utility or custom symbol. This is **map placement**, not a surveyed GPS fix. Verify field position using device GPS before relying on it.
- The map and Atlas legend explain marker symbols. Existing field-pin records, photos, dates and measurements are preserved.
- A–B means straight GPS endpoint reference. It does **not** represent the surveyed underground bore trajectory, drilling depth or verified clearance.

## Field media
- The Photos page is now **Photos & Videos**, reusing the original photo IndexedDB. Existing photo capture and detailed photo tools remain accessible.
- Video capture and import use a native Android picker/camera and store video bytes in `getFilesDir()/field_videos/`; a `FileProvider` provides playback and explicit export. A single clip must be 200 MB or less.
- Each video has a local ID, date/time, job, optional linked bore or marker, notes and optional GPS when permission and a fix are available.
- **Backups:** the existing JSON backup includes video metadata but **NOT VIDEO BYTES**. Export important videos separately before uninstalling, resetting or moving phones. Batch 2 can add authorized cloud folder sync.
- Video availability and codec playback depend on the device's installed Android camera and WebView; test with an actual clip before using the footage as the only evidence.

## Performed By / Drill Crew
- Advanced bore edit offers a team name plus optional driller, locator and roster members. The selected names are snapshotted into the saved bore and appear in the bore detail and standard PDF export.
- Guided and quick bore creation remain available. Open Edit Bore Log afterward to assign the performing crew.

## Companion and second batch
- BoreLab's private Mi OS snapshot now includes A/B points and installation symbols without exposing private video files, PINs or full records. The separately maintained launcher may need a renderer update to connect endpoint pairs visually.
- **Batch 2, not included:** optional Google Drive folder connection with scoped authorization, KML/KMZ export, PDF plan import and markup/redlines, billing drafts and customer-ready as-builts.

## Preserve these modules in future work
`web/field-crew-v025.js`, `web/field-media-v025.js`, `web/field-map-tools-v025.js`, `web/field-mapping-media-v025.css`, existing `web/field-pins.js`, `web/jobsite-map.js`, `web/field-atlas.js`, and their mirrored `app/src/main/assets/web/` copies; native file-handling lives in `BoreLabActivity.java` and `res/xml/manual_paths.xml`.

**Safety:** supervisors and crew should review installed records in their approved roles. Field pins and measurements are unverified until checked onsite. No automatic reel deductions occur in this batch's mapping/media features.
