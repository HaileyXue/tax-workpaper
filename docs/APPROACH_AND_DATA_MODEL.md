# Redesigning the Tax Workpaper

**Core Approach:** The tax workpaper web app was designed to prioritize evidence traceability, review efficiency, and accountability.

1. A **return-first** interface was chosen to provide CPAs with a familiar structure for reviewing calculated tax amounts while maintaining direct access to supporting calculations and evidence. Every number can be expanded to display its calculation chain and traced to specific fields in source documents within a single view.
2. A **centralized Issues queue** directs attention to discrepancies surfaced by the engine or independently by the web app. Issues are linked to the relevant calculations and evidence, allowing users with the appropriate roles to assign, investigate, correct, and resolve them.

**Data Model:** The application separates information into three layers:

1. **Source evidence:** Includes simulated source documents, extracted values, and where those values are used.
2. **Calculated results:** Contains tax lines, calculation rules, and source references for each immutable return version (v1, v2, and v3).
3. **Review records:** An append-only audit trail capturing review actions, rationale, and the associated users and roles.

**Key Engineering Decisions:**

1. **Independent validation:** The engine’s extraction confidence is not treated as proof of correctness. Independent deterministic checks are performed in the web app to identify discrepancies between extracted values and source documents, reconcile related evidence, and surface affected calculations in the Issues queue.
2. **Integrated issue management:** Issues are linked directly to their supporting evidence and calculations in the return summary, allowing users to investigate and resolve them from either the Issues queue or the return view.
3. **Change tracking and role separation:** Review actions are stored as append-only events with the user, role, timestamp, and rationale. Preparers can propose corrections, while reviewers or partners can assign and approve them.
4. **Preservation of original data:** Source values and computed return versions remain unchanged. Corrections are stored as proposed values, and estimated tax impacts are calculated using the supplied rates.
5. **Implementation scope:** The working prototype supports browser-local persistence and role controls. Production deployment would require server-side authorization, durable storage, and concurrent editing.

**Scope and Tradeoffs:** Development of the prototype was prioritized around a complete review workflow rather than implementing the entire product lifecycle, including live tax-engine recomputation, client signatures, e-filing, amendments, and post-filing case management. The resulting application is a redesigned workpaper that enables CPAs to verify calculated returns against source evidence, resolve discrepancies, and maintain an auditable record of review decisions.
