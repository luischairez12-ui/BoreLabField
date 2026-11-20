# BoreLab Field v0.30 — Calendar and Inline Replay
- Remove the repeated **Active Job** card from the orange sidebar. Current job selection stays on Home and Jobs.
- Remove **Find Records** and **Search In** panels from Field Atlas & Calendar. Use the sidebar's offline universal search for record lookups. The existing Calendar and Atlas APIs still support scope/query filters for legacy deep links.
- Remove the visible **Daily Replay** tab. Keep Calendar, Atlas Map, and Insights. Legacy replay data APIs and programmatic screen access are retained.
- Clicking a work date opens a compact Daily Replay card inside its daily history. It shows saved timestamped activity, a Play / Pause control, time slider and a separate group for date-only records.
- Selecting a dated bore or pin in Atlas automatically displays its replay card beneath the map record details. If the record has activity on multiple dates, select its date using small buttons.
- Inline playback is a chronological view of saved event timestamps, **not** recorded equipment telemetry, road driving times, or underground bore alignment.
- All existing jobs, GPS points, photos, pipe records, crew hours, and offline PIN role checks remain unchanged.
- Existing storage key: `borelab-field-v0.1`. Export a backup before an in-place update.
