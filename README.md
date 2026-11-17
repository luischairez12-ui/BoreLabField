# BoreLab Field

Android prototype for horizontal directional drilling (HDD) crews.

**Current version:** v0.7.0 (debug/test build)

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
4. Download **BoreLab-Field-v0.7.0-Debug-APK**, extract the ZIP, and install `app-debug.apk` on your Android phone.

The APK is a debug/test build, not Play Store signed.

## Updating from v0.2

Early debug APKs were signed with temporary GitHub runner keys. Android may reject an in-place upgrade to v0.3 with an `App not installed` signature error. Before uninstalling v0.2, open **Settings → Backup everything** and export the JSON backup to your phone. Only after confirming the file exists, uninstall the old app, install the v0.3 APK, then use **Settings → Restore backup**. Uninstalling erases the app's local data if no backup is saved.

Starting with the new persistent debug signing cache, future v0.3+ APK builds from this workflow should be able to update one another, provided the signing cache remains intact. These are for testing only, not Play Store releases.

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
