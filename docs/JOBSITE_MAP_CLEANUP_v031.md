# BoreLab Field v0.31 — Jobsite Map interface cleanup

- Remove redundant **Change Job**, **Shot Planner**, **As-Built PDF**, and **Work date** controls from the top of Jobsite Map. The Home job switcher and sidebar Bores workspace remain available.
- Integrate a full-width **Field Calendar** into Jobsite Map, expanded by default with a readable month/date grid and small recorded-activity counters.
- Selecting a date filters the map to records saved on that date, collapses the calendar for more map space and shows **Export This Day PDF** and **Day Details & Replay** actions.
- Export passes the selected date to the existing `BoreLabAsBuilt.exportAsBuilt(day)` pipeline. The export is current-job scoped, never silently all dates. Days without saved events disable the shortcut. Whole-job exports remain in the As-Built and Closeout areas.
- All Dates clears the filter without deleting or modifying data. Changing active jobs also clears an unrelated selected workday.
- Status palette: **Pending = amber**, **Drilling = blue**, **Complete = green**, **All = brand orange**. Applied to filter chips, saved-bore GPS pins, status labels and legend. Active selection remains signaled by aria-pressed and strong visual styling, not color alone.
- Preserve offline storage key, photos, existing roles/PIN checks, metadata, backups, routes and customer report logic.
- This is a UI change and cannot substitute actual utility locates or surveyed route measurements.
