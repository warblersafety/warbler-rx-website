# Warbler Rx website

Marketing website with a live, fictional GLP-1 patient-support voice demo. Hosted on Vercel; the public application is independent of the Warbler Rx pharmacy application and the presenter sales demo.

## Development

Node 24 and npm. `npm ci`, `npm test`, `npm run build`. `npm run dev` previews the interface; use `vercel dev` to exercise the server endpoints. Configure the keys listed in `.env.example` through Vercel's secret store or an ignored local environment file. Never prefix credentials with `VITE_`.

The previous self-contained HTML export was unpacked into ordinary HTML and local image/font assets, preserving its content and design. Vite bundles only the public interface; the voice SDK is loaded after the visitor clicks Start.

## Voice flow

- Choose coverage, side effects, forgotten refill, affordability, delivery, or restart. Click the orb or Start; allow the microphone; speak as a fictional GLP-1 patient.
- `/api/voice/start` accepts only a scenario ID. It picks the fixed website agent/version and trusted scenario context on the server; the browser cannot override prompts, tools, storage settings, or credentials.
- Retell's Web SDK connects browser audio directly to Retell using an ephemeral call token. No phone number or telephone call is involved. Only the end-call tool is available; there are no clinical, messaging, scheduling, insurance, or pharmacy integrations.
- `/api/voice/result` accepts a one-hour signed receipt for that call. It verifies the website agent/surface and returns reviewed labels derived from actual analysis. Missing analysis stays unavailable/pending; it never falls back to the chosen scenario's intended outcome. No transcript, recording, model-generated free text, or provider key is returned.
- Audio drives the orb. The UI supports mute, end, cancellation, microphone errors, audio playback recovery, reduced motion, and mobile layouts. A provider-side three-minute cap remains in force if the browser closes.

## Agent and privacy

`agent-config.json` identifies the dedicated website agent and pinned published version. `lib/agent-prompt.js` and `lib/scenarios.js` record the prompt, fictional scenarios, and analysis contract. `scripts/configure-agent.mjs` provisions the agent once and refuses to silently create duplicates or change another agent. Subsequent prompt changes require a new draft/version and explicit read-back before updating the app pin.

Retell is configured to redact detected PII and retain conversation data for one day. The UI discloses processing/retention before microphone use and asks visitors to use fictional information. Redaction is not a guarantee. Application logs contain only event, scenario, operation, and status; they do not contain transcripts or recordings. Provider metadata contains an HMAC of the connection IP for usage controls, never the raw IP. Vercel may retain its ordinary platform request logs.

Clinical or product-condition concerns, missed-dose questions, GLP-1 restart/titration questions, and actual urgent symptoms have dedicated boundaries. No dosing, reassurance about symptoms, coverage guarantees, real callbacks, or refill completion claims are permitted. All results are demo previews.

## Usage controls and operation

- Kill switch: `VOICE_DEMO_ENABLED=false` followed by redeployment.
- Default admission threshold: 30 sessions per rolling 24 hours, at most three starts per connection per hour, and three recently active sessions. Checks use persisted Retell call history, not only serverless memory. Missing configuration or a failed history check fails closed.
- A per-instance lock reduces duplicate starts. History checks are **not atomic across instances** and Retell history can lag; concurrent requests may exceed the thresholds. These are abuse-reduction controls, **not a guaranteed spending cap**. Reassess distributed counters and provider budgets before high-traffic promotion.
- Provider maximum duration: 180 seconds; silence timeout: 30 seconds. No automatic retry of call creation.
- Secret values belong in Vercel as Secrets. Agent ID, numeric version, enable flag, and daily threshold are Config values. Production and preview are separate deployment targets; the present demo uses the same isolated website agent.
- Publish a staged production build only after checks and browser verification. Keep the existing pharmacy and presenter demo deployments untouched. To roll back, promote the prior known-good website deployment and disable the voice-demo flag if needed.

## Verification

`npm test` checks trusted scenario selection, origin/method/body restrictions, receipt tampering/expiry, persisted usage guards, clinical routing, unavailable analysis, and fail-closed configuration. `npm run build` checks the frontend production bundle. Provider simulations cover coverage, nausea, refill, restart, opt-out and urgent concerns. Browser and live-session verification results are recorded with the implementation PR. Synthetic simulations do not establish real patient safety or clinical effectiveness.
