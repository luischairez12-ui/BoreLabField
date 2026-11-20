# BoreLab Field v0.32 — Clean UI Labels & Field Materials Workspaces

## Navigation
- Main sidebar: Home, Bores, Field Command, Crew, Job Map, Photos, Pipe Reels, Equipment, Tool Inventory, Mud, Closeout and Settings.
- Equipment: Fleet & Maintenance (existing drill/truck/mixer units, issues, oil service, maintenance log) and Drill Manuals (existing operator/safety, maintenance, parts PDF sources and imported files).
- Tool Inventory: standalone, **not** linked to Pipe Reels and **not** an equipment usage counter. Maintain pulling heads, swivels, reamers, subs/adapters, drill tooling, locator gear, hand tools, safety gear and other items.
- Mud: Mud Mixer and Mud Inventory (uses existing MixLab chemistry rules and mud-product stock).
- Old shortcuts to `equipmentmanager2`, `manuals`, `mud`, `mudstock` continue opening the corresponding unified tab.

## Tool Inventory behaviors
- Save catalog entry with name, category, quantity (whole numbers), size/thread, location, condition, optional serial and notes.
- Check out integer quantities to a worker, truck or job; link an optional existing job; available count = owned less outstanding.
- Return all or part of a check-out with time-stamped history. Prevent over-issuing or returning more than outstanding.
- Block issuing out-of-service items; block lowering total count below outstanding and archiving tools still checked out.
- Archive hides inventory without deleting records or movement history; no fictitious initial inventory.
- New arrays `state.toolInventoryV1`, `state.toolIssuesV1`, `state.toolHistoryV1` share the **existing offline localStorage** key. They are part of ordinary state backups; no cloud or paid services.
- Universal offline search now indexes tool metadata, active assignee names, and saved mud products.
- PIN role guards remain unchanged; new pages are owner/foreman tools.

## Naming cleanup
- Remove duplicate Crew Management 2.0 shortcut from Crew Hours (Manage People is unchanged; dispatch is still in Field Command).
- Remove developer version numbers from visible feature titles, including Paperwork Scanner, Smart Photo Timeline, End-of-Day Assistant, Field Markers, Field Intelligence, Equipment Manager, Crew and Supervisor previews.
- Don't modify source identifiers, manual **document revision numbers**, storage schema version values, or Android package version. APK: v0.32.0.
- The everyday footer stops showing the build number; install version remains in Android app metadata.

## Field verification
Quantities, equipment condition, maintenance status, mud stock, and safety actions depend on manually saved data; never infer field readiness. Verify tool dimensions, thread compatibility, pulling ratings, drill service requirements, and mud labels on site.
