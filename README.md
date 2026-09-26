# Amiya Care Practice

An English-first, bilingual browser demo for mealtime care practice. Animated care actions illustrate the context; the demo does **not** connect equipment, measure physical performance, assess swallowing safety or certify readiness.

## Learning loop

1. **Guided practice** with observable senior behaviour and bilingual coaching.
2. **Returning encounter** with the prior agreed outcome displayed separately. Permission and preparation are always fresh.
3. **Unfamiliar check** with another fictional senior. No suggestions, guided actions, live evidence, coaching or answer-key recap are available.
4. **Human readiness review** of a frozen submission. In the explicitly labelled local role-play, a centre operator nominates a reviewer; that reviewer records a reasoned decision: ready for supervised practice, more practice, or not ready. No model automatically authorises work.
5. **After-shift difficulty** creates a linked refresher and a planned follow-up assigned to the nominated reviewer.
6. **Refresher and workplace follow-up**: a completed refresher is linked to the difficulty. The reviewer role records a follow-up observation to close it.

Reviewer nomination, identities, decisions and follow-ups are in-memory demonstration records. There is no authentication, real notification, verified practitioner review or backend persistence. Refreshing the page clears the session. JSON export includes the original inputs, bilingual generated responses and recorded review decision.

## Equally valid outcomes

- The senior chooses a pause, which is respected and documented under the fictional care procedure.
- The worker seeks appropriate senior/clinical support and documents the next step.
- The senior chooses assistance; the worker prepares and demonstrates the agreed assistance, then checks back.

Pausing and seeking support require **no serving attempt**. Assistance needs **no initial failed attempt**. There is no food quantity score, acceptance percentage or synthetic agitation score in the learner view. Numeric animation controls never determine competence or clinical safety.

## Languages and input

English is the default. English / 中文 switches instructions, senior dialogue, suggestions, feedback, scene labels and review labels without deleting encounter history. Original free-text inputs, reviewer reasons and workplace notes remain verbatim rather than being silently translated. Both English and Chinese free text are processed by the local rules engine in either display language.

**Read aloud** is browser text-to-speech playback, not a voice conversation. No microphone, camera or remote LLM is used.

## Care context

The bedside case uses fictional care plan **CP-M01**, visible via **Care plan**. Positioning and swallowing animations are illustrative and require partner practitioner review before pilot use. The demo is not a feeding procedure or a swallowing assessment. A seated dining pilot variant should be selected only after the Singapore partner confirms relevance.

The good-practice example starts with observation and permission and ends with a respected pause. A separate **Poor-response replay** is clearly labelled and excluded from the learner record.

## Run and test

Node.js 20+; no production dependencies or external assets.

```sh
npm start
# http://localhost:4173
npm test
npm run build
```

`build.mjs` copies eight browser assets to `dist/`. GitHub Actions tests and deploys `main` to GitHub Pages.

`node browser-check.mjs` uses Playwright (install separately). Optional environment variables: `PLAYWRIGHT_MODULE` for its module path, `BROWSER_EXECUTABLE` for Chrome/Edge, `TEST_BASE_URL` for a preview URL. It covers English/Chinese input, refusal-respecting paths, first-attempt assistance, fresh returning encounters, hidden hints, reviewer nomination and decision, linked refresher, workplace follow-up, demo isolation and mobile overflow.

## Files

- `practice-engine.js`: bilingual fictional encounters, intent rules and three outcome paths.
- `learning-loop.js`: snapshots, review submission, explicit human decisions and follow-up links.
- `app.js`: bilingual UI, workflow controls and animation orchestration.
- `scene.js`, `scene.css`: bedside animation with optional bilingual labels and no-hints mode.
- `index.html`, `styles.css`, `practice.css`: English-first interface.
- `practice-engine.test.js`, `learning-loop.test.js`: state-transition tests.
- `browser-check.mjs`: browser integration checks.

The earlier acceptance-dependent engine was removed; Git history retains the previous demo implementation.
