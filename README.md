# Amiya Care Practice — guided service demonstration

Public demonstration: https://amiyaasia.github.io/embodied-care-demo/

One authored, automatically advancing bilingual story. Visitors observe **Hui Lin**, a fictional care worker; they do not take a test, enter dialogue or switch accounts.

## Eight chapters

1. Meet Hui Lin and Ms Tan: minimal handover and fictional care plan CP-M02.
2. Guided practice: Ms Tan pushes her bowl away to finish a favourite programme. Hui Lin respects the refusal and records an agreed return. No food is eaten.
3. Returning encounter: wishes are asked again; Ms Tan chooses independent eating with permitted setup help only.
4. Unfamiliar check: Mr Lim is unsure about unfamiliar food. Prepared dialogue plays without hints or coaching.
5. Human review: labelled fictional manager/reviewer cutaways show nomination, evidence and a reasoned decision for supervised workplace practice.
6. After-shift difficulty: Hui Lin reports repeating an offer after a request to stop.
7. Targeted refresher: refusal-focused practice responds to that difficulty.
8. Workplace follow-up: fictional later supervised observation, continued support and a return to Hui Lin’s story.

## Playback

- Muted, captioned autoplay when active and reduced motion is not requested.
- Prominent Start/Continue, Pause, Restart, chapter selection and English / 中文.
- Chapter changes and supporting information pause playback; hidden tabs do not skip content or resume automatically.
- Optional **Read aloud** requires activation and serialises speech. All essential content is captioned.
- Body/excerpts ≥18px; primary captions ≥22px; controls/secondary labels ≥16px.
- No free-practice controls, role forms, sliders, drag interactions, measured performance or synthetic scores.

The provisional shared-lounge scenario and fictional CP-M02 require Singapore partner/practitioner review before a pilot. Animation does not detect swallowing or validate feeding safety. References and authored-adaptation credits are accessible through the Sources panel; no organisational endorsement is implied.

## Run / test / build

Node.js 20+; no runtime dependencies or external assets.

```sh
npm start
# http://localhost:4173/
npm test
npm run build
```

`build.mjs` allowlists exactly seven assets: `index.html`, `tour.css`, `tour-scene.css`, `tour-app.js`, `tour-player.js`, `tour-story.js`, `tour-scene.js`. Internal briefs, research records, local handover files, recordings, tests and earlier interactive modules are not in the deployed build.

`node browser-check.mjs` requires Playwright installed separately. Optional environment variables: `PLAYWRIGHT_MODULE`, `BROWSER_EXECUTABLE`, `TEST_BASE_URL`. Browser results and screenshots go to ignored `handover-local/`.

`node record-tour.mjs` records the full eight-chapter browser loop as an explicitly labelled accelerated QA recording. It requires Playwright’s video recorder. Output and chapter times are ignored local handover assets, not publicly deployed content.

## Publishing arrangement

This public repository remains the publishing target for the existing URL. GitHub Actions tests the story/player and verifies the asset allowlist, builds `dist/`, then deploys it using GitHub Pages.

Future application and research development belongs in private `amiyaAsia/CareLab`. No private-repository migration, visibility change, credential exchange or cross-repository workflow has been implemented by this revision. A future migration requires an agreed mechanism to publish reviewed demo assets to this target or a verified replacement. Browser code is inspectable regardless of source privacy; existing public Git history is not erased by moving source.

## Known boundaries

All characters, records, submissions, assignments and reviewer actions are fictional. There is no backend, live AI coaching, real reviewer account or clinical approval.

The previous interactive language-recognition defect remains logged for future application work: deterministic phrase matching is not general language understanding and can misclassify negation or novel English/Chinese wording. The current public demo does not accept visitor dialogue, so that engine is not part of the public build.

Earlier interactive files remain in repository history/source for migration reference; the public entry point imports only the guided-tour modules.
