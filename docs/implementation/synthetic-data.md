# Synthetic data

The fictional mission Ares I is simulated from 1 January 2035, for 94 days. Those dates are arbitrary narrative dates, not a real mission schedule. Three adults are Ali Shahroor (mission specialist), Mohammad Al-Ani (commander), Nada Aboubaker (flight engineer) and (crew medical officer).

`src/data/catalog.ts` defines seeded baselines and history descriptions. `generateHistory` creates one daily reading per indicator. A sine function generates bounded deterministic variation without random telemetry. A linear drift begins after day 65 for the fatigue scenario. Alex receives full fatigue drift; Samira receives 0.28 of that drift; Maya and Leo have no cognitive drift. Leo’s activity gradually decreases. No medical condition is assigned from these changes.

Alex’s scenario-B day-94 values are explicitly seeded at 351 ms, 5.7 h and 72 bpm, against preflight 285 ms, 7.4 h and 61 bpm. Percentages, finding text, persistence and notifications are calculated, not seeded. Radiation begins with a synthetic career history of 122 mSv and adds 0.5 mSv per day, reaching 169 mSv. That arithmetic is an illustration, not a predicted or measured Mars dose model. Simulated strength drifts to 98% of baseline; it is an observation fixture, not an expected bone or muscle loss trajectory.

Scenario A has nominal fixture values. Scenario C changes shared cabin CO₂ to 3.4, 3.75 and 4.1 mmHg on days 92–94; displayed values are rounded to one decimal. These are supplied one-hour averages, not synthesized from instantaneous samples. The cabin value is shared across identities. Environment selection changes context (gravity, illustrative communication latency and priorities) and does not claim the same environmental measurements were acquired on Earth, the Moon and Mars.

Profile sharing, synthetic daily check-in labels, operational delays and activity durations are demonstration settings, not NASA records or prescriptions. Browser assessment results are actual locally measured responses by the visitor and are marked distinctly. Only demonstration values should be manually entered.
