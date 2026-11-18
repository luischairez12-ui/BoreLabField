# BoreLab Field

Android prototype for horizontal directional drilling (HDD) crews.

**Current version:** v0.12.1 (debug/test build)

## Features

- Daily job board with bore footage, progress and notes
- Smart Shot Planner with selectable order preferences, partial GPS pin map and location-based distance estimates
- Address geocoding when shop / shot addresses are saved, with an explicit fallback when unavailable
- Shop address and GPS saved under Settings → Home Base (reused on every job)
- Per-mode Smart Shot Planner behavior: farthest-to-shop, shortest-last, straight-line-distance minimum, or short-last-near-shop
- Partial-location mode: still orders what can be planned without pretending it knows missing shop/shot coordinates
- Open address-based routes in Google Maps even before all internal GPS positions are confirmed
- Configurable extra pipe allowance (default +10 ft per shot) and pipe stock calculations
- GPS-tagged jobsite photos with timestamp, coordinates and optional address
- Saved crew roster, remembered crew selection and one-tap check-in/check-out
- Crew hours with individually editable lunch deductions
- Automatic unpaid lunch default (Off / 0 / 15 / 30 / 45 / 60 / 90 min), applied at checkout
- High contrast white/orange daylight theme by default; optional navy/orange night theme
- Phone-friendly crew time cards with live on-shift timer and unclipped status badges
- Compact home header for better sunlit field use
- Local data backup/restore and printable daily reports

The planner shows schematic GPS pin positions, **not a live street map**. Online address-to-GPS lookup uses a rate-limited public service, may fail offline or under network/provider restrictions, and needs a production geocoding provider before a wide release. Entered addresses can still open in Google Maps for verification. The prototype works offline for locally stored records. It is **not** a production payroll app, and shot-order distances are **straight-line estimates**, not actual road driving time.

## Download a debug APK

1. Open the [Actions tab](https://github.com/luischairez12-ui/BoreLabField/actions).
2. Open **Build BoreLab Field Android APK**.
3. Select the latest successful run.
4. Download **BoreLab-Field-v0.12.1-Debug-APK**, extract the ZIP, and install `app-debug.apk` on your Android phone.

The APK is a debug/test build, not Play Store signed.

## Updating from v0.2

Early debug APKs were signed with temporary GitHub runner keys. Android may reject an in-place upgrade to v0.3 with an `App not installed` signature error. Before uninstalling v0.2, open **Settings → Backup everything** and export the JSON backup to your phone. Only after confirming the file exists, uninstall the old app, install the v0.3 APK, then use **Settings → Restore backup**. Uninstalling erases the app's local data if no backup is saved.

Starting with the new persistent debug signing cache, future v0.3+ APK builds from this workflow should be able to update one another, provided the signing cache remains intact. These are for testing only, not Play Store releases.

## New in v0.12.1 — HDD Crew Silhouette Hero Artwork

- Kept the user-approved BoreLab Field dashboard layout, colors, wording, header, active job card, tools and navigation **unchanged**.
- Replaced only the tiny SVG of the drilling machine in the Good Morning / field dashboard hero tile with a subtle **three-person HDD field crew** silhouette: a standing locator on the radio, a crouched crew member marking a position, and a supervisor holding a field tablet. Safety cone, soft hills and sunrise are subdued in BoreLab's existing blue-gray palette.
- The new SVG remains bundled in the offline WebView, with no image downloads, permissions, or network calls. The existing `uxRigArt()` function and markup stay intact for layout/test compatibility.
- Preserves all job records, crews, equipment, photos, search, backup and multi-job closeout behavior.

## New in v0.12.0 — Multiple Jobs and All-Job End-of-Day Assistant

- **Multiple independent jobs:** the prior active job is retained as the first job, including all shots, crew entries, allowance, address and notes. New jobs start empty; switching returns the first job's data intact. Job creation, switch, archive and restore are available under My Jobs. Archived jobs are hidden from the active selection until restored.
- **Job-aware work records:** bores and crew time are per job; photo captures carry a job ID, including unassigned images, with existing pre-migration photos mapped to the first job. Pipe reel inventory, mud-product inventory, shared equipment and the crew roster remain shared physical resources. Newly recorded pipe movements and mud mixes are stamped with the active job ID. Existing untagged movements and mud records remain attributed to the migrated original job.
- **Daily assistant:** review all jobs on a selected date, with per-job bore activity, completed footage, recorded crew hours, photos and warnings for open shifts or ongoing bores. Review Job opens that job's normal closeout page.
- **Combined daily summary:** saves a dated multi-job snapshot in Job History, and can export a combined PDF. Every bore and crew record is prefixed with its job name, the report notes provide a per-job overview and warnings, and pipe-planning allowances can vary by job. This does not silently mark a bore complete, check out workers, or change any active job records.
- **Shared crew accounting protection:** prevents a worker from being checked into two jobs concurrently and blocks manual time entries that overlap work recorded on another job.
- **No destructive migration:** existing `borelab-field-v0.1` localStorage and IndexedDB photo keys remain. Old JSON backup versions still restore into a single migrated job. Export backups before upgrades as a precaution.
- **Regression coverage:** migration, job isolation, attribution of photos and pipe records, no double counting in combined reports, cross-job warnings, and native debug APK compilation. Test on your actual Android phone before relying on the new multi-job features for operational recordkeeping.

**Notes:** This batch focuses on multi-job reliability and daily closeout. The previously approved voice-dictated quick notes and photo timeline are still separate planned enhancements, not included in this v0.12.0 build.

## New in v0.11.0 — Smart Job Workspace & Everyday UX Batch

**Approved items completed in one build:**

- **#1 Edit Active Job directly:** Home → Edit goes to the actual active job workspace and opens a job editor, with name, optional work-area address, and job notes. Saving updates the job and home dashboard without touching existing bore records.
- **#2 Back navigation:** Android hardware Back and the app's top-left Back button close a popup first, then follow the real previous screen stack, returning Home before leaving the app.
- **#3 Whole Active Job card:** Tap anywhere on the job card (except the distinct Edit and View Bores buttons) to open its Smart Job Workspace.
- **#4 Continue where you left off:** The last visited page is persisted on-device between app opens, with a previous-screen stack in session storage. Android's existing WebView also retains an active page while the app is backgrounded.
- **#5 Draft autosave:** Text, number, and checkbox changes in the job editor, bore form, crew time form and MixLab batch planner are stored as **drafts** on-device. A "Draft saved" label distinguishes this from a committed bore/mix/status change. Unfinished entries are restored when you reopen the form; successful form saves clear that form's draft. Guided bore steps are also remembered, separately from committed bores. JSON exports can now optionally restore pending drafts; older version-2 backups still import.
- **#7 Better numeric entry:** Numeric fields request the appropriate Android numeric keypad; bore length shows `ft` visibly in both guided and advanced entry, with optimized keyboard hints. Calculations remain unchanged.
- **#9 Quick Bore Actions:** New Actions button per bore in the job workspace and current bore rows gives Start Drilling, Finish Bore/Reopen, Edit Bore Log, Add Photo, and Open Map (when a location is available). Status timestamps use the existing log logic.
- **#10 Universal Search:** Header search finds locally saved active jobs, bore names/addresses/notes, equipment, machine-manual titles, personal manual links, and saved job history. Results are grouped and actionable; full *PDF text search* still lives inside the Manual Library.
- **Smart Job Workspace:** Live progress, bore list, linked photo count, today's recorded crew hours, job notes, and shortcuts to related tools and reports, using the current active job's existing records. It does **not** invent separate multi-job records.

The update preserves the original `borelab-field-v0.1` localStorage key and pre-existing drilling/pipe calculations, photos, manuals and report features. The debug APK is tested automatically; on-phone navigation, layout, and draft behavior should still be checked before critical field use.

## New in v0.10.1 — Visual Polish Based on Real Phone Screenshots

- Tightened the Android Home page against 350–400 CSS px phone layouts so the **job progress, six favorite action tiles, and suggested next step** take far less vertical space. The work remains readable and accessible.
- Added a subtle, **fully offline HDD rig SVG illustration** to the morning/afternoon/evening home header. No network images, external icon fonts, or loading delays.
- Replaced mismatched Unicode action glyphs with a consistent set of clean **inline SVG line icons** for all field tiles, customizable home shortcut options and main navigation.
- Changed the three-stat job card into a compact progress and completion summary, with a **View bores** shortcut. Demo data stays explicitly labeled but no longer takes up a giant warning panel.
- Restyled contextual suggestions, tile padding, top navigation, section headings and bottom navigation for the professional white/teal/orange concept.
- **Fixed the exact stray `nav>` text** caused by a leftover HTML fragment after `</nav>`. Corrected the footer's outdated v0.9.4 label and removed lengthy debug text from Home.
- Includes narrow-device width rules, high contrast for daytime, dark theme refinements, **reduced-motion support**, and maintains the optional Field Mode and Large Text size overrides.
- Existing records, backups, Simple/Advanced guided bore, MixLab, manual links/search, equipment, crews, reports and all other field workflows remain unchanged.
- Added `tests/ux-visual-polish.test.cjs` to the existing CI checks. APK build tests cannot replace real-device UI review.

## New in v0.10.0 — Field-Friendly Redesign

- **Home dashboard rebuilt:** short, friendly greeting; active job progress and footage; six large action-based shortcuts (Plan a Bore, Record Work, Mix Drilling Mud, Find a Manual, Pipe Inventory, Crew); a contextual next-step suggestion; an expandable Daily Job Board; and an All Tools shortcut.
- **New bottom navigation:** Home, Bores, prominent + Add Bore, Tools, Settings. Tools groups all existing 12 entry actions into Planning, Daily Work, Materials, and Equipment. Features were not deleted, and manual-library/offline PDF functions remain available from Home and Tools.
- **Guided Add Bore in Simple Mode:** three short stages (bore footage, name/location, review), with automatic planned-pipe allowance and a Saved Pending shot in the **same existing job data**. The old advanced bore log still exists, can edit guided shots, and is available immediately through the wizard's Full Form button.
- **Advanced Mode** restores the original detailed entry form directly from + Add Bore. User can switch modes without migrating, deleting, or rewriting any work records.
- **Settings reorganized** into My Experience (always visible), My Work & Equipment, Reports & Closeouts, Active Job, Appearance, Crew & Lunch, Data & Backup, Help & Tutorial, and a separately visible Demo & Reset section. Opening a settings group is remembered while settings re-render.
- **Glove-Friendly Field Mode** enlarges tap targets and controls; **Large Text** enlarges common labels. These are optional, stored locally, and can be switched at any time.
- **Home Shortcuts** can be personalized to 1–6 actions. Full feature access stays in Tools; shortcuts, modes, and display preferences are stored in the normal app state and included in JSON backup/restore.
- An optional **Welcome Tour** explains the three basic workflows from the Home ? button or Settings. No forced onboarding or new sign-in.
- **Compatibility:** keeps `borelab-field-v0.1` as the existing localStorage key, preserves the Android PDF manual and photo bridges, and adds compatibility defaults when older backups are restored.
- Tested at build time with `tests/ux-redesign.test.cjs` and existing regression suites. Phone interaction/legibility still needs on-device validation. This is a prototype debug APK, not a store release.

## New in v0.9.4 — Working Manual Readers & My Links

- Promoted user-confirmed links: **ManualsLib D7×11 Series II** and **ManualsDir JT20** are labeled "Read online" and appear as preferred manual sources. The existing Scribd **D24×40 Series II** link and JT24 Ditch Witch Midwest PDF remain available.
- Added a **D24×40 S3 Parts Manual** direct PDF hosted by an independent archive (parts drawings only; not operator/safety instructions).
- **Manufacturer** links are kept as alternate backup links, rather than the only prominent action. Each resource is labeled as online reader, direct PDF, paid listing, etc.
- **Browse HDD Manual Library** opens the independent Elite Underground Tools manual index for other equipment.
- New **+ My Link** button: enter a working HTTPS link, choose rig and Operator/Safety, Maintenance or Parts category, add a description and optional model/serial notes. **Open**, **Edit** and **Remove** it from the matching rig section at any time. Data is kept locally and included in the ordinary JSON backup/restore; no software update needed when another source is found.
- New user-link URLs are validated as public HTTPS and opened in an external Android browser; not treated as downloaded PDFs. Green **Saved offline** checkmarks still require a valid PDF imported into the app's private manual folder.
- Do not rely on parts catalogs, brochures, or manuals for a different series/serial range as operator instructions. Check manual revision and full safety guidance.
- This is a debug APK intended for device testing, not a published store release.

## New in v0.9.3 — Manual Links for All Eight Rigs

- **Your exact Scribd operator manual link** is now prominently visible under D24×40 and D24×40 Series II: https://www.scribd.com/document/780730040/24x40-36x50-Vermeer-operators-manual-Series-II. **Series II serial 2001–4000 only.**
- Verified model-specific sources were added across all eight existing rig entries. Source labels distinguish *Direct PDF*, *online preview*, *model page*, *brochure (not a manual)*, or *paid physical manual (not a free PDF)*.
- D7×11 has a Series II manual on ManualsLib; D23×30 has a paid Series III operator/parts listing; base D24×40 has its paid original manual listing and the separate shared Series II link; D24×40 S3 has a Scribd service manual; JT20 and JT24 have dealer-hosted direct operator PDFs; JT21 has its manufacturer manual page and a brochure clearly flagged as **not an operator manual**.
- Fixed an important bug where selecting D24×40 Series II incorrectly matched D24×40's shorter identifier, stopping the shared Scribd link from opening. This also fixes series-specific offline search labels.
- **Links open via Android's external browser** on approved HTTPS sites, rather than relying on the embedded app WebView. Offline green checkmarks still require importing a downloaded PDF into the app.
- Availability and site access may change. Scribd may require sign-in/subscription and Vermeer may require a serial number. BoreLab does not bypass paid or restricted access.

## New in v0.9.2 — Search Downloaded Manuals Offline

- **Search PDF** button appears only for manuals that BoreLab verifies are saved offline. Search words or short phrases inside a real text-based PDF (e.g., “hydraulic pressure,” “rotation,” or a fault code).
- Powered by on-device PDFBox Android: no network calls, no cloud uploads, and no AI guesswork. Shows the **PDF page number and a short matching text excerpt**, with the keyword highlighted.
- Tap **View page** to open the matching page directly in the new built-in offline PDF viewer. Use Prev, Next, page number Go, and zoom; the existing Open PDF action still works with external PDF apps.
- The page number refers to the PDF's own pages, including cover sheets, so printed manual page numbering may differ.
- Search checks up to 900 PDF pages and shows the first 100 matching pages, one excerpt per page. Search is case-insensitive and runs in a worker thread.
- **Scanned/image-only PDFs** with no embedded text are not searchable in this version. The app explicitly says OCR is needed instead of pretending it found nothing. OCR is planned for later.
- Existing manual files, checkmarks, other BoreLab records, and JSON backups are unchanged. Verify the model and serial number and consult the complete official safety procedure, not just excerpts.

## New in v0.9.1 — Alternative Manual Sources

- Manufacturer links remain visible. Under **D24×40 Series II**, **JT20**, and **JT24**, BoreLab adds separately labeled alternate sources with the exact manual type.
- Vermeer D24×40 Series II Scribd operator preview covers serial 2001–4000; a separate maintenance preview covers 381–2000. The parts reference must be checked for revision/serial compatibility. These are **online previews**, not promises of free PDF downloads.
- Ditch Witch Midwest hosts direct dealer PDF links for JT20/JT20XP operator (issue 6.0) and JT24 operator (issue 3.1); each still needs version verification.
- Alternative links do not automatically mark PDFs as downloaded. Saved-offline checkmarks continue to be derived only from the verified local PDF in BoreLab's private folder, after the user downloads and imports an authorized copy.
- No copyrighted manuals are bundled, scraped, or hosted by BoreLab. It does not bypass Scribd subscriptions or manufacturer access controls.

## New in v0.9.0 — Rig Manual Library

- Added **Manual Library** in Field Toolbox with official manufacturer links for Vermeer D7×11, D23×30, D24×40 and D24×40 S3, plus Ditch Witch JT20, JT21 and JT24.
- **Find PDF** opens the manufacturer source page/model-specific document folder (not a promise of a direct PDF). Ditch Witch offers model document folders; Vermeer manuals may require registration or a VIN/serial number through VermeerOne.
- Download your exact machine's PDF in the browser; return to BoreLab and use **Import PDF** to choose it from Android Downloads/Files.
- Android copies the selected PDF into its private **files/manuals/** folder. A **✓ Saved offline** checkmark appears only after the native code verifies a PDF file is present; an unimported Chrome download does not count.
- Rechecks the folder on launch, on return to BoreLab, after import/deletion, and with **Check Files**. It does not silently scan the public Downloads folder.
- **Open PDF** uses a read-only Android FileProvider with any installed PDF viewer; **Remove** deletes only the BoreLab-managed copy, not the original in Downloads.
- The private PDF folder is not included in JSON backups; keep original PDFs elsewhere. Uninstalling the APK removes those copies. Browser-only preview cannot import manuals.
- Each slot is labeled Operator/Safety, Maintenance, or Parts. The user must check the PDF's model/year/serial compatibility and select the correct slot. No auto-verification of manual contents is claimed.
- Existing MixLab, routes, reels, photos and crew data remain intact.

## New in v0.8.1 — Quick Final Tank Targets

- Choose **¼ full, ½ full, ¾ full, Full, or Custom gallons** as the desired final fill level in MixLab, alongside the existing current-level shortcuts.
- A fraction derives an approximate target volume from tank capacity and recalculates when capacity changes. Custom gallons remain editable.
- Saving a plan retains the selected final-level choice; recording an actual mix resets it to Custom because the final volume was logged.
- Top-off calculations continue to use only newly added water, manufacturer/approved user-entered product rates, and the existing inventory shortage checks. No chemical amount is inferred from a fraction alone.
- Old saved jobs continue to use their existing exact target gallons with Custom mode. Multiple jobs and real-road routing are still deferred.

## New in v0.8 — MixLab Pro: Product Inventory and Tank Mixing History

- **Product Inventory** accessed from MixLab: track each saved mud product's stock in the same units used by its verified dosage. Existing saved products are treated as **untracked stock** until you enter a physical count; BoreLab never guesses how many bags or buckets you have.
- **Package-based receiving:** enter the number of containers and their actual label quantity (e.g., **8 × 50 lb bags** or **2 × 5 US-gallon buckets**). Compatible mass (lb/oz/kg) and US volume (fl oz/qt/gal/L/mL) units are converted; counted bags are handled as a count-only category, not an assumed weight. Partial containers can be entered as fractional packages.
- **Stock adjustments with history:** count starting inventory, receive deliveries, remove/deduct damaged or returned product, and recount total. Prevents a negative stock balance. Each movement records timestamp, units and quantities.
- **Mix Preview shows Enough / Short / Unknown** for each selected product. Plans and previews never deduct inventory.
- **Record Actual Mix** validates available tracked stock, stops if it would run short, and deducts the calculated amount per product only after confirmation. Unknown/untracked stock is flagged; it cannot be automatically deducted. A dated, itemized ledger ties deductions to the batch.
- **Tank history:** the latest recorded batch's product additions remain viewable in MixLab. This is **not** a calculation of residual mud concentration. Pumping or changing tank level flags unknown/adjusted contents, and emptying the tank clears the active batch association.
- **Daily closeouts, saved snapshots and native PDFs** include the product stock movement ledger as well as the existing mixing logs.
- Preserves earlier stock-untracked MixLab products, scanned label photos, pipe reels, job history, truck maintenance and routes without enabling multiple jobs or real-road routing.

**Material handling warning:** These quantities depend on actual container sizes, recorded usage and manually entered stock. Verify product chemistry, packaging, mixing rates, actual volume, and any remaining fluid's condition before preparing a batch. A stock count does not prove treatment suitability, and previously mixed tank contents are never assigned a calculated concentration.

## New in v0.7.2 — Quick Fractional Tank Levels for Premixed Mud

- In MixLab and in **Set Level**, choose **Empty (0%), ¼ full (25%), ½ full (50%), ¾ full (75%), Full (100%)**, or **Custom gallons**.
- A selected fraction computes and displays **approximate current gallons** from the saved/entered tank capacity; for example, ¾ of a 1,000-gallon tank ≈ 750 gallons. Custom mode remains editable.
- If tank capacity changes while a fraction is selected in the MixLab form, the estimate recalculates without starting a new batch.
- Saving a plan records both the chosen fill-level preset and its derived gallon estimate; tank calculations continue using volume in gallons.
- **Set Level** saves the fraction directly without logging any additives or changing the saved mud-product rates. Actual-mix logging moves the fluid level to the known final volume and resets the level selector to Custom.
- The previous `currentGallons` field remains intact for data migration. Older versions' exact gallons use **Custom** until the user picks a fraction.
- These selections are **approximate visual estimates**, not measured tank readings. An existing premix's composition must be verified before using product quantities suggested for top-offs.

## New in v0.7.1 — Scan a Product Label Once, Reuse in MixLab

- **Scan Product Label** in MixLab offers camera capture or choosing an existing photo.
- The Android app uses the **bundled on-device Google ML Kit Latin-script text recognizer**, so no cloud OCR service, network connection, or Google Play Services is required to read the label.
- BoreLab suggests a product name based on the scanned text; keeps a compressed product-label photo and recognized label text alongside the saved product entry.
- A scanned product immediately becomes a **saved library option**. If the dosage is incomplete or unverified, it is listed as **Needs verified mixing rate**, with an **Add Rate** button; its checkbox remains disabled.
- Once a user checks the product's actual label/approved fluid program, enters a positive amount and gallons, and explicitly checks **I verified...**, the product becomes selectable for MixLab calculations and is selected automatically after saving.
- Existing manually entered products remain available without scanning. Old MixLab batch history and existing job data are preserved.
- Scanned product photos are compressed and stored with the saved app data, including JSON backups. Too many photos could approach browser storage limits; back up regularly.
- In a regular web browser without the Android OCR bridge, the user can still attach the photo and manually enter the product details; **automatic OCR is available in the Android APK only**.

**Important:** Image recognition is not a guarantee of accurate dosage. Mixing quantities are never approved automatically. Verify rates, units, gallon basis and manufacturer-specific instructions yourself before calculating or mixing.

## New in v0.7 — MixLab: Drilling Mud Calculator

- **MixLab in Field Toolbox** works offline with a saved tank capacity, current volume and desired final tank level in US gallons
- Choose a **fresh, empty-tank batch** or **top off an existing mix**; the calculator distinguishes all fresh water from only newly added water
- Save additive products with their exact **user-entered manufacturer/approved rates and units per gallons**; select multiple products per batch, edit or archive them
- Calculate each selected product's dose using the gallons of new water and the rate you entered; show the full rate basis and product source
- Ground-condition notes (sand, clay, mixed, rock, other) are kept for records but **never automatically change chemical dosage**
- Preview a plan without changing stock; explicitly **Record Actual Mix** after it is made, preserving the applied product quantities and updating the tank's current level
- **Update Tank Level** separately for fluid used, returned or drained. No chemical consumption is inferred by merely changing water level.
- Dated mixing records are saved locally, included in daily closeout/job snapshot records, and exported in **native PDF reports**
- Existing v0.6 records and backups remain compatible. **Multiple jobs and real-road routing were not added.**

**IMPORTANT MIXING SAFETY:** BoreLab has no built-in recommended polymer/bentonite/chemical doses. Every product rate must be manually entered from its manufacturer technical data sheet or the approved project fluid program. Top-off arithmetic assumes the existing fluid is already treated to the intended concentration; if that composition is unknown, additional-water calculations alone cannot establish a safe or effective final mix. Follow the product's mixing order, hydration, water-quality and PPE instructions; field verification remains essential.

## New in v0.6 — Native PDF, Daily Closeout, Job History

**No multiple-job switching or management was added.** The app still has one active job.

- **Real PDFs in the Android APK:** Native Android `PdfDocument` generates a multi-page .pdf containing searchable bore log text, crew hours, pipe movements, summary totals, notes and attached photos. The Android document picker lets the user select where to save it.
- **Daily Closeout:** Review a specific work date, see open crew hours / missing pipe / drilling status / missing photo warnings, manually check four review items, enter day-end notes, and save an immutable dated snapshot. Saving a closeout does *not* automatically clock crew out or mark shots complete.
- **History:** See chronological saved daily closeouts with view/export actions. A separate **Save Job Snapshot** captures current job progress without clearing or closing the active job, and without creating a second active job.
- **Historical PDF export:** Uses the frozen closeout/job snapshot rather than live edited field records. Original photos are kept in local IndexedDB; saved history has photo references, so a deleted original image may be unavailable in a later export.
- **Backups:** Exports include these new history snapshots alongside existing field records.

The standalone browser preview has no Android native PDF bridge; it retains printable HTML (Print → Save as PDF) as a fallback. **The Android APK writes .pdf files directly.** Reports are saved locally, never automatically sent or submitted. The actual save location is chosen through Android's document picker.

## New in v0.5 — Reel Inventory and Company Truck Service

**No changes to road routing in this release.** The existing GPS/route behavior is retained.

- **Reel-by-reel pipe stock:** add individual reels with size, material, location (truck or yard), remaining footage, and a "use before returning" flag
- **Pipe reservations:** hold footage against a reel for a particular shot without reducing remaining physical stock; release reservations from the inventory screen
- **Actual pipe use:** record footage installed from a reel and attach it to a bore shot; reduce the reel's balance only when pipe is recorded as used, not when planned or reserved
- **Inventory adjustments and history:** log added/removed footage, with safeguards against negative balances or using pipe reserved for another shot
- **Planner integration:** pipe on truck comes from active reel balances once reels are entered; pending shots (not completed shots) drive the open pipe requirement
- **Preserves legacy inventory:** existing single-number stock remains available until the crew adds reels; no reel allocations are inferred
- **Garage company trucks:** save odometer, engine hours, last oil service date/mileage/hours, and configurable oil-change interval in miles, months, and/or engine hours
- **Oil change status:** show "due soon" or "due" on Home and in Garage based on entered readings and dates; show a reminder when the app opens
- **Log an oil change:** record when service occurred and reset the next-due calculation, retaining service history

**Important service disclaimer:** BoreLab does *not* guess the correct oil-change interval for a company truck. Enter the manufacturer/fleet interval for that specific engine and duty cycle. The app cannot read the odometer by itself; update the mileage/engine-hours values as they change. **Reminders appear in BoreLab on app open / in Garage. They are not Android background push notifications when the app is closed.** Confirm service requirements with the vehicle manual and your fleet policy.

**Important pipe disclaimer:** Reel footage is a quantity balance, not proof of continuous usable pipe. Confirm reel lengths, pipe types, connections, handling, and scrap before scheduling work. Installed-pipe transaction history takes precedence over an older manually typed pipe-used value for a shot. The app stores these records only on this device until exported.

## New in v0.4.1 — Compact Route Options

Route preferences are collapsed by default. The planner shows **“Choose how you'd like to finish your day”** and your current selection. Tap the heading to expand the four choices; selecting one saves the preference, closes the list, and updates the route display. Tap again to change it. Missing-GPS warnings remain visible when a route cannot be calculated reliably.

## New in v0.4 — Field Operations

- Tap a shot pin, a shot's **Navigate** button, or the shot detail's **Google Maps** button to open that stop in Maps
- Launch a full **shop → ordered shot stops → shop** route in Google Maps when all stops have a location
- **Equipment Garage** in Settings: save drills, locators, mixers, trucks and trailers with optional serial/unit number; assign multiple items to a shot
- **Bore Log** records planned pipe including the +10 ft allowance versus **actual pipe used**, rod count, entry/exit depth, start/finish time, notes and equipment
- Photos attached to a shot appear in that shot's detail screen; add from camera or gallery
- One-tap report compiled from saved records; Settings lets you choose **today** or **entire job**

**Important:** The interactive in-app map is a schematic using GPS positions, not a streets map. It can work offline with existing GPS pins, but Google Maps navigation and address lookup require internet access. Route priority still uses geographic (straight-line) distance, not live road duration. The report exports **printable HTML**, which you can open and use Print → Save as PDF; a native PDF exporter is not implemented yet. Pipe footage used on a bore is not automatically deducted from reusable pipe inventory. The app stays on-device; it does not automatically submit reports or timesheets.

## Development

- Web app source: `app/src/main/assets/web/index.html` (self-contained HTML/CSS/JS)
- Android app wrapper: `app/src/main/java/com/borelab/field/BoreLabActivity.java`
- Build instructions: `.github/workflows/build-apk.yml`
- Android app id: `com.borelab.field`

Requires Java 17, Android SDK 35 and Gradle 8.9. Build command: `gradle :app:assembleDebug`.

**Data note:** Information stays on the device, including names and photo records. Export a backup before uninstalling the app. Camera, GPS, export, and Android storage integration require on-device testing. No cloud sync yet.
