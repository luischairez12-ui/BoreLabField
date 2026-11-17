# BoreLab Field

Android prototype for horizontal directional drilling (HDD) crews.

**Current version:** v0.2 (debug/test build)

## Features

- Daily job board with bore footage, progress and notes
- Smart Shot Planner with selectable order preferences and location-based distance estimates
- Configurable extra pipe allowance (default +10 ft per shot) and pipe stock calculations
- GPS-tagged jobsite photos with timestamp, coordinates and optional address
- Saved crew roster, remembered crew selection and one-tap check-in/check-out
- Crew hours with individual lunch deductions
- Local data backup/restore and printable daily reports

The prototype works offline for locally stored records. It is **not** a production payroll app, and shot-order distances are **straight-line estimates**, not actual road driving time.

## Download a debug APK

1. Open the [Actions tab](https://github.com/luischairez12-ui/BoreLabField/actions).
2. Open **Build BoreLab Field Android APK**.
3. Select the latest successful run.
4. Download **BoreLab-Field-v0.2-Debug-APK**, extract the ZIP, and install `app-debug.apk` on your Android phone.

The APK is a debug/test build, not Play Store signed.

## Development

- Web app source: `app/src/main/assets/web/index.html` (self-contained HTML/CSS/JS)
- Android app wrapper: `app/src/main/java/com/borelab/field/BoreLabActivity.java`
- Build instructions: `.github/workflows/build-apk.yml`
- Android app id: `com.borelab.field`

Requires Java 17, Android SDK 35 and Gradle 8.9. Build command: `gradle :app:assembleDebug`.

**Data note:** Information stays on the device, including names and photo records. Export a backup before uninstalling the app. Camera, GPS, export, and Android storage integration require on-device testing. No cloud sync yet.
