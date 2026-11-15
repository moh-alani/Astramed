# NASA evidence traceability

Original sources reviewed on 14 November 2026. Local summaries are packaged in `src/data/evidence.ts`. NASA sources supply scientific context and explicitly identified reference requirements; they do not supply the fictional crew’s health records.

| App feature | Official NASA resource | Section / revision | Extracted evidence / functional role | Calculation or interpretation | Limits and verification |
| --- | --- | --- | --- | --- | --- |
| Cabin observation | [OCHMO-TB-004 Carbon Dioxide](https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/) | Reference Information; cited NASA-STD-3001 Vol 2 Rev D (2023), V2 6004 | Habitat one-hour average CO₂ partial pressure reference is 3 mmHg | Subtract 3 only from compatible, fresh one-hour averages in mmHg; an exceedance requests verification | Verified directly in the accessible NASA brief and [NASA’s environment chapter](https://www.nasa.gov/reference/6-0-natural-and-induced-environments-vol-2/). Older Rev D PDF returned 404. Pinned reference, not a latest-revision claim or medical diagnosis. |
| Career radiation | [NASA-STD-3001 Vol 1 Rev C PDF](https://www.nasa.gov/wp-content/uploads/2023/11/nasa-std-3001-vol-1-rev-c-with-signature.pdf) | 4.8.2 V1 4030; 4.8.1 V1 4029; printed p39 / PDF p39 | Career effective spaceflight dose is below 600 mSv; minimize under ALARA | Career-reference utilization = cumulative effective dose / 600 × 100; flag ≥600 | Direct PDF verified. Not an acute-event, organ-dose or individualized cancer-risk calculation. Synthetic effective dose is not real dosimetry. |
| Longitudinal monitoring | [Spaceflight Standard Measures](https://www.nasa.gov/reference/standard-measures/) | Data collection; Impact | Sleep, activity, cognition and strength measures are gathered across mission phases | Supports the app’s categories and personal longitudinal comparison | Direct page verified. Does not establish the app’s percentage alert cutoffs or validate browser timing. |
| Reaction assessment | [HRR task 1651: PVT on ISS](https://humanresearchroadmap.nasa.gov/Tasks/task.aspx?i=1651) | Reaction Self-Test on ISS-12; published 13 May 2025 | NASA task investigates vigilance in the sleep / behavioral-performance research context | Supports measuring responses alongside sleep; does not establish causation | Task record verified. The app’s five-trial protocol and 100–3000 ms exclusion window are prototype choices, not a NASA protocol. |
| Hazard lens | [Five Hazards of Human Spaceflight](https://www.nasa.gov/hrp/hazards/) | Five hazards | Radiation, isolation, Earth distance, gravity fields, closed environment | Drives indicator filtering and operational context | Direct page verified. No physiological threshold follows from selecting a hazard. |
| Activity library | [Astronaut Exercise](https://www.nasa.gov/general/astronaut-exercise/) | Exercise equipment and research | Microgravity exercise uses specialized equipment | Requires approved mission plans/equipment in illustrative checklists | Direct page verified. No generic activity is described as an approved astronaut prescription. |
| Evidence discovery | [HRP](https://www.nasa.gov/hrp/) and [HRR Evidence](https://humanresearchroadmap.nasa.gov/Evidence/) | HRP overview; risk evidence catalog | Research entry points for human spaceflight risks | Used to locate relevant measurement and risk resources | Opened and reviewed; no quantitative alert threshold is extracted from the catalog itself. |
| Public data investigation | [OSDR entry point](https://osdr.nasa.gov/) (redirected to [BPS Data](https://science.nasa.gov/biological-physical/data/)) | NASA data portal | Public data resource investigated | No experimental dataset selected or incorporated | Portal opened. All seeded personal measurements remain synthetic. No claim to train a model on NASA data. |

## Reference handling

The NASA standard landing page advertises a later Volume 2 download. This implementation deliberately pins the specification’s Rev D requirement as documented by the official technical brief rather than silently claiming compliance with a new revision. Before operational use, a qualified reviewer must select the applicable mission standard and verify every requirement and dose convention.

Baseline counts, the percentages used for personal deviations, gravity-context strings, illustrative communication delays, synthetic drift and activity durations are Code Blue simulation assumptions. Only the two explicitly documented NASA reference values are used as numerical standard comparisons. Status labels and notification mappings remain prototype choices even when a NASA reference is compared.

## Training videos (Countermeasures → Physical training)

Checked 14 November 2026 against the NASA Images and Media Usage Guidelines (https://www.nasa.gov/nasa-brand-center/images-and-media/). NASA video is generally not subject to US copyright, may be used for educational and informational web pages, and NASA must be credited. No endorsement is implied, and no NASA insignia is used. None of these pages marked third-party copyright. Videos stream from NASA; nothing loads before the user presses play, and they are not cached for offline use.

| Activity | Video | Credit | Media | Captions | Note |
|---|---|---|---|---|---|
| Resistance exercise | “Working Out Aboard the Space Station” (4:41) | NASA Johnson Space Center | YouTube `YxImeOomkUk` (official NASA Johnson channel), embedded via youtube-nocookie | Uploaded English track | Scott Kelly demonstrates ARED (Expedition 26). Listed on https://www.nasa.gov/hrp/hrp-videos/ |
| Treadmill aerobic exercise | “Our World: Exercise Equipment” (~5:04) | NASA eClips | NASA-hosted MP4 (assets.science.nasa.gov, CORS enabled) | NASA VTT | Shows the cycle ergometer, ARED and the **earlier TVIS treadmill**, not T2/COLBERT; the app says so. No English T2-specific NASA video was found. |
| Cycle ergometer training | “How Do Astronauts Exercise in Space?” (1:29) | NASA | images-assets.nasa.gov MP4 (`~small`, 17 MB) | NASA SRT converted to `public/media/how-astronauts-exercise.en.vtt` | Narrated overview of treadmill, vibration-isolated bike and resistance machine; hardware is not named in the narration. |

The checklists and instructions beside each video are Code Blue demonstration content, not NASA exercise prescriptions.

## Cognitive battery (Countermeasures → Cognitive assessment)

| App feature | NASA resource | What it supports | Limitations |
|---|---|---|---|
| Five tasks modelled on WinSCAT (CDS, CPT, MTH, MTS, CDD) | Seaton et al., NASA JSC report, [NTRS 20080009715](https://ntrs.nasa.gov/api/citations/20080009715/downloads/20080009715.pdf) Table I; NASA JSC/KBRwyle poster [NTRS 20180003970](https://ntrs.nasa.gov/api/citations/20180003970/downloads/20180003970.pdf) | Task structure and order (CDD last), 5 s MTS delay, median response time, accuracy, throughput, CPT lapses (> 700 ms), comparison with the astronaut’s own baseline; WinSCAT is taken every 30 days on ISS by long-duration crew | Code Blue re-creations, not WinSCAT/ANAM; shorter trial counts (CPT 20 vs 160 in WinSCAT); no norms; operational cutoffs are not published and none are used. The abbreviation for Delayed Matching to Sample in NASA sources is **MTS** (not MSP). |

Personal baseline = median throughput of the first 3 saved sessions per test. A drop of 10% or more is highlighted for the user only (Code Blue display choice, not a clinical threshold, no finding created). CDS is a learning step and is not compared.
