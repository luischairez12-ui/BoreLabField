# Field Command — UI polish v0.26.2

## Current changes
- Tools → Field Command is now a category-tabbed command deck: **Today** (7), **Maps & Docs** (6), and **Crew & Gear** (7).
- Twenty existing destinations and their navigation actions remain available. This is a view-only regrouping, not a change to job data, time, GPS, or inventory.
- Brighter white/orange cards with readable icons, short descriptors, clear tap targets and visible selected tabs.
- Role=tab/tablist/tabpanel with aria-selected/controls; tab states survive switching to another app page during the same in-app session.
- Live Workday, Smart Shot Cards, Reel Manager and Photo Organizer now get a compact horizontally scrollable quick-tab navigation strip with active-state styling.
- Keeps offline assets, existing active job, PIN guard and screen-back stack.
- Color follows the approved white/orange visual system and respects large text, glove mode, narrow-screen widths and reduced motion.

## Suggested next usability polish (not implemented)
- Let users pin or reorder command cards (currently only six Home favorites are editable).
- Unified statuses on the Field Command cards (e.g., pending bores / evidence needs review) after careful data grounding.
- Data-entry shortcuts (e.g. "Complete Bore" or "Log Reel") when the active job is known; no automatic work completion.
