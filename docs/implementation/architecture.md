# Architecture

The root Vite application is a static single-page app. It has no remote database, authentication provider, live telemetry or API credentials.

- `src/types/index.ts`: typed domain records for astronauts, missions, environments, measurements, rules, findings, evidence, assessments, notifications and activities.
- `src/data/catalog.ts`: fictional crew, baselines, context options, indicator definitions, hazard mappings and illustrative activities.
- `src/data/evidence.ts`: small verified local NASA evidence summaries, versions and limitations.
- `src/engine/monitoring.ts`: pure generation, filtering, baseline math, trend persistence, reference comparisons, assessment aggregation and input validation.
- `src/app/useMission.ts`: shared persisted state and crew policy evaluation. All pages read this state; there are no separate hardcoded crew diagnoses.
- `src/app/App.tsx`: compact application shell, page workflows and supporting forms/viewers.
- `src/components`: accessible native dialog wrapper, chart with accessible data table, timed assessment workflow.
- `src/styles/main.css`: shared restrained clinical design system, responsive layouts and reduced-motion rules; Tailwind is integrated through Vite.
- `tests/monitoring.test.ts`: calculation/data-rule tests. `tests/browser/app.spec.ts`: production-browser flows, offline and basic accessibility.

State is stored under `astramed-state-v1` in localStorage and can be reset or exported. The storage loader rejects malformed top-level state; quota/permission failures produce a visible message and leave in-memory operation available. Browser storage is not encrypted, authenticated or appropriate for real medical records. Multi-device sync and concurrent multi-tab reconciliation are outside this prototype.

The Vite build emits a versioned `sw.js` with an explicit precache list covering index, all local JS/CSS chunks, icon and manifest. The worker activates after successful precache, removes prior ASTRAMED cache versions and serves cached same-origin assets. Navigation falls back to cached index when disconnected. External NASA links are never required to interpret local evidence summaries. No offline claim is made for development mode, first visit without connectivity or browser voice engines.

In-app page navigation does not use server routes. Root and subdirectory hosting are supported. The manifest uses relative paths, worker registration uses Vite BASE_URL, and production builds can set --base=/project/. New builds change the cache version; an already open page may need reload to use the new shell.
