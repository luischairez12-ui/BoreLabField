# BoreLab Field v0.33 — 811 / Safety Contacts and Receipt Vault

## Placement
- **811 & Safety** is a short sidebar destination immediately below Field Command. It is also a card in Field Command → Today and a quick link in Crew Mode.
- This is a **local telephone directory**, not a locate ticket manager or clearance tracker. It does not place locate requests, verify markings or dispatch responders.
- The app displays two built-in dialer shortcuts:
  - **811 — Before You Dig:** for utility marking requests before excavation, *not an emergency service*.
  - **911 — Emergency:** for immediate danger. Move away from a suspected hazardous leak or strike and follow your site emergency plan.
- Owners/foremen can add up to 100 manually verified contacts, with name, phone, category, and notes. Signed-in crew can view and dial contacts but not edit them.
- Contacts live in `state.safetyContactsV33` within the existing offline state/JSON backup. No numbers are invented for a utility company.

## Media Vault → Receipts
- Includes **Scan Receipt** (camera) and **Upload Receipt** (photo or PDF). File picker supports PDF/image MIME types on Android.
- Separate **Receipts** filter inside the existing Media Vault; photos and native videos are unchanged. Receipts are linked to the active job and include optional vendor, amount, receipt date, and notes.
- JPG/PNG/WebP photos are downsampled into JPEG receipts; PDFs are saved in native PDF format. Images are capped at 25 MB before compression; PDFs at 8 MB; total receipt store estimated cap 60 MB.
- Files are stored in a separate IndexedDB database `borelab-receipts-v1`, **not** in the bore-photo store and **not** in localStorage. The receipt database is local to this device.
- Receipt image preview and PDF export are available; PDFs can be exported to another PDF app. A receipt is a purchase document, not bore evidence; it is excluded from Unlinked Photo review.
- Owners, foremen and supervisors can upload/edit receipts. Crew photo permissions are not expanded.

## Backups & device changes
- The app's JSON backup schema is advanced to **4**, containing existing `state`, existing `photos`, and a new `receipts` array that includes the original PDF bytes (base64) and compressed receipt images.
- Restore accepts older backup versions with no `receipts` array and restores an empty receipt library. Backup restore snapshots/rolls back the prior receipt library if an import fails. **Native video bytes remain excluded from JSON backup**.
- Full application reset clears the receipt library along with photos.
- Keep the existing `borelab-field-v0.1` storage key, package ID and PIN account behavior. No cloud sync or paid server required.
- On a shared device, the existing local PIN provides access control but not cryptographic protection of receipt files. Export backups to a trusted location.

## Android
- WebView handles `tel:` with `Intent.ACTION_DIAL` (no direct-call permission).
- File chooser recognizes PDF plus common image types while retaining camera capture and JSON backup import.
- Version: Android `versionCode=53`, `versionName=0.33.0`.

## Safety
The local contact list is not a substitute for utility locate clearance, emergency response, site safety planning or actual verification of utility owner numbers. Follow the applicable notification requirements and workplace safety procedures.
