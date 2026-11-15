# Validation record · 14 November 2026

## Daily briefing and attention queue pass

Today’s briefing (deterministic, read-aloud): findings split into review vs awaiting repeat, changes since the previous mission day, crew check-ins and requests, and next tasks linking to Crew and Countermeasures. My Health now leads with who the astronaut is, then the explainable health card (observed → baseline → change → period), then all measurements. Crew leads with a "Needs attention" queue for the signed-in profile; the crew-wide grid was replaced by a 14-day strip for the selected crew member; a check-in answers open check-in requests (crewmate or monitoring policy). Requests persist across sign-out and profile switches.

Checks run: typecheck and lint passed; 18/18 unit tests; build passed; Playwright 15/15 locally, including cross-profile requests and the briefing.

## Crew and check-in pass

Crew renamed to Ali Shahroor (mission specialist), Mohammad Al-Ani (commander) and Nada Aboubaker (flight engineer, limited sharing); crew reduced to three. Accent side-lines removed from navigation, roster, evidence list and notices. Filters, time range, selected crew member and feed tab are remembered across reloads (`astramed-ui-v1`), cleared on restart. Check-ins: one week of synthetic routine check-ins (marked "sim"), due/overdue state, check-in form with status and note, history per crew member, crew requests answered automatically by a check-in, "Requests medical support" raises a crew notification. Notifications and activity combined with Open / All / Activity views and Acknowledge all. Pages fade in on navigation (disabled for reduced motion). My Health and Countermeasures were not changed in this pass.

Checks run: typecheck and lint passed; 18/18 unit tests; build passed; Playwright 13/13 against a local production preview.

## Cognitive battery and overview pass

WinSCAT-style battery (CDS, CPT, MTH, MTS, CDD) with NASA-sourced task structure; My Health overview rewritten (status split into findings for review vs awaiting repeat, whole-number comparisons stated against the baseline value, radiation as % of the career limit, CO₂ against its limit); reaction-time explanation generated from the calculated values; slide-over crew detail on screens under 1100 px; the cycle-ergometer NASA video (3.8 MB) bundled and precached so it plays offline.

Checks run: typecheck and lint passed; 18/18 unit tests; production build passed; Playwright 13/13 against a local production preview, including the battery (CDD locked until CDS, MTH scored 15/15 with keyboard input), the phone slide-over, and the bundled video reaching playable state with the network disabled.

## Operations and training pass

Sidebar shell with Simulation and profile menus; environment-based theming; copy rewritten to interface language; crew operations dashboard (summary, roster, detail panel with shared trends, attention timeline, notifications, activity log, check-in requests); My Health readings grouped by system with a calculation view in the health card; Physical training library with NASA videos, checklists and session logging. State migration keeps earlier saved records.

Checks run: `npx tsc --noEmit` passed; `npm run lint` passed; `npm test` 18/18; `npm run build` passed; Playwright suite rewritten to 11 tests (entry flow, direct links, calculation view, logging and theme, crew dashboard and privacy, training tracking, real timed assessment, restart, 1440/1280/390 overflow, offline with unavailable-video state, axe WCAG 2.1 AA across all four environment themes, entry screens, pages and the health card): 11/11 passed against a local production preview. Both NASA MP4s were confirmed to play with captions loaded in Chrome (76 and 82 cues); YouTube playback was not verified beyond the embed URL.

## Redesign and quality pass

Changes: new entry flow (welcome, demo access, mission briefing) with hash routing and direct links; App.tsx split into screens and workspace modules; a new restrained visual system (top navigation, profile menu, simulation bar, fewer boxes, consistent 26/18/16/15 px type scale); My Health reorganised around one current-status line, the primary finding and an indicator list beside the chart; Crew rebuilt as an operational roster with a separate cabin row, notification timeline and check-in choices; Countermeasures tabs are linkable routes and include a voluntary crew participation view.

QC fixes: shared cabin CO₂ notifications are no longer attributed to an astronaut; notification timestamps use the simulated mission clock instead of wall time; responses under 100 ms are counted as anticipatory instead of missed; voice after saving an assessment reads the recalculated finding instead of the stale one; sleep and heart-rate findings get indicator-specific explanations and next checks instead of a generic sentence; illustrative communication delays replaced with factual ranges; the radiation chart baseline is labelled as mission-start dose rather than a personal baseline; dialogs are centred and return focus to their opener; a narrow-width roster overflow was fixed.

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed |
| `npm test` | 18 / 18 passed |
| `npm run build` | Passed |
| Playwright production suite (rewritten for the new flow, 10 tests incl. axe WCAG 2.1 AA on entry screens, all pages and the health card, offline reload, real timed assessment, 1440/1280/390 px overflow) | 10 / 10 passed against a local `vite preview` |

The live GitHub Pages site still runs the previous release until these changes are pushed.


## Executed local checks

| Check | Observed result |
| --- | --- |
| Clean lockfile installation: `npm ci` | Passed; 267 packages installed; audit reported 0 vulnerabilities. A development ESLint deprecation notice remains. |
| `npm run lint` | Passed. Root application, configuration and tests checked; unrelated Template2 excluded. |
| `npm test` | 18 / 18 tests passed. |
| `npm run build` | Passed TypeScript and production build. |
| `npm run build -- --base=/astramed-prototype/` | Passed; subdirectory assets, manifest and worker registration verified. |
| Root production Playwright suite | 8 / 8 passed before publication path changes. |
| Exact subdirectory production Playwright suite | 8 / 8 passed after final changes, in 28.3 seconds. |
| Credential-pattern scan of publication files | No matching token/private-key patterns found. This is not a full security audit. |
| GitHub Actions production release | Passed clean install, lint, 18 unit tests, TypeScript/build and Pages deployment on Node 22 / Ubuntu. |
| Public-site browser acceptance | 8 / 8 passed in 34.5 seconds in fresh isolated Chrome contexts against the live GitHub Pages URL. |
| Original NASA evidence URLs | All six returned HTTP 200 during release verification. |

The dependency audit’s earlier development-only minimatch advisory was removed with a targeted override under @typescript-eslint/typescript-estree. Lint and TypeScript pass with the patched dependency. Runtime and development audit reported zero known vulnerabilities at clean install; advisories may change.

## Calculation coverage

Exact percentage math; zero/missing/nonfinite baselines; finite trial aggregation and exclusion; unit/timestamp/input-quality validation; deterministic scenario generation; scenario-specific statuses; isolated versus persistent personal changes; selected-window persistence; missing days; absent/stale/wrong-unit readings; personal identity/baseline changes; assessment-to-finding recalculation; latest timestamp per day; CO₂ averaging compatibility and boundary comparison; career-dose utilization and the strict 600 mSv bound.

## Browser coverage

Production build in an isolated headless Google Chrome context, driven by Playwright:

- Dynamic Explainable Health Cards, exact calculated percentage, NASA local evidence and original-link target.
- All scenario states and the 1.1 mmHg cabin-reference exceedance.
- Manual reading save, reload persistence, astronaut selection, mission day, environment context and hazard filtering.
- Crew policy notification, acknowledgement, personal check-in, activity completion and progress streak.
- A real timed practice interaction and five recorded keyboard-response trials. One early response was excluded. The saved median was compared with the calculated card; the test does not assume automation produces a healthy/nominal result. Notification history remains coherent after save.
- Data-quality form validation, Escape dismissal and demo reset.
- All three pages at 1440, 1280 and 390 pixels; no document-level horizontal overflow after chart reflow. Tables scroll inside their own containers. Screenshots saved alongside this record.
- Successful cache installation, network disabled, full page reload, scenario switching, local NASA summary, navigation, an actual offline timed practice response, offline manual reading and a second offline reload preserving it.
- Axe WCAG 2 A/AA and 2.1 AA checks on all three pages and logging dialog: no reported violations. Scans use reduced-motion mode for deterministic resting-state contrast; this is a basic automated check, not full conformance certification.

The browser console capture in the primary scenario/evidence flow reported no uncaught JavaScript errors. Invalid input shows a visible error instead of changing state. Native dialog supplies keyboard focus containment and Escape dismissal. Original external NASA URLs were independently inspected during source research; NASA link opening is not an offline feature.

## Issues corrected during verification

1. Navigation accessible names initially included the pending count; stable labels were added.
2. A form select’s implicit accessible name included its options; an explicit name was added.
3. Offline asset cache matches initially missed the preview server’s Vary header; same-origin public static-cache lookup now ignores Vary.
4. Scroll-container positioning and chart/table containment were corrected; responsive assertions wait for resize observer reflow.
5. Primary/secondary page-action reuse briefly interpolated colors; distinct keys prevent that transition across workflows.
6. Pending stimulus animation frames are canceled on restart/unmount/invalid trials.
7. Shared cabin notifications are deduplicated at habitat level.

## Publication status

Published after explicit user approval to [AliShahroor/astramed-prototype](https://github.com/AliShahroor/astramed-prototype). The application is live at [ASTRAMED on GitHub Pages](https://alishahroor.github.io/astramed-prototype/) without authentication. The separate existing astramed repository/site, local template copy, reference documents and Template2 were preserved.

[Release workflow 43611521046](https://github.com/AliShahroor/astramed-prototype/actions/runs/43611521046) completed successfully. Its deployed application commit is `de4ade0`. The full eight-test acceptance suite passed against that public deployment in fresh browser contexts, including offline navigation, local evidence, timing practice and manual-reading persistence after an offline reload. Subsequent publication-documentation and screenshot updates do not change the deployed application code.

No reference PDFs/DOCX, Template2, local template copy, dependencies, exports or private credentials were published. The release contains the 42 approved source, configuration, test, documentation and screenshot files. No official submission video, final slide deck or competition portal submission has been produced.

## Explicitly unverified

Flight/clinical validity, medical safety, calibrated hardware latency, actual sensor integration, cross-device sync, real authorization/privacy protection, emergency messaging, offline browser voices, multiple browser engines, installed-PWA/eviction behavior and real spacecraft hardware. There is no official demo video or final presentation artifact; submission planning is provided. No claim of competition certification or deadline verification is made.
