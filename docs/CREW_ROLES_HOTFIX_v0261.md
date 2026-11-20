# Crew role usability hotfix — v0.26.1

- Crew Management 2.0: each person card now has **Set Role** for their persistent regular job title and **Assign Job** for a dated job assignment.
- Roles: Foreman, Driller, Locator, Mini Excavator Operator, Operator, Gas Technician, Laborer, Driver, Supervisor, Other.
- Stored on the existing roster entry as `primaryRole` (no migration or server required). Assignment `role` remains separate, dated, job-specific, and overrides the display for today's Crew Mode.
- Crew Mode and Supervisor Overview display the regular job title when a daily assignment is absent. Tomorrow's Planner shows the same fallback.
- Nothing changes existing timesheets, hours, job records, or saved assignments.
- Tests cover assigning roles without creating any job assignment and quick job editor visibility.
- Test on Android, especially small screens and PIN role restrictions.