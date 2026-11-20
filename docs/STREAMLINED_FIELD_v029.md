# BoreLab Field v0.29.0 — Streamlined Field Experience

## User-facing screens
- **Home:** compact current-job card, five essentials (Bores, Field Command, Crew, Photos, Closeout), small live daily snapshot, job-map and search shortcuts. No dashboard widget maze on the default Home.
- **Sidebar:** universal offline search plus nine primary routes. Field Command is now its own destination, not a field-tools category. Specialized tools remain in Settings > Advanced Tool Library.
- **Bores:** opens on **Shot Planner**, with a real-coordinate *schematic map preview* at the top and a button to the full interactive Job Map. One route-preference selector controls the order and map. Existing Smart Shot Cards are the second tab.
- **Finish preference:** farthest-to-shop, shortest-last, longest-to-shortest, shortest-to-longest, least straight-line distance, and short shot near shop. Sorting by shot length works without GPS; proximity optimizations require valid saved coordinates. No invented drive times.
- **Pipe Reels:** inventory, reel planning and Reel Command in one three-tab workspace, rather than inside the Bores screen. Bores displays only a short readiness handoff, without claiming enough continuous pipe.
- **Field Command:** Today / Dispatch / Review tabs, connecting existing verified crew dispatch, equipment roles, pre-drill checklists, evidence review and end-of-day actions.
- **Floating +:** shows the actions relevant to the current screen (bore, pin, reel, crew and evidence); uses existing creation flows and role checks.
- **Remember position:** session-scoped tab preferences and scroll positions; no sensitive job data is stored in this UI-only preference object.
- **Field Mode:** stronger contrast, larger tap targets and simpler workday cards on top of the existing setting.

## Compatibility, safety and next steps
- **No saved-record migrations**; the existing local storage key `borelab-field-v0.1` remains unchanged.
- Legacy planner, shot-card, reel-plan, reel-command and Field Command links resolve to their new combined workspaces.
- Underlying field record forms, PIN account guards, shot status actions, GPS markers, photos, reports, backups and offline storage are left intact.
- The small planner map is a schematic based on saved GPS, **not actual roads**, satellite imagery or a driving route. Full interactive jobsite map remains available.
- Pre-drill review checkboxes are manual confirmations only. They do not replace utility locates, engineering review, inspections, site-specific safety measures or customer approval.
- Debug APK output: `BoreLab-Field-v0.29.0-Debug-APK` from the main-branch GitHub Actions workflow. Android app ID is unchanged for in-place updates; export a local backup before upgrading.
