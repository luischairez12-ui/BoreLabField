# BoreLab Field v0.32.1 — Navigation hotfix and map-first layout

## Fixed
- Sidebar navigation now correctly allows the **Equipment**, **Tool Inventory**, and **Mud** pages. The prior v0.32 release added them to the visible menu and screen renderer but mistakenly omitted them from the `BORELAB_PAGES` navigation guard.
- The startup/restored-screen allowlist and route validation now both contain all three pages. Owner/foreman PIN checks stay unchanged, including protected pages.
- Job Map now renders **Jobsite Locations (interactive map)** immediately after the page heading, followed by shot status and pin type filters, unmapped records, the existing map actions, and **Field Calendar at the bottom**.
- Selecting calendar dates still filters the map; day-specific PDF and Replay links are retained.
- No migration and no storage-key changes; data, photos, reels, mud logs, equipment, tools and checkout histories remain saved offline.

## Tests
- Regression explicitly evaluates the actual `BORELAB_PAGES` set, not just an unrelated saved-screen array.
- Calendar ordering assertion now requires the map above Calendar, with Calendar beneath map actions.
- v0.32.1 build increments Android `versionCode` to 52 and retains the existing application ID/signature.
